// The Workflow Engine turns a declarative workflow definition (parsed by
// workflow-parser.mjs) into an actual run: sequential stages execute in
// order, `parallel:` stages fan out concurrently, `condition:` gates skip
// stages whose predicate isn't met, per-stage `retry:` wraps agent
// execution in RetryPolicy, and per-stage `rollback:` runs when a stage
// exhausts its retries. Every stage boundary is checkpointed so a run
// survives an interrupted process and can be resumed with `adf resume`.
//
// A stage's gate has two halves, and both must pass:
//   * what the agent claims  -- its artifact's STATUS line (gate-evaluator)
//   * what the Harness checks -- gate.checks run through the Validation
//     Pipeline (build, tests, ...) and the write-scope diff (every file the
//     stage changed must be inside that agent's agent.yaml permissions).
// A reviewer's legitimate "no" (STATUS: CHANGES_REQUIRED / REJECTED) or a
// failing check on a review stage is never retried: `on_fail.rework`
// routes the findings back to the author stage, bounded by max_rounds.
// When the workflow asks for human approval, a passed stage either asks
// the interactive approver or parks the run as `awaiting_approval` until
// `adf approve <run-id>` records a decision.
import crypto from "node:crypto";
import { parseWorkflow, STAGE_TYPES } from "./workflow-parser.mjs";
import { evaluateGate } from "./gate-evaluator.mjs";
import { RetryPolicy } from "../retry/retry-policy.mjs";
import {
  snapshotWorkingTree,
  changedSince,
  resolveWriteScope,
  compileScopeEntries,
  checkWriteScope,
  revertPaths,
} from "../guardrails/write-scope.mjs";
import { REPO_ROOT } from "../config/paths.mjs";

// Thrown for a failure retrying cannot fix (a reviewer's verdict, a write
// outside scope). `kind` lets the run loop decide between rework and fail.
class StageVerdictError extends Error {
  constructor(message, { kind, details = {} } = {}) {
    super(message);
    this.kind = kind;
    this.details = details;
    this.nonRetryable = true;
  }
}

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
  AWAITING_APPROVAL: "awaiting_approval",
});

