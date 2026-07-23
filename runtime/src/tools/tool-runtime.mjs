// The Tool Runtime is the single execution path every tool call goes
// through: it resolves the tool from the registry, enforces guardrails
// (permission + dangerous-command + sandbox checks) exactly once per call,
// then runs the tool's own execute() under a timeout with a bounded number
// of retries. Every attempt is logged so `adf logs` sees every tool call a
// workflow run made, successful or not.
import { PermissionDeniedError } from "../guardrails/policy-engine.mjs";
import { REPO_ROOT } from "../config/paths.mjs";

function summarizeArgs(args) {
  const clone = { ...args };
  for (const key of Object.keys(clone)) {
    if (typeof clone[key] === "string" && clone[key].length > 200) {
      clone[key] = clone[key].slice(0, 200) + "…";
    }
  }
  return clone;
}

export class ToolExecutionError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ToolExecutionError";
    this.details = details;
  }
}

export class ToolRuntime {
  constructor({ toolRegistry, policyEngine, logger = null }) {
    this.toolRegistry = toolRegistry;
    this.policyEngine = policyEngine;
    this.logger = logger;
  }

  async _withTimeout(promise, ms, toolId, signal) {
    if (!ms) return promise;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Tool "${toolId}" timed out after ${ms}ms`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async execute(toolId, args = {}, { agentId = "unknown", workflowRunId = null, cwd = REPO_ROOT, timeoutMs, retries, signal } = {}) {
    const descriptor = this.toolRegistry.get(toolId);
    const effectiveTimeout = timeoutMs ?? descriptor.timeoutMs;
    const maxAttempts = (retries ?? descriptor.retries) + 1;
    const start = Date.now();

    try {
      await this.policyEngine.authorize({
        agentId,
        toolId,
        command: args.command ?? null,
        writePath: args.writePath ?? null,
      });
    } catch (err) {
      const durationMs = Date.now() - start;
      this.logger?.error?.(`Tool "${toolId}" denied: ${err.message}`, { agentId, workflowRunId, error: err.message, durationMs });
      return {
        ok: false,
        toolId,
        error: err.message,
        isPermissionDenied: err instanceof PermissionDeniedError,
        durationMs,
        attempts: 0,
      };
    }

    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const mod = await descriptor.load();
        const result = await this._withTimeout(
          mod.execute(args, { agentId, cwd, logger: this.logger, signal }),
          effectiveTimeout,
          toolId,
          signal
        );
        const durationMs = Date.now() - start;
        this.logger?.info?.(`Tool "${toolId}" succeeded`, {
          agentId,
          workflowRunId,
          toolCalls: [{ toolId, args: summarizeArgs(args), attempt }],
          durationMs,
          retryCount: attempt - 1,
        });
        return { ok: true, toolId, result, durationMs, attempts: attempt };
      } catch (err) {
        lastError = err;
        this.logger?.warn?.(`Tool "${toolId}" attempt ${attempt}/${maxAttempts} failed: ${err.message}`, {
          agentId,
          workflowRunId,
          error: err.message,
          retryCount: attempt - 1,
        });
        if (err instanceof PermissionDeniedError) break;
      }
    }

    const durationMs = Date.now() - start;
    this.logger?.error?.(`Tool "${toolId}" failed after ${maxAttempts} attempt(s)`, {
      agentId,
      workflowRunId,
      error: lastError?.message,
      durationMs,
      retryCount: maxAttempts - 1,
    });
    return {
      ok: false,
      toolId,
      error: lastError?.message ?? "unknown error",
      isPermissionDenied: lastError instanceof PermissionDeniedError,
      durationMs,
      attempts: maxAttempts,
    };
  }
}
