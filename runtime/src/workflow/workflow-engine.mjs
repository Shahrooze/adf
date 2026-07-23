// The Workflow Engine turns a declarative workflow definition (parsed by
// workflow-parser.mjs) into an actual run: sequential stages execute in
// order, `parallel:` stages fan out concurrently, `condition:` gates skip
// stages whose predicate isn't met, per-stage `retry:` wraps agent
// execution in RetryPolicy, and per-stage `rollback:` runs when a stage
// exhausts its retries. Every stage boundary is checkpointed so a run
// survives an interrupted process and can be resumed with `adf resume`.
import crypto from "node:crypto";
import { parseWorkflow, STAGE_TYPES } from "./workflow-parser.mjs";
import { evaluateGate } from "./gate-evaluator.mjs";
import { RetryPolicy } from "../retry/retry-policy.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const RUN_STATES = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  FAILED: "failed",
});

export class WorkflowRun {
  constructor({ id, workflowId, featureDir, context }) {
    this.id = id;
    this.workflowId = workflowId;
    this.featureDir = featureDir;
    this.context = context;
    this.status = RUN_STATES.PENDING;
    this.currentStageIndex = 0;
    this.stageResults = {};
    this.startedAt = null;
    this.endedAt = null;
    this.error = null;
    this._pauseRequested = false;
    this._cancelRequested = false;
  }

  toCheckpoint() {
    return {
      id: this.id,
      workflowId: this.workflowId,
      featureDir: this.featureDir,
      context: this.context,
      status: this.status,
      currentStageIndex: this.currentStageIndex,
      stageResults: this.stageResults,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      error: this.error,
    };
  }

  static fromCheckpoint(data) {
    const run = new WorkflowRun({ id: data.id, workflowId: data.workflowId, featureDir: data.featureDir, context: data.context });
    Object.assign(run, {
      status: data.status,
      currentStageIndex: data.currentStageIndex,
      stageResults: data.stageResults,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      error: data.error,
    });
    return run;
  }
}

export class WorkflowEngine {
  constructor({
    workflowRegistry,
    agentRuntime,
    artifactManager,
    memoryManager,
    toolRuntime = null,
    checkpointStore,
    logger = null,
    config = {},
  }) {
    this.workflowRegistry = workflowRegistry;
    this.agentRuntime = agentRuntime;
    this.artifactManager = artifactManager;
    this.memoryManager = memoryManager;
    this.toolRuntime = toolRuntime;
    this.checkpointStore = checkpointStore;
    this.logger = logger;
    this.config = config;
    this._runs = new Map();
  }

  pause(runId) {
    const run = this._runs.get(runId);
    if (!run) throw new Error(`Unknown workflow run "${runId}"`);
    run._pauseRequested = true;
    return true;
  }

  resume(runId) {
    const run = this._runs.get(runId);
    if (!run) throw new Error(`Unknown workflow run "${runId}"`);
    run._pauseRequested = false;
    return true;
  }

  cancel(runId) {
    const run = this._runs.get(runId);
    if (!run) throw new Error(`Unknown workflow run "${runId}"`);
    run._cancelRequested = true;
    return true;
  }

  getRun(runId) {
    return this._runs.get(runId) ?? null;
  }

  listRuns() {
    return [...this._runs.values()];
  }

