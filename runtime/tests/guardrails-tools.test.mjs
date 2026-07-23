import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PolicyEngine, PermissionDeniedError } from "../src/guardrails/policy-engine.mjs";
import { DangerousCommandGuard } from "../src/guardrails/dangerous-commands.mjs";
import { ToolRegistry, ToolDescriptor } from "../src/registry/tool-registry.mjs";
import { ToolRuntime } from "../src/tools/tool-runtime.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

function guardrailsFixture(overrides = {}) {
  return {
    defaultPolicy: "allow",
    toolPermissions: { terminal: "ask", github: "deny" },
    agentOverrides: { "qa-agent": { terminal: "deny" } },
    dangerousCommandPatterns: ["rm\\s+-rf\\s+/(?!\\S)"],
    approvalHooks: { autoApproveInNonInteractive: false },
    sandbox: { enabled: false, allowedWriteRoots: [] },
    ...overrides,
  };
}

test("DangerousCommandGuard matches configured patterns", () => {
  const guard = new DangerousCommandGuard(["rm\\s+-rf\\s+/(?!\\S)", "git\\s+push\\s+.*--force"]);
  assert.equal(guard.check("rm -rf /").dangerous, true);
  assert.equal(guard.check("git push origin main --force").dangerous, true);
  assert.equal(guard.check("ls -la").dangerous, false);
  assert.equal(guard.check(null).dangerous, false);
});

test("PolicyEngine resolves default, tool-level, then agent-override policy in that precedence", () => {
  const engine = new PolicyEngine({ guardrails: guardrailsFixture() });
  assert.equal(engine.policyFor("backend-agent", "fs"), "allow");
  assert.equal(engine.policyFor("backend-agent", "terminal"), "ask");
  assert.equal(engine.policyFor("qa-agent", "terminal"), "deny");
  assert.equal(engine.policyFor("backend-agent", "github"), "deny");
});

test("PolicyEngine.authorize denies a policy=deny tool", async () => {
  const engine = new PolicyEngine({ guardrails: guardrailsFixture() });
  await assert.rejects(
    () => engine.authorize({ agentId: "backend-agent", toolId: "github" }),
    PermissionDeniedError
  );
});

test("PolicyEngine.authorize blocks a dangerous command even when the tool policy is allow", async () => {
  const engine = new PolicyEngine({
    guardrails: guardrailsFixture({ toolPermissions: { terminal: "allow" } }),
  });
  await assert.rejects(
    () => engine.authorize({ agentId: "backend-agent", toolId: "terminal", command: "rm -rf /" }),
    PermissionDeniedError
  );
});

test("PolicyEngine.authorize resolves ask via the approval hook callback", async () => {
  const approve = new PolicyEngine({ guardrails: guardrailsFixture(), onAsk: async () => true });
  await assert.doesNotReject(() => approve.authorize({ agentId: "backend-agent", toolId: "terminal" }));

  const deny = new PolicyEngine({ guardrails: guardrailsFixture(), onAsk: async () => false });
  await assert.rejects(() => deny.authorize({ agentId: "backend-agent", toolId: "terminal" }), PermissionDeniedError);
});

test("PolicyEngine sandbox mode refuses writes outside allowed roots", async () => {
  const engine = new PolicyEngine({
    guardrails: guardrailsFixture({ sandbox: { enabled: true, allowedWriteRoots: ["features"] } }),
  });
  await assert.rejects(
    () => engine.authorize({ agentId: "backend-agent", toolId: "fs", writePath: "policies/security.md" }),
    PermissionDeniedError
  );
  await assert.doesNotReject(() =>
    engine.authorize({ agentId: "backend-agent", toolId: "fs", writePath: "features/x/spec.md" })
  );
});