export class WorkflowRun {
  constructor({ id, workflowId, featureDir, context, autoApprove = false }) {
    this.id = id;
    this.workflowId = workflowId;
    this.featureDir = featureDir;
    this.context = context;
    this.autoApprove = autoApprove;
    // Rework bookkeeping: rounds used per reviewing stage, the feedback the
    // re-run stages receive, and an append-only history for the report.
    this.reworkRounds = {};
    this.feedback = null;
    this.pendingApproval = null;
    this.approvals = {};
    this.history = [];
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
      autoApprove: this.autoApprove,
      status: this.status,
      currentStageIndex: this.currentStageIndex,
      stageResults: this.stageResults,
      reworkRounds: this.reworkRounds,
      feedback: this.feedback,
      pendingApproval: this.pendingApproval,
      approvals: this.approvals,
      history: this.history,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      error: this.error,
    };
  }

  static fromCheckpoint(data) {
    const run = new WorkflowRun({
      id: data.id,
      workflowId: data.workflowId,
      featureDir: data.featureDir,
      context: data.context,
      autoApprove: data.autoApprove ?? false,
    });
    Object.assign(run, {
      status: data.status,
      currentStageIndex: data.currentStageIndex,
      stageResults: data.stageResults,
      reworkRounds: data.reworkRounds ?? {},
      feedback: data.feedback ?? null,
      pendingApproval: data.pendingApproval ?? null,
      approvals: data.approvals ?? {},
      history: data.history ?? [],
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
    validationPipeline = null,
    onApproval = null,
    logger = null,
    config = {},
  }) {
    this.workflowRegistry = workflowRegistry;
    this.agentRuntime = agentRuntime;
    this.artifactManager = artifactManager;
    this.memoryManager = memoryManager;
    this.toolRuntime = toolRuntime;
    this.checkpointStore = checkpointStore;
    this.validationPipeline = validationPipeline;
    // async ({ run, stage, stageResult }) => { approved: boolean, reason?, by? }
    // Set by an interactive CLI; when null, approval requests park the run.
    this.onApproval = onApproval;
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

  // Records a human decision on a run parked in awaiting_approval. The
  // decision is persisted in the checkpoint; call run(..., {resumeFromRunId})
  // afterwards to act on it (the CLI's `adf approve` does both).
  decideApproval(runId, { approved, reason = null, by = null } = {}) {
    const checkpoint = this.checkpointStore.load(runId);
    if (!checkpoint) throw new Error(`No checkpoint found for run "${runId}"`);
    if (checkpoint.status !== RUN_STATES.AWAITING_APPROVAL || !checkpoint.pendingApproval) {
      throw new Error(`Run "${runId}" is "${checkpoint.status}", not awaiting approval`);
    }
    if (!approved && !reason) throw new Error("Rejecting a stage requires a reason (it is sent back to the agent as feedback)");
    const stageId = checkpoint.pendingApproval.stageId;
    checkpoint.approvals = checkpoint.approvals ?? {};
    checkpoint.approvals[stageId] = { approved: Boolean(approved), reason, by, decidedAt: new Date().toISOString() };
    this.checkpointStore.save(runId, checkpoint);
    return { runId, stageId, approved: Boolean(approved) };
  }

  async run(workflowId, { runId = null, featureDir = null, context = {}, resumeFromRunId = null, autoApprove = false } = {}) {
    const definition = parseWorkflow(this.workflowRegistry.get(workflowId).raw);

    let run;
    if (resumeFromRunId) {
      const checkpoint = this.checkpointStore.load(resumeFromRunId);
      if (!checkpoint) throw new Error(`No checkpoint found for run "${resumeFromRunId}"`);
      if (checkpoint.workflowId !== workflowId) {
        throw new Error(`Checkpoint "${resumeFromRunId}" belongs to workflow "${checkpoint.workflowId}", not "${workflowId}"`);
      }
      run = WorkflowRun.fromCheckpoint(checkpoint);
      if (autoApprove) run.autoApprove = true;
      this.logger?.info?.(`Resuming workflow run "${run.id}" from stage index ${run.currentStageIndex}`, {
        workflowRunId: run.id,
      });
    } else {
      run = new WorkflowRun({ id: runId ?? crypto.randomUUID(), workflowId, featureDir, context, autoApprove });
    }
    this._runs.set(run.id, run);
    // Workflow-level `track:` (e.g. quick-change) is stated in every task
    // so agents know which upstream documents to expect.
    run._track = definition.track;

    run.status = RUN_STATES.RUNNING;
    run.error = null;
    if (!run.startedAt) run.startedAt = new Date().toISOString();
    this.logger?.info?.(`Workflow "${workflowId}" run "${run.id}" started`, { workflowRunId: run.id });

    const cancelNow = () => {
      run.status = RUN_STATES.CANCELLED;
      run.endedAt = new Date().toISOString();
      this._checkpoint(run);
      this.logger?.warn?.(`Workflow run "${run.id}" cancelled`, { workflowRunId: run.id });
      return run.toCheckpoint();
    };
    const failNow = (message) => {
      run.status = RUN_STATES.FAILED;
      run.error = message;
      run.endedAt = new Date().toISOString();
      this._checkpoint(run);
      this.logger?.error?.(`Workflow run "${run.id}" failed: ${message}`, { workflowRunId: run.id });
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

      // A run parked on a human decision resumes here, without re-running
      // the stage that is waiting to be approved.
      if (run.pendingApproval?.stageId === stage.id) {
        const outcome = await this._resolveApproval(run, stage, definition);
        if (outcome === "pending") return this._park(run, stage);
        if (outcome === "failed") return failNow(run.error);
        continue; // approved (index advanced) or rejected (index rewound)
      }

      // Feedback applies only to the stages being redone; once the stage
      // that asked for the rework comes round again it is re-judged fresh.
      if (run.feedback && run.currentStageIndex >= run.feedback.untilIndex) run.feedback = null;

      const stageResult = await this._runStage(stage, run);
      run.stageResults[stage.id] = stageResult;

      if (!stageResult.passed) {
        const rework = this._planRework(stage, stageResult, run, definition);
        if (rework.ok) {
          this._checkpoint(run);
          continue;
        }
        return failNow(rework.error ?? stageResult.error ?? "stage gate failed");
      }

      if (!stageResult.skipped && !run.autoApprove && definition.requiresApproval(stage) && this._approvalMode() !== "auto") {
        run.pendingApproval = { stageId: stage.id, index: run.currentStageIndex, requestedAt: new Date().toISOString() };
        const outcome = await this._resolveApproval(run, stage, definition);
        if (outcome === "pending") return this._park(run, stage);
        if (outcome === "failed") return failNow(run.error);
        continue;
      }
      if (!stageResult.skipped && definition.requiresApproval(stage)) {
        this.logger?.warn?.(`Stage "${stage.id}" auto-approved (approvals disabled for this run)`, { workflowRunId: run.id });
        run.history.push({ type: "approval", stageId: stage.id, approved: true, by: "auto", at: new Date().toISOString() });
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

  _approvalMode() {
    return this.config.workflow?.approvals ?? "workflow";
  }

  _park(run, stage) {
    run.status = RUN_STATES.AWAITING_APPROVAL;
    this._checkpoint(run);
    this.logger?.info?.(
      `Workflow run "${run.id}" awaiting human approval of stage "${stage.id}" (adf approve ${run.id} [--reject --reason ...])`,
      { workflowRunId: run.id }
    );
    return run.toCheckpoint();
  }

  // Returns "approved" | "rejected" | "pending" | "failed" and moves the
  // run's stage index accordingly.
  async _resolveApproval(run, stage, definition) {
    let decision = run.approvals[stage.id] ?? null;
    if (!decision && this.onApproval) {
      // null/undefined = "not now": the run parks, as with no approver.
      const answer = await this.onApproval({ run, stage, stageResult: run.stageResults[stage.id] });
      if (answer) {
        decision = { approved: Boolean(answer.approved), reason: answer.reason ?? null, by: answer.by ?? "interactive", decidedAt: new Date().toISOString() };
      }
    }
    if (!decision) return "pending";

    delete run.approvals[stage.id];
    run.pendingApproval = null;
    run.history.push({ type: "approval", stageId: stage.id, ...decision });

    if (decision.approved) {
      this.logger?.info?.(`Stage "${stage.id}" approved by ${decision.by ?? "human"}`, { workflowRunId: run.id });
      run.currentStageIndex++;
      this._checkpoint(run);
      return "approved";
    }

    // A human rejection is rework of the stage itself, with the human's
    // reason as the feedback, under the same round limit as a reviewer's.
    const key = `human:${stage.id}`;
    const used = run.reworkRounds[key] ?? 0;
    const max = this._maxRounds(stage);
    if (used >= max) {
      run.error = `Stage "${stage.id}" rejected by a human and its rework limit (${max}) is used up — needs a human decision`;
      return "failed";
    }
    run.reworkRounds[key] = used + 1;
    const index = definition.indexOf(stage.id);
    run.feedback = {
      fromStage: "human",
      round: used + 1,
      reviewArtifacts: [],
      reasons: [decision.reason ?? "rejected without a reason"],
      untilIndex: index + 1,
    };
    run.currentStageIndex = index;
    this.logger?.warn?.(`Stage "${stage.id}" rejected by a human; re-running it with feedback (round ${used + 1}/${max})`, {
      workflowRunId: run.id,
    });
    this._checkpoint(run);
    return "rejected";
  }

  _maxRounds(stage) {
    return stage.onFail?.maxRounds ?? this.config.workflow?.maxReworkRounds ?? 2;
  }

  // Decides whether a failed stage can send its findings back to an
  // earlier author stage instead of failing the run.
  _planRework(stage, stageResult, run, definition) {
    if (!stage.onFail || !stageResult.reworkable) return { ok: false };
    const used = run.reworkRounds[stage.id] ?? 0;
    const max = this._maxRounds(stage);
    if (used >= max) {
      return {
        ok: false,
        error: `${stageResult.error} — rework limit (${max} round${max === 1 ? "" : "s"}) reached, needs a human decision`,
      };
    }
    const targetIndex = definition.indexOf(stage.onFail.rework);
    const reviewIndex = definition.indexOf(stage.id);
    run.reworkRounds[stage.id] = used + 1;
    run.feedback = {
      fromStage: stage.id,
      round: used + 1,
      reviewArtifacts: stage.produces ?? [],
      reasons: [stageResult.error].filter(Boolean),
      untilIndex: reviewIndex,
    };
    run.history.push({
      type: "rework",
      fromStage: stage.id,
      toStage: stage.onFail.rework,
      round: used + 1,
      reason: stageResult.error,
      at: new Date().toISOString(),
    });
    run.currentStageIndex = targetIndex;
    this.logger?.warn?.(
      `Stage "${stage.id}" did not pass (${stageResult.error}); sending findings back to "${stage.onFail.rework}" (round ${used + 1}/${max})`,
      { workflowRunId: run.id }
    );
    return { ok: true };
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

  async _runStage(stage, run, { inParallel = false } = {}) {
    if (!this._evaluateCondition(stage.condition, run)) {
      this.logger?.info?.(`Skipping stage "${stage.id}" (condition not met)`, { workflowRunId: run.id });
      return { stageId: stage.id, status: "skipped", passed: true, skipped: true };
    }

    if (stage.type === STAGE_TYPES.PARALLEL) {
      return this._runParallelStage(stage, run);
    }
    if (stage.type === STAGE_TYPES.GATE_ONLY) {
      const gateCheck = evaluateGate(stage.gate, { featureDir: run.featureDir });
      let error = gateCheck.passed ? null : gateCheck.reasons.join("; ");
      let checks = null;
      if (gateCheck.passed && stage.gate?.checks?.length) {
        checks = await this._runChecks(stage.gate.checks, run, stage.id);
        if (!checks.passed) error = checks.summary;
      }
      const passed = !error;
      return { stageId: stage.id, status: passed ? "completed" : "failed", passed, error, checks, statuses: gateCheck.statuses };
    }
    return this._runAgentStage(stage, run, { inParallel });
  }

  _writeScopeConfig() {
    const cfg = this.config.guardrails?.writeScope ?? {};
    return { enabled: Boolean(cfg.enabled), onViolation: cfg.onViolation ?? "fail", aliases: cfg.pathAliases ?? {}, alwaysAllowed: cfg.alwaysAllowed ?? [] };
  }

  _repoRoot() {
    return this.config.repoRoot ?? REPO_ROOT;
  }

  _snapshot() {
    if (!this._writeScopeConfig().enabled) return null;
    const snapshot = snapshotWorkingTree(this._repoRoot());
    if (!snapshot) this.logger?.warn?.("Write-scope check skipped: not a git work tree", {});
    return snapshot;
  }

  // Compares the tree against `snapshot` and checks every changed file
  // against the union of `agentIds`' write scopes. Returns null when the
  // check is disabled, else { changed, violations, reverted? }.
  _checkScope(snapshot, agentIds, run) {
    if (!snapshot) return null;
    const cfg = this._writeScopeConfig();
    const scopes = agentIds.map((id) =>
      resolveWriteScope(this.agentRuntime.agentRegistry.get(id), { featureDir: run.featureDir, aliases: cfg.aliases, root: this._repoRoot() })
    );
    const alwaysAllowed = compileScopeEntries(cfg.alwaysAllowed, { featureDir: run.featureDir, aliases: cfg.aliases, root: this._repoRoot() });
    const changed = changedSince(snapshot);
    const violations = checkWriteScope(changed, scopes.filter((s) => s.declared), { alwaysAllowed });
    // An agent with no permissions.write block at all can't be enforced;
    // say so rather than silently passing everything.
    for (const scope of scopes.filter((s) => !s.declared)) {
      this.logger?.warn?.(`Write-scope: agent "${scope.agentId}" declares no permissions.write; its writes are not enforced`, {});
    }
    if (scopes.every((s) => !s.declared)) return { changed, violations: [] };
    const outcome = { changed, violations };
    if (violations.length && cfg.onViolation === "revert") {
      outcome.reverted = revertPaths(snapshot, violations.map((v) => v.path));
    }
    return outcome;
  }

  async _runChecks(stepIds, run, stageId) {
    if (!this.validationPipeline) {
      const strict = Boolean(this.config.workflow?.strictChecks);
      return {
        passed: !strict,
        results: [],
        summary: strict ? `gate checks [${stepIds.join(", ")}] could not run: no validation pipeline` : "no validation pipeline (checks not run)",
        unverified: stepIds,
      };
    }
    const result = await this.validationPipeline.run({ stages: stepIds, continueOnFailure: true, agentId: "validation-pipeline" });
    // A typo in a workflow's gate.checks must not quietly pass the gate.
    for (const r of result.results) {
      if (r.result === "skipped" && !(r.step in (this.validationPipeline.stepsConfig ?? {}))) {
        r.result = "failed";
        r.reason = `unknown validation step "${r.step}" (not in config/validation-steps.json)`;
      }
    }
    const failed = result.results.filter((r) => r.result === "failed");
    const skipped = result.results.filter((r) => r.result === "skipped").map((r) => r.step);
    const strict = Boolean(this.config.workflow?.strictChecks);
    if (skipped.length) {
      this.logger?.warn?.(
        `Stage "${stageId}": gate check(s) ${skipped.join(", ")} have no command configured in config/validation-steps.json — not verified`,
        { workflowRunId: run.id }
      );
    }
    const passed = failed.length === 0 && !(strict && skipped.length);
    const parts = failed.map((r) => {
      const output = `${r.stderr ?? ""}${r.stdout ?? ""}`.trim().split("\n").slice(-15).join("\n");
      return `check "${r.step}" failed${r.exitCode != null ? ` (exit ${r.exitCode})` : ""}${r.reason ? `: ${r.reason}` : ""}${output ? `\n${output}` : ""}`;
    });
    if (strict && skipped.length) parts.push(`check(s) ${skipped.join(", ")} not configured (workflow.strictChecks is on)`);
    return {
      passed,
      summary: parts.join("\n"),
      unverified: skipped,
      results: result.results.map((r) => ({ step: r.step, result: r.result, exitCode: r.exitCode ?? null })),
    };
  }

  async _runParallelStage(stage, run) {
    // Branches share one working tree, so write scope and deterministic
    // checks are evaluated once, after every branch has finished.
    const snapshot = this._snapshot();
    const results = await Promise.allSettled(stage.branches.map((branch) => this._runStage(branch, run, { inParallel: true })));
    const branchResults = results.map((r, i) => (r.status === "fulfilled" ? r.value : { stageId: stage.branches[i].id, status: "failed", passed: false, error: r.reason?.message ?? String(r.reason) }));
    for (const branchResult of branchResults) {
      run.stageResults[branchResult.stageId] = branchResult;
    }
    const failedBranches = branchResults.filter((r) => !r.passed);
    let error = failedBranches.length
      ? `branch(es) failed: ${failedBranches.map((r) => `${r.stageId} (${r.error})`).join(", ")}`
      : null;
    const reworkable = failedBranches.length > 0 && failedBranches.every((r) => r.reworkable);

    const ranAgents = stage.branches.filter((b, i) => b.agent && !branchResults[i].skipped).map((b) => b.agent);
    const writeScope = this._checkScope(snapshot, ranAgents, run);
    if (!error && writeScope?.violations.length) {
      error = `write outside permitted scope: ${writeScope.violations.map((v) => `${v.path} (${v.reason})`).join("; ")}`;
    }

    let checks = null;
    const checkIds = [...new Set([...(stage.gate?.checks ?? []), ...stage.branches.flatMap((b) => b.gate?.checks ?? [])])];
    if (!error && checkIds.length) {
      checks = await this._runChecks(checkIds, run, stage.id);
      if (!checks.passed) error = checks.summary;
    }

    const passed = !error;
    return {
      stageId: stage.id,
      status: passed ? "completed" : "failed",
      passed,
      reworkable: reworkable || Boolean(checks && !checks.passed),
      error,
      branches: branchResults,
      writeScope,
      checks,
    };
  }

  // The prose appended to an agent's task when it is re-run because a
  // reviewer (or a human) sent its work back, or its previous attempt at
  // this same stage failed.
  _feedbackText(run, previousFailure) {
    const sections = [];
    if (run.feedback) {
      const fb = run.feedback;
      const from = fb.fromStage === "human" ? "a human approver" : `the "${fb.fromStage}" stage`;
      sections.push(
        [
          `## Rework request (round ${fb.round})`,
          `Your previous output was sent back by ${from}. Update your own existing artifact(s)` +
            ` to resolve every blocking finding that falls within your scope; list findings outside` +
            ` your scope instead of fixing them. Do not edit the review artifact.`,
          fb.reviewArtifacts.length ? `Review artifact(s) with the findings: ${fb.reviewArtifacts.join(", ")}` : null,
          fb.reasons.length ? `Reason(s):\n${fb.reasons.map((r) => `- ${r}`).join("\n")}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
    if (previousFailure) {
      sections.push(`## Previous attempt failed\nYour previous attempt at this stage did not pass its gate:\n${previousFailure}`);
    }
    return sections.join("\n\n");
  }

  async _runAgentStage(stage, run, { inParallel = false } = {}) {
    const retryPolicy = new RetryPolicy(stage.retry ?? this.config.retry ?? {});
    const snapshot = inParallel ? null : this._snapshot();
    let retryCount = 0;
    let lastError = null;
    let outcome = null;
    let previousFailure = null;

    const baseDescription = [stage.description ?? run.context?.description ?? "", run._track ? `Track: ${run._track}` : null]
      .filter(Boolean)
      .join("\n\n");

    try {
      // The gate check lives *inside* the retried function, not after it.
      // A real (non-mock) executor completing without error is no
      // guarantee the agent actually produced a satisfying artifact --
      // an AI CLI can "complete" a turn having only described what it
      // would write. That deserves a retry (told why the last attempt
      // failed). A reviewer's verdict or a scope violation does not: those
      // throw StageVerdictError, which is never retried.
      outcome = await retryPolicy.execute(
        async () => {
          const feedback = this._feedbackText(run, previousFailure);
          const consumes = [...stage.consumes, ...(run.feedback?.reviewArtifacts ?? []).filter((a) => !stage.consumes.includes(a))];
          const execution = await this.agentRuntime.run(stage.agent, {
            workflowRunId: run.id,
            stageId: stage.id,
            featureDir: run.featureDir,
            consumesPaths: consumes,
            executorName: stage.executor,
            timeoutMs: stage.timeoutMs,
            task: {
              stageId: stage.id,
              produces: stage.produces,
              consumes,
              gateStatus: stage.gate?.status ?? null,
              description: [baseDescription, feedback].filter(Boolean).join("\n\n"),
              feedback: run.feedback,
            },
          });
          if (execution.status !== "completed") {
            throw new Error(`Agent "${stage.agent}" ended with status "${execution.status}": ${execution.error ?? ""}`);
          }

          const writeScope = this._checkScope(snapshot, [stage.agent], run);
          if (writeScope?.violations.length) {
            throw new StageVerdictError(
              `write outside permitted scope: ${writeScope.violations.map((v) => `${v.path} (${v.reason})`).join("; ")}`,
              { kind: "scope", details: { writeScope } }
            );
          }

          const gateCheck = evaluateGate(stage.gate, { featureDir: run.featureDir });
          if (gateCheck.rejected) {
            throw new StageVerdictError(`gate failed: ${gateCheck.reasons.join("; ")}`, { kind: "rejected", details: { gateCheck, writeScope } });
          }
          if (!gateCheck.passed) {
            throw new Error(`gate failed: ${gateCheck.reasons.join("; ")}`);
          }

          // Branch checks run once at the parallel level (shared tree).
          let checks = null;
          if (!inParallel && stage.gate?.checks?.length) {
            checks = await this._runChecks(stage.gate.checks, run, stage.id);
            if (!checks.passed) {
              const err = new Error(`gate checks failed: ${checks.summary}`);
              // On a review stage failing checks is a finding for the
              // author (tests the implementation broke), not something a
              // re-run of the reviewer can fix.
              if (stage.onFail) throw new StageVerdictError(err.message, { kind: "checks", details: { checks, writeScope } });
              throw err;
            }
          }
          return { execution, gateCheck, writeScope, checks };
        },
        {
          shouldRetry: (err) => !err.nonRetryable,
          onRetry: (err, attempt) => {
            retryCount = attempt;
            previousFailure = err.message;
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

    if (!outcome) {
      const reworkable = lastError?.kind === "rejected" || lastError?.kind === "checks";
      // Work headed back to its author for rework is not rolled back.
      const rollbackOutcome = reworkable && stage.onFail ? null : await this._runRollback(stage, run, lastError ?? new Error("gate failed"));
      return {
        stageId: stage.id,
        status: "failed",
        passed: false,
        error: lastError?.message ?? "unknown failure",
        // Rework only when the agent produced a verdict / the checks spoke;
        // crashes, timeouts and scope violations fail the run.
        reworkable,
        rejected: lastError?.kind === "rejected",
        retryCount,
        writeScope: lastError?.details?.writeScope ?? null,
        checks: lastError?.details?.checks ?? null,
        rollback: rollbackOutcome,
      };
    }

    return {
      stageId: stage.id,
      status: "completed",
      passed: true,
      retryCount,
      statuses: outcome.gateCheck.statuses,
      writeScope: outcome.writeScope,
      checks: outcome.checks,
      artifacts: outcome.execution.artifacts?.map((a) => a.id) ?? [],
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
