import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAgentRegistry } from "../src/registry/agent-registry.mjs";
import { ArtifactManager } from "../src/artifacts/artifact-manager.mjs";
import { MemoryManager } from "../src/memory/memory-store.mjs";
import { ContextManager } from "../src/context/context-manager.mjs";
import { AgentRuntime } from "../src/runtime/agent-runtime.mjs";
import { MockExecutor } from "../src/executors/mock-executor.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

function buildRuntime(overrides = {}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adf-agent-runtime-"));
  const agentRegistry = loadAgentRegistry();
  const artifactManager = new ArtifactManager({ stateDir: path.join(tmpRoot, "artifacts"), repoRoot: REPO_ROOT });
  const memoryManager = new MemoryManager({ memoryDir: path.join(tmpRoot, "memory") });
  const contextManager = new ContextManager({ artifactManager, memoryManager, maxContextChars: 500_000 });
  const runtime = new AgentRuntime({
    agentRegistry,
    contextManager,
    artifactManager,
    memoryManager,
    toolRuntime: null,
    logger: null,
    config: { runtime: { defaultExecutor: "mock", agentTimeoutMs: 5000, pauseCheckIntervalMs: 20, ...overrides } },
  });
  runtime.registerExecutor("mock", new MockExecutor());
  return { runtime, tmpRoot, artifactManager };
}

test("AgentRuntime runs an agent to completion and records the produced artifact", async () => {
  const { runtime, tmpRoot } = buildRuntime();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "feature"));
  const result = await runtime.run("feature-agent", {
    featureDir,
    task: { stageId: "feature", produces: ["specification.md"], gateStatus: "READY_FOR_PRODUCT_REVIEW" },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0].status, "draft");
  const written = fs.readFileSync(path.join(REPO_ROOT, featureDir, "specification.md"), "utf8");
  assert.ok(written.trim().endsWith("STATUS: READY_FOR_PRODUCT_REVIEW"));

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("AgentRuntime rejects an unknown agent id", async () => {
  const { runtime } = buildRuntime();
  await assert.rejects(() => runtime.run("nonexistent-agent", {}), /Unknown agent/);
});

test("AgentRuntime pause/resume actually halts and continues a running execution", async () => {
  const { runtime } = buildRuntime();
  runtime.registerExecutor("stepping", new MockExecutor({ simulateSteps: 8, stepDelayMs: 30 }));

  const runPromise = runtime.run("qa-agent", { executorName: "stepping", task: { stageId: "qa", produces: [] } });
  await new Promise((r) => setTimeout(r, 40));
  const running = runtime.listExecutions().find((e) => e.status === "running");
  assert.ok(running, "expected a running execution");

  runtime.pause(running.id);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(runtime.getExecution(running.id).state.status, "paused");

  runtime.resume(running.id);
  const result = await runPromise;
  assert.equal(result.status, "completed");
});

test("AgentRuntime cancel stops a running execution", async () => {
  const { runtime } = buildRuntime();
  runtime.registerExecutor("stepping", new MockExecutor({ simulateSteps: 20, stepDelayMs: 30 }));

  const runPromise = runtime.run("qa-agent", { executorName: "stepping", task: { stageId: "qa", produces: [] } });
  await new Promise((r) => setTimeout(r, 40));
  const running = runtime.listExecutions().find((e) => e.status === "running");
  runtime.cancel(running.id);

  const result = await runPromise;
  assert.equal(result.status, "cancelled");
});

test("AgentRuntime enforces a timeout and transitions to the timeout state", async () => {
  const { runtime } = buildRuntime({ agentTimeoutMs: 25 });
  runtime.registerExecutor("stepping", new MockExecutor({ simulateSteps: 20, stepDelayMs: 30 }));

  const result = await runtime.run("qa-agent", { executorName: "stepping", task: { stageId: "qa", produces: [] } });
  assert.equal(result.status, "timeout");
  assert.match(result.error, /timed out/);
});

test("ExecutionState rejects invalid transitions", async () => {
  const { runtime } = buildRuntime();
  const result = await runtime.run("feature-agent", { task: { stageId: "feature", produces: [] } });
  const entry = runtime.getExecution(result.id);
  assert.throws(() => entry.state.transition("running"), /Invalid execution state transition/);
});
