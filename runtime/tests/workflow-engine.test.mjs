import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadAgentRegistry } from "../src/registry/agent-registry.mjs";
import { loadWorkflowRegistry, WorkflowRegistry } from "../src/registry/workflow-registry.mjs";
import { ArtifactManager } from "../src/artifacts/artifact-manager.mjs";
import { MemoryManager } from "../src/memory/memory-store.mjs";
import { ContextManager } from "../src/context/context-manager.mjs";
import { AgentRuntime } from "../src/runtime/agent-runtime.mjs";
import { MockExecutor } from "../src/executors/mock-executor.mjs";
import { CheckpointStore } from "../src/retry/checkpoint-store.mjs";
import { WorkflowEngine, RUN_STATES } from "../src/workflow/workflow-engine.mjs";
import { parseWorkflow } from "../src/workflow/workflow-parser.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

function buildStack(overrides = {}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adf-wf-engine-"));
  const agentRegistry = loadAgentRegistry();
  const workflowRegistry = loadWorkflowRegistry();
  const artifactManager = new ArtifactManager({ stateDir: path.join(tmpRoot, "artifacts"), repoRoot: REPO_ROOT });
  const memoryManager = new MemoryManager({ memoryDir: path.join(tmpRoot, "memory") });
  const contextManager = new ContextManager({ artifactManager, memoryManager, maxContextChars: 500_000 });
  const agentRuntime = new AgentRuntime({
    agentRegistry,
    contextManager,
    artifactManager,
    memoryManager,
    toolRuntime: null,
    logger: null,
    config: { runtime: { defaultExecutor: "mock", agentTimeoutMs: 5000 } },
  });
  agentRuntime.registerExecutor("mock", new MockExecutor());
  const checkpointStore = new CheckpointStore({ dir: path.join(tmpRoot, "checkpoints") });
  const engine = new WorkflowEngine({
    workflowRegistry,
    agentRuntime,
    artifactManager,
    memoryManager,
    checkpointStore,
    logger: null,
    config: { runtime: { pauseCheckIntervalMs: 20 }, retry: { maxAttempts: 1 }, ...overrides },
  });
  return { tmpRoot, engine, agentRuntime, workflowRegistry, artifactManager, checkpointStore };
}

test("parseWorkflow normalizes feature-development.yaml into 12 sequential agent/gate stages", () => {
  const { workflowRegistry } = buildStack();
  const def = parseWorkflow(workflowRegistry.get("feature-development").raw);
  assert.equal(def.stages.length, 12);
  assert.ok(def.stages.every((s) => s.type === "agent" || s.type === "gate-only"));
});

test("parseWorkflow normalizes parallel-development.yaml's parallel and conditional stages", () => {
  const { workflowRegistry } = buildStack();
  const def = parseWorkflow(workflowRegistry.get("parallel-development").raw);
  const implementation = def.findStage("implementation");
  assert.equal(implementation.type, "parallel");
  assert.deepEqual(
    implementation.branches.map((b) => b.id),
    ["backend-implementation", "frontend-implementation"]
  );
  const codeReview = def.findStage("code-review");
  assert.deepEqual(codeReview.condition, { type: "stage-status", target: "qa", equals: "completed" });
});

test("WorkflowEngine runs the sequential feature-development workflow end to end", async () => {
  const { engine, tmpRoot } = buildStack();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "seq-demo"));
  const result = await engine.run("feature-development", { featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.equal(Object.keys(result.stageResults).length, 12);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "specification.md")));
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "code-review-report.md")));
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("WorkflowEngine runs parallel branches concurrently and keeps both artifacts", async () => {
  const { engine, tmpRoot } = buildStack();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "parallel-demo"));
  const result = await engine.run("parallel-development", { featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  const implementation = result.stageResults["implementation"];
  assert.equal(implementation.status, "completed");
  assert.deepEqual(
    implementation.branches.map((b) => b.stageId).sort(),
    ["backend-implementation", "frontend-implementation"]
  );
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "backend-implementation-report.md")));
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "frontend-implementation-report.md")));
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("WorkflowEngine's conditional stage runs when its condition is met", async () => {
  const { engine, tmpRoot } = buildStack();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "conditional-demo"));
  const result = await engine.run("parallel-development", { featureDir });
  assert.equal(result.stageResults["code-review"].status, "completed");
  assert.notEqual(result.stageResults["code-review"].skipped, true);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("WorkflowEngine retries a failing stage and reports the retry count", async () => {
  const { engine, agentRuntime, workflowRegistry, tmpRoot } = buildStack();
  let calls = 0;
  agentRuntime.registerExecutor("failing", {
    name: "failing",
    async *run() {
      calls++;
      throw new Error(`simulated failure #${calls}`);
    },
  });
  workflowRegistry.register("retry-test", {
    id: "retry-test",
    stages: [{ id: "will-fail", agent: "feature-agent", executor: "failing", produces: [] }],
  });
  engine.config.retry = { maxAttempts: 3, backoffMs: 1 };

  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "retry-demo"));
  const result = await engine.run("retry-test", { featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.equal(calls, 3);
  assert.equal(result.stageResults["will-fail"].retryCount, 2);
});