test("ToolRuntime executes the fs tool and enforces the repo-root sandbox", async () => {
  const registry = new ToolRegistry();
  registry.register(new ToolDescriptor({ id: "fs", module: "fs-tool.mjs", timeoutMs: 5000, retries: 0 }));
  const policyEngine = new PolicyEngine({ guardrails: guardrailsFixture() });
  const runtime = new ToolRuntime({ toolRegistry: registry, policyEngine });

  const tmpFile = ".adf/__test_tool_runtime.txt";
  const write = await runtime.execute("fs", { action: "write", path: tmpFile, content: "abc" }, { agentId: "backend-agent" });
  assert.equal(write.ok, true);
  const read = await runtime.execute("fs", { action: "read", path: tmpFile }, { agentId: "backend-agent" });
  assert.equal(read.ok, true);
  assert.equal(read.result, "abc");
  fs.rmSync(path.join(REPO_ROOT, tmpFile), { force: true });

  const escape = await runtime.execute("fs", { action: "read", path: "../outside.txt" }, { agentId: "backend-agent" });
  assert.equal(escape.ok, false);
  assert.match(escape.error, /escapes the repository root/);
});

test("ToolRuntime returns ok:false (not a throw) when a tool is denied by policy", async () => {
  const registry = new ToolRegistry();
  registry.register(new ToolDescriptor({ id: "terminal", module: "terminal-tool.mjs" }));
  const policyEngine = new PolicyEngine({ guardrails: guardrailsFixture({ toolPermissions: { terminal: "deny" } }) });
  const runtime = new ToolRuntime({ toolRegistry: registry, policyEngine });

  const result = await runtime.execute("terminal", { command: "echo hi" }, { agentId: "backend-agent" });
  assert.equal(result.ok, false);
  assert.equal(result.isPermissionDenied, true);
});

function tmpFixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "adf-tool-fixtures-"));
}

test("ToolRuntime retries a failing tool up to the configured retry count", async () => {
  const fixtureDir = tmpFixtureDir();
  fs.writeFileSync(
    path.join(fixtureDir, "flaky-tool.mjs"),
    `let calls = 0;\nexport async function execute() { calls++; if (calls < 3) throw new Error("flaky failure " + calls); return { calls }; }\n`,
    "utf8"
  );
  const registry = new ToolRegistry();
  registry.register(
    new ToolDescriptor({ id: "flaky", module: path.join(fixtureDir, "flaky-tool.mjs"), retries: 2, timeoutMs: 1000 })
  );
  const policyEngine = new PolicyEngine({ guardrails: guardrailsFixture() });
  const runtime = new ToolRuntime({ toolRegistry: registry, policyEngine });

  const result = await runtime.execute("flaky", {}, { agentId: "backend-agent" });
  assert.equal(result.ok, true);
  assert.equal(result.attempts, 3);
  assert.equal(result.result.calls, 3);
});

test("ToolRuntime enforces a timeout on a slow tool", async () => {
  const fixtureDir = tmpFixtureDir();
  fs.writeFileSync(
    path.join(fixtureDir, "slow-tool.mjs"),
    `export async function execute() { await new Promise((r) => setTimeout(r, 500)); return "done"; }\n`,
    "utf8"
  );
  const registry = new ToolRegistry();
  registry.register(new ToolDescriptor({ id: "slow", module: path.join(fixtureDir, "slow-tool.mjs"), timeoutMs: 50, retries: 0 }));
  const policyEngine = new PolicyEngine({ guardrails: guardrailsFixture() });
  const runtime = new ToolRuntime({ toolRegistry: registry, policyEngine });

  const result = await runtime.execute("slow", {}, { agentId: "backend-agent" });
  assert.equal(result.ok, false);
  assert.match(result.error, /timed out/);
});

test("git tool reports the current branch inside the repo", async () => {
  const registry = new ToolRegistry();
  registry.register(new ToolDescriptor({ id: "git", module: "git-tool.mjs" }));
  const policyEngine = new PolicyEngine({ guardrails: guardrailsFixture() });
  const runtime = new ToolRuntime({ toolRegistry: registry, policyEngine });

  const result = await runtime.execute("git", { action: "currentBranch" }, { agentId: "backend-agent" });
  assert.equal(result.ok, true);
  assert.equal(typeof result.result, "string");
  assert.ok(result.result.length > 0);
});