  async run(workflowId, { runId = null, featureDir = null, context = {}, resumeFromRunId = null } = {}) {
    const definition = parseWorkflow(this.workflowRegistry.get(workflowId).raw);

    let run;
    if (resumeFromRunId) {
      const checkpoint = this.checkpointStore.load(resumeFromRunId);
      if (!checkpoint) throw new Error(`No checkpoint found for run "${resumeFromRunId}"`);
      if (checkpoint.workflowId !== workflowId) {
        throw new Error(`Checkpoint "${resumeFromRunId}" belongs to workflow "${checkpoint.workflowId}", not "${workflowId}"`);
      }
      run = WorkflowRun.fromCheckpoint(checkpoint);
      this.logger?.info?.(`Resuming workflow run "${run.id}" from stage index ${run.currentStageIndex}`, {
        workflowRunId: run.id,
      });
    } else {
      run = new WorkflowRun({ id: runId ?? crypto.randomUUID(), workflowId, featureDir, context });
    }
    this._runs.set(run.id, run);

    run.status = RUN_STATES.RUNNING;
    if (!run.startedAt) run.startedAt = new Date().toISOString();
    this.logger?.info?.(`Workflow "${workflowId}" run "${run.id}" started`, { workflowRunId: run.id });

    const cancelNow = () => {
      run.status = RUN_STATES.CANCELLED;
      run.endedAt = new Date().toISOString();
      this._checkpoint(run);
      this.logger?.warn?.(`Workflow run "${run.id}" cancelled`, { workflowRunId: run.id });
      return run.toCheckpoint();
    };

    while (run.currentStageIndex < definition.stages.length) {
      if (run._cancelRequested) return cancelNow();

      if (run._pauseRequested) {
        run.status = RUN_STATES.PAUSED;
        this._checkpoint(run);
        this.logger?.info?.(`Workflow run "${run.id}" paused before stage index ${run.currentStageIndex}`, {
          workflowRunId: run.id,
        });
        while (run._pauseRequested && !run._cancelRequested) {
          await sleep(this.config.runtime?.pauseCheckIntervalMs ?? 250);
        }
        if (run._cancelRequested) return cancelNow();
        run.status = RUN_STATES.RUNNING;
        this.logger?.info?.(`Workflow run "${run.id}" resumed`, { workflowRunId: run.id });
      }

      const stage = definition.stages[run.currentStageIndex];
      const stageResult = await this._runStage(stage, run);
      run.stageResults[stage.id] = stageResult;

      if (!stageResult.passed) {
        run.status = RUN_STATES.FAILED;
        run.error = stageResult.error ?? "stage gate failed";
        run.endedAt = new Date().toISOString();
        this._checkpoint(run);
        this.logger?.error?.(`Workflow run "${run.id}" failed at stage "${stage.id}": ${run.error}`, {
          workflowRunId: run.id,
        });
        return run.toCheckpoint();
      }

      run.currentStageIndex++;
      this._checkpoint(run);
    }

    run.status = RUN_STATES.COMPLETED;
    run.endedAt = new Date().toISOString();
    this._checkpoint(run);
    this.logger?.info?.(`Workflow run "${run.id}" completed`, { workflowRunId: run.id });
    return run.toCheckpoint();
  }

  _checkpoint(run) {
    this.checkpointStore.save(run.id, run.toCheckpoint());
  }

  _evaluateCondition(condition, run) {
    if (!condition) return true;
    if (condition.type === "stage-status") {
      const result = run.stageResults[condition.target];
      return (result?.status ?? null) === condition.equals;
    }
    if (condition.type === "artifact-status") {
      if (!this.artifactManager.has(condition.target)) return false;
      return this.artifactManager.get(condition.target).status === condition.equals;
    }
    return true;
  }

  async _runStage(stage, run) {
    if (!this._evaluateCondition(stage.condition, run)) {
      this.logger?.info?.(`Skipping stage "${stage.id}" (condition not met)`, { workflowRunId: run.id });
      return { stageId: stage.id, status: "skipped", passed: true, skipped: true };
    }

    if (stage.type === STAGE_TYPES.PARALLEL) {
      return this._runParallelStage(stage, run);
    }
    if (stage.type === STAGE_TYPES.GATE_ONLY) {
      const gateCheck = evaluateGate(stage.gate, { featureDir: run.featureDir });
      return {
        stageId: stage.id,
        status: gateCheck.passed ? "completed" : "failed",
        passed: gateCheck.passed,
        error: gateCheck.passed ? null : gateCheck.reasons.join("; "),
      };
    }
    return this._runAgentStage(stage, run);
  }