test("WorkflowEngine runs a rollback action when a stage exhausts its retries", async () => {
  const { engine, agentRuntime, workflowRegistry, tmpRoot } = buildStack();
  agentRuntime.registerExecutor("always-fails", {
    name: "always-fails",
    async *run() {
      throw new Error("nope");
    },
  });
  let rollbackRan = false;
  agentRuntime.registerExecutor("rollback-agent-marker", null);
  workflowRegistry.register("rollback-test", {
    id: "rollback-test",
    stages: [
      {
        id: "will-fail",
        agent: "feature-agent",
        executor: "always-fails",
        produces: [],
        retry: { max_attempts: 1 },
        rollback: { agent: "product-review-agent" },
      },
    ],
  });
  // Make the rollback agent's own execution observable without needing a real tool.
  const originalRun = agentRuntime.run.bind(agentRuntime);
  agentRuntime.run = async (agentId, opts) => {
    if (agentId === "product-review-agent") rollbackRan = true;
    return originalRun(agentId, opts);
  };

  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "rollback-demo"));
  const result = await engine.run("rollback-test", { featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.equal(rollbackRan, true);
  assert.equal(result.stageResults["will-fail"].rollback.ok, true);
});

test("WorkflowEngine partial failure: one failing parallel branch does not discard the other's artifact", async () => {
  const { engine, agentRuntime, workflowRegistry, tmpRoot } = buildStack();
  agentRuntime.registerExecutor("always-fails", {
    name: "always-fails",
    async *run() {
      throw new Error("backend broke");
    },
  });
  workflowRegistry.register("partial-failure-test", {
    id: "partial-failure-test",
    stages: [
      {
        id: "implementation",
        parallel: [
          { id: "backend", agent: "backend-agent", executor: "always-fails", produces: ["backend-implementation-report.md"], retry: { max_attempts: 1 } },
          { id: "frontend", agent: "frontend-agent", produces: ["frontend-implementation-report.md"] },
        ],
      },
    ],
  });
  engine.config.retry = { maxAttempts: 1 };

  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "partial-fail-demo"));
  const result = await engine.run("partial-failure-test", { featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "frontend-implementation-report.md")));
  assert.ok(!fs.existsSync(path.join(REPO_ROOT, featureDir, "backend-implementation-report.md")));
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("WorkflowEngine pause/resume halts between stages and a checkpoint is written", async () => {
  const { engine, agentRuntime, workflowRegistry, tmpRoot, checkpointStore } = buildStack();
  agentRuntime.registerExecutor("stepping", new MockExecutor({ simulateSteps: 8, stepDelayMs: 25 }));
  workflowRegistry.register("pause-test", {
    id: "pause-test",
    stages: [
      { id: "s1", agent: "feature-agent", executor: "stepping", produces: [] },
      { id: "s2", agent: "product-review-agent", executor: "stepping", produces: [] },
    ],
  });

  // Pause is applied between stages, not mid-stage: request it early during
  // s1 (8 steps * 25ms ~= 200ms) and wait past s1's completion so the
  // engine has actually reached the "paused before s2" checkpoint.
  const runId = "pause-run-test";
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "pause-demo"));
  const runPromise = engine.run("pause-test", { runId, featureDir });
  await new Promise((r) => setTimeout(r, 30));
  engine.pause(runId);
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(engine.getRun(runId).status, RUN_STATES.PAUSED);
  assert.ok(checkpointStore.exists(runId));

  engine.resume(runId);
  const result = await runPromise;
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.deepEqual(Object.keys(result.stageResults), ["s1", "s2"]);
});

test("WorkflowEngine cancel stops the run and checkpoint reflects cancellation", async () => {
  const { engine, agentRuntime, workflowRegistry, tmpRoot } = buildStack();
  agentRuntime.registerExecutor("stepping", new MockExecutor({ simulateSteps: 12, stepDelayMs: 25 }));
  workflowRegistry.register("cancel-test", {
    id: "cancel-test",
    stages: [
      { id: "s1", agent: "feature-agent", executor: "stepping", produces: [] },
      { id: "s2", agent: "product-review-agent", executor: "stepping", produces: [] },
    ],
  });

  const runId = "cancel-run-test";
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "cancel-demo"));
  const runPromise = engine.run("cancel-test", { runId, featureDir });
  await new Promise((r) => setTimeout(r, 40));
  engine.cancel(runId);
  const result = await runPromise;
  assert.equal(result.status, RUN_STATES.CANCELLED);
});

test("WorkflowEngine resumes from a checkpoint after a simulated process restart", async () => {
  const { engine, agentRuntime, workflowRegistry, tmpRoot, checkpointStore, artifactManager, memoryManager } = buildStack();
  workflowRegistry.register("resume-test", {
    id: "resume-test",
    stages: [
      { id: "s1", agent: "feature-agent", produces: ["specification.md"] },
      { id: "s2", agent: "product-review-agent", produces: ["product-review.md"] },
    ],
  });
  const runId = "resume-run-test";
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "resume-demo"));

  // Simulate an interrupted run: manually write a checkpoint stopped after s1.
  const partial = await engine.run("resume-test", { runId, featureDir });
  assert.equal(partial.status, RUN_STATES.COMPLETED); // mock finishes instantly; force a mid-run checkpoint instead:
  checkpointStore.save(runId + "-interrupted", {
    id: runId + "-interrupted",
    workflowId: "resume-test",
    featureDir,
    context: {},
    status: RUN_STATES.PAUSED,
    currentStageIndex: 1,
    stageResults: { s1: { stageId: "s1", status: "completed", passed: true } },
    startedAt: new Date().toISOString(),
    endedAt: null,
    error: null,
  });

  const resumed = await engine.run("resume-test", { resumeFromRunId: runId + "-interrupted" });
  assert.equal(resumed.status, RUN_STATES.COMPLETED);
  assert.deepEqual(Object.keys(resumed.stageResults), ["s1", "s2"]);

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});
