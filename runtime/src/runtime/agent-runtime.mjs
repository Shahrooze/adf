// The Agent Runtime is where agents stop being "a markdown prompt a human
// pastes into an AI CLI" and become something the Harness itself executes,
// tracks, and can pause/resume/cancel/timeout. It owns the execution loop:
// build context -> hand off to a pluggable executor -> stream progress ->
// record whatever artifacts the executor produced.
//
// Agents themselves stay "dumb": all of the coordination intelligence
// (context assembly, permission checks the tools it calls go through,
// state machine, artifact bookkeeping) lives here, not in agents/*.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { ExecutionState, AGENT_STATES } from "./execution-state.mjs";
import { REPO_ROOT } from "../config/paths.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AgentRuntime {
  constructor({
    agentRegistry,
    contextManager,
    artifactManager,
    memoryManager,
    toolRuntime,
    logger = null,
    config = {},
  }) {
    this.agentRegistry = agentRegistry;
    this.contextManager = contextManager;
    this.artifactManager = artifactManager;
    this.memoryManager = memoryManager;
    this.toolRuntime = toolRuntime;
    this.logger = logger;
    this.config = config;
    this.executors = new Map();
    this._executions = new Map();
  }

  registerExecutor(name, executor) {
    this.executors.set(name, executor);
    return this;
  }

  resolveExecutor(name) {
    const key = name ?? this.config.runtime?.defaultExecutor ?? "mock";
    const executor = this.executors.get(key);
    if (!executor) {
      throw new Error(`Unknown executor "${key}". Registered: ${[...this.executors.keys()].join(", ") || "(none)"}`);
    }
    return executor;
  }

  getExecution(executionId) {
    const entry = this._executions.get(executionId);
    if (!entry) throw new Error(`Unknown execution "${executionId}"`);
    return entry;
  }

  listExecutions() {
    return [...this._executions.values()].map((e) => e.state.toJSON());
  }

  pause(executionId) {
    const entry = this.getExecution(executionId);
    entry.state.requestPause();
    entry.executor.pause?.(executionId);
    return true;
  }

  resume(executionId) {
    const entry = this.getExecution(executionId);
    entry.state.clearPause();
    entry.executor.resume?.(executionId);
    return true;
  }

  cancel(executionId) {
    const entry = this.getExecution(executionId);
    entry.state.requestCancel();
    entry.executor.cancel?.(executionId);
    return true;
  }

  async run(
    agentId,
    {
      workflowRunId = null,
      stageId = null,
      featureDir = null,
      consumesPaths = null,
      task = {},
      executorName = null,
      timeoutMs = null,
      author = null,
    } = {}
  ) {
    const agent = this.agentRegistry.get(agentId);
    const executor = this.resolveExecutor(executorName);
    const executionId = crypto.randomUUID();
    const state = new ExecutionState({ id: executionId, agentId, workflowRunId, stageId });
    this._executions.set(executionId, { state, executor });

    const effectiveTimeout = timeoutMs ?? this.config.runtime?.agentTimeoutMs ?? 600000;
    const pauseCheckIntervalMs = this.config.runtime?.pauseCheckIntervalMs ?? 250;

    const contextBundle = this.contextManager.build({
      agent,
      workflowRunId,
      featureDir,
      consumesPaths: consumesPaths ?? agent.consumes ?? [],
    });

    const controller = new AbortController();
    let timedOut = false;
    const timer = effectiveTimeout
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
          executor.cancel?.(executionId);
        }, effectiveTimeout)
      : null;

    state.transition(AGENT_STATES.RUNNING);
    this.logger?.info?.(`Agent "${agentId}" started`, { agentId, workflowRunId });

    let finalEvent = null;
    try {
      const iterator = executor.run({
        agent,
        task,
        contextBundle,
        toolRuntime: this.toolRuntime,
        agentId,
        signal: controller.signal,
        executionId,
        logger: this.logger,
      });

      for await (const event of iterator) {
        if (state.isCancelRequested()) break;

        while (state.isPauseRequested()) {
          if (state.status !== AGENT_STATES.PAUSED) {
            state.transition(AGENT_STATES.PAUSED);
            this.logger?.info?.(`Agent "${agentId}" paused`, { agentId, workflowRunId });
          }
          await sleep(pauseCheckIntervalMs);
          if (state.isCancelRequested()) break;
        }
        if (state.isCancelRequested()) break;

        if (state.status === AGENT_STATES.PAUSED) {
          state.transition(AGENT_STATES.RUNNING);
          this.logger?.info?.(`Agent "${agentId}" resumed`, { agentId, workflowRunId });
        }

        if (event.type === "progress") {
          state.addProgress(event.message);
        } else if (event.type === "result") {
          finalEvent = event;
        }
      }
    } catch (err) {
      clearTimeout(timer);
      if (timedOut) {
        state.error = `Agent execution timed out after ${effectiveTimeout}ms`;
        state.transition(AGENT_STATES.TIMEOUT);
      } else {
        state.error = err.message;
        state.transition(AGENT_STATES.FAILED);
      }
      this.logger?.error?.(`Agent "${agentId}" ${state.status}: ${err.message}`, {
        agentId,
        workflowRunId,
        error: err.message,
        durationMs: state.durationMs(),
      });
      return state.toJSON();
    }
    clearTimeout(timer);

    if (state.isCancelRequested()) {
      state.transition(AGENT_STATES.CANCELLED);
      this.logger?.warn?.(`Agent "${agentId}" cancelled`, { agentId, workflowRunId });
      return state.toJSON();
    }
    if (timedOut) {
      state.error = `Agent execution timed out after ${effectiveTimeout}ms`;
      state.transition(AGENT_STATES.TIMEOUT);
      this.logger?.error?.(`Agent "${agentId}" timed out`, { agentId, workflowRunId });
      return state.toJSON();
    }

    const producedRecords = this._recordArtifacts({ agent, task, featureDir, finalEvent, workflowRunId, author });
    state.result = { content: finalEvent?.content ?? null, artifacts: producedRecords };
    state.transition(AGENT_STATES.COMPLETED);
    this.logger?.info?.(`Agent "${agentId}" completed`, {
      agentId,
      workflowRunId,
      durationMs: state.durationMs(),
      artifacts: producedRecords.map((a) => a.id),
    });
    const json = state.toJSON();
    json.artifacts = producedRecords;
    json.content = state.result.content;
    return json;
  }

  _recordArtifacts({ agent, task, featureDir, finalEvent, workflowRunId, author }) {
    const produces = task.produces ?? agent.outputs ?? [];
    const byFilename = new Map((finalEvent?.artifacts ?? []).map((a) => [a.filename, a]));
    const records = [];

    for (const filename of produces) {
      const executorArtifact = byFilename.get(filename);
      const relPath = featureDir ? path.join(featureDir, filename) : filename;
      const absPath = path.join(REPO_ROOT, relPath);

      if (executorArtifact?.content != null) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, executorArtifact.content, "utf8");
      } else if (!fs.existsSync(absPath)) {
        continue; // Not a document this executor produced content for, and nothing on disk to track.
      }

      const record = this.artifactManager.recordFromFile(absPath, {
        type: executorArtifact?.type ?? filename.replace(/\.md$/, ""),
        author: author ?? agent.id,
        dependencies: task.consumes ?? agent.consumes ?? [],
        status: "draft",
        workflowRunId,
      });
      records.push(record);
    }
    return records;
  }
}