  async _runParallelStage(stage, run) {
    const results = await Promise.allSettled(stage.branches.map((branch) => this._runStage(branch, run)));
    const branchResults = results.map((r, i) => (r.status === "fulfilled" ? r.value : { stageId: stage.branches[i].id, status: "failed", passed: false, error: r.reason?.message ?? String(r.reason) }));
    for (const branchResult of branchResults) {
      run.stageResults[branchResult.stageId] = branchResult;
    }
    const allPassed = branchResults.every((r) => r.passed);
    return {
      stageId: stage.id,
      status: allPassed ? "completed" : "failed",
      passed: allPassed,
      error: allPassed ? null : `branch(es) failed: ${branchResults.filter((r) => !r.passed).map((r) => r.stageId).join(", ")}`,
      branches: branchResults,
    };
  }

  async _runAgentStage(stage, run) {
    const retryPolicy = new RetryPolicy(stage.retry ?? this.config.retry ?? {});
    let retryCount = 0;
    let agentExecution = null;
    let lastError = null;

    try {
      agentExecution = await retryPolicy.execute(
        async () => {
          const execution = await this.agentRuntime.run(stage.agent, {
            workflowRunId: run.id,
            stageId: stage.id,
            featureDir: run.featureDir,
            consumesPaths: stage.consumes,
            executorName: stage.executor,
            timeoutMs: stage.timeoutMs,
            task: {
              stageId: stage.id,
              produces: stage.produces,
              consumes: stage.consumes,
              gateStatus: stage.gate?.status ?? null,
              description: stage.description ?? run.context?.description ?? "",
            },
          });
          if (execution.status !== "completed") {
            throw new Error(`Agent "${stage.agent}" ended with status "${execution.status}": ${execution.error ?? ""}`);
          }
          return execution;
        },
        {
          onRetry: (err, attempt) => {
            retryCount = attempt;
            this.logger?.warn?.(`Stage "${stage.id}" attempt ${attempt} failed, retrying: ${err.message}`, {
              workflowRunId: run.id,
              retryCount: attempt,
            });
          },
        }
      );
    } catch (err) {
      lastError = err;
    }

    if (!agentExecution) {
      const rollbackOutcome = await this._runRollback(stage, run, lastError);
      return {
        stageId: stage.id,
        status: "failed",
        passed: false,
        error: lastError?.message ?? "unknown failure",
        retryCount,
        rollback: rollbackOutcome,
      };
    }

    const gateCheck = evaluateGate(stage.gate, { featureDir: run.featureDir });
    if (!gateCheck.passed) {
      const rollbackOutcome = await this._runRollback(stage, run, new Error(gateCheck.reasons.join("; ")));
      return {
        stageId: stage.id,
        status: "failed",
        passed: false,
        error: `gate failed: ${gateCheck.reasons.join("; ")}`,
        retryCount,
        rollback: rollbackOutcome,
      };
    }

    return {
      stageId: stage.id,
      status: "completed",
      passed: true,
      retryCount,
      artifacts: agentExecution.artifacts?.map((a) => a.id) ?? [],
    };
  }

  async _runRollback(stage, run, error) {
    if (!stage.rollback) return null;
    this.logger?.warn?.(`Running rollback for stage "${stage.id}": ${stage.rollback.type}`, { workflowRunId: run.id });
    try {
      if (stage.rollback.type === "agent") {
        const execution = await this.agentRuntime.run(stage.rollback.agent, {
          workflowRunId: run.id,
          stageId: `${stage.id}-rollback`,
          featureDir: run.featureDir,
          task: { stageId: `${stage.id}-rollback`, produces: [], description: `Roll back "${stage.id}" after: ${error?.message}` },
        });
        return { ok: execution.status === "completed", executionStatus: execution.status };
      }
      if (stage.rollback.type === "tool" && this.toolRuntime) {
        const result = await this.toolRuntime.execute(stage.rollback.toolId, stage.rollback.args, {
          agentId: `workflow-engine:${stage.id}-rollback`,
          workflowRunId: run.id,
        });
        return { ok: result.ok, result: result.result ?? result.error };
      }
      return { ok: false, error: "rollback configured but no matching handler (missing toolRuntime?)" };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}
