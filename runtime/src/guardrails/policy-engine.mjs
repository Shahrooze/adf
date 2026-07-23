// Guardrails: the single place that decides whether an agent is allowed to
// invoke a tool. Backed entirely by config/guardrails.json (defaultPolicy,
// per-tool policy, per-agent overrides, sandbox write roots) — nothing
// here is hardcoded per agent or per tool.
import path from "node:path";
import { DangerousCommandGuard } from "./dangerous-commands.mjs";
import { ApprovalHook } from "./approval-hook.mjs";
import { REPO_ROOT } from "../config/paths.mjs";

export class PermissionDeniedError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "PermissionDeniedError";
    this.details = details;
  }
}

export const POLICY_VALUES = ["allow", "deny", "ask"];

export class PolicyEngine {
  constructor({ guardrails, logger = null, onAsk = null }) {
    this.guardrails = guardrails;
    this.logger = logger;
    this.dangerousCommandGuard = new DangerousCommandGuard(guardrails.dangerousCommandPatterns);
    this.approvalHook = new ApprovalHook({ config: guardrails.approvalHooks, logger, onAsk });
  }

  // Pure decision (no side effects): "allow" | "deny" | "ask".
  policyFor(agentId, toolId) {
    const override = this.guardrails.agentOverrides?.[agentId]?.[toolId];
    if (override) return override;
    const toolPolicy = this.guardrails.toolPermissions?.[toolId];
    if (toolPolicy) return toolPolicy;
    return this.guardrails.defaultPolicy ?? "allow";
  }

  // Full authorization check, including the hard dangerous-command guard
  // and (for "ask") resolving the approval hook. Throws
  // PermissionDeniedError when access is refused.
  async authorize({ agentId, toolId, command = null, writePath = null }) {
    if (command) {
      const danger = this.dangerousCommandGuard.check(command);
      if (danger.dangerous) {
        this.logger?.error?.(`Blocked dangerous command for agent="${agentId}" tool="${toolId}"`, {
          agentId,
          error: `matched pattern: ${danger.pattern}`,
        });
        throw new PermissionDeniedError(
          `Command blocked by dangerous-command guard (pattern: ${danger.pattern})`,
          { agentId, toolId, command, pattern: danger.pattern }
        );
      }
    }

    if (writePath) {
      const sandboxCheck = this.checkSandboxWrite(writePath);
      if (!sandboxCheck.allowed) {
        throw new PermissionDeniedError(`Write path outside sandbox: ${writePath}`, {
          agentId,
          toolId,
          writePath,
        });
      }
    }

    const policy = this.policyFor(agentId, toolId);
    if (policy === "deny") {
      throw new PermissionDeniedError(`Tool "${toolId}" denied for agent "${agentId}" by policy`, {
        agentId,
        toolId,
        policy,
      });
    }
    if (policy === "ask") {
      const approved = await this.approvalHook.request({ agentId, toolId, reason: "policy=ask" });
      if (!approved) {
        throw new PermissionDeniedError(`Tool "${toolId}" not approved for agent "${agentId}"`, {
          agentId,
          toolId,
          policy,
        });
      }
    }
    return true;
  }

  checkSandboxWrite(writePath) {
    const sandbox = this.guardrails.sandbox ?? { enabled: false };
    if (!sandbox.enabled) return { allowed: true };
    const abs = path.isAbsolute(writePath) ? writePath : path.join(REPO_ROOT, writePath);
    const rel = path.relative(REPO_ROOT, abs);
    if (rel.startsWith("..")) return { allowed: false };
    const allowed = (sandbox.allowedWriteRoots ?? []).some(
      (root) => rel === root || rel.startsWith(root + path.sep) || rel.startsWith(root + "/")
    );
    return { allowed };
  }
}
