// Gate enforcement: deterministic checks, write scope, reviewer rework
// loops and human approval -- the parts of a gate an agent cannot satisfy
// just by writing a STATUS line.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadAgentRegistry } from "../src/registry/agent-registry.mjs";
import { loadWorkflowRegistry } from "../src/registry/workflow-registry.mjs";
import { ArtifactManager } from "../src/artifacts/artifact-manager.mjs";
import { MemoryManager } from "../src/memory/memory-store.mjs";
import { ContextManager } from "../src/context/context-manager.mjs";
import { AgentRuntime } from "../src/runtime/agent-runtime.mjs";
import { MockExecutor } from "../src/executors/mock-executor.mjs";
import { CheckpointStore } from "../src/retry/checkpoint-store.mjs";
import { WorkflowEngine, RUN_STATES } from "../src/workflow/workflow-engine.mjs";
import { parseWorkflow } from "../src/workflow/workflow-parser.mjs";
import { evaluateGate } from "../src/workflow/gate-evaluator.mjs";
import {
  globToRegExp,
  resolveWriteScope,
  snapshotWorkingTree,
  changedSince,
  checkWriteScope,
  revertPaths,
  isValidScopeEntry,
} from "../src/guardrails/write-scope.mjs";
import { loadRuntimeConfig } from "../src/config/config-loader.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

function buildStack({ config = {}, validationPipeline = null, onApproval = null } = {}) {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adf-enforce-"));
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
    validationPipeline,
    onApproval,
    config: { runtime: { pauseCheckIntervalMs: 20 }, retry: { maxAttempts: 1, backoffMs: 1 }, workflow: { approvals: "workflow" }, ...config },
  });
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "demo"));
  return { tmpRoot, engine, agentRuntime, workflowRegistry, checkpointStore, featureDir };
}

// Executor whose output per call is decided by the test: statusFor(call)
// returns the STATUS line written into every produced artifact.
function scripted(statusFor, calls = []) {
  return {
    name: "scripted",
    async *run({ agent, task }) {
      calls.push({ agentId: agent.id, stageId: task.stageId, description: task.description, consumes: task.consumes });
      const status = statusFor(calls.filter((c) => c.stageId === task.stageId).length, task);
      yield {
        type: "result",
        content: "ok",
        artifacts: (task.produces ?? []).map((filename) => ({ filename, type: "doc", content: `# ${filename}\n\nSTATUS: ${status}\n` })),
      };
    },
  };
}

const reviewWorkflow = (extra = {}) => ({
  id: "review-loop",
  stages: [
    { id: "author", agent: "feature-agent", executor: "author", produces: ["specification.md"], gate: { required_artifacts: ["specification.md"], status: "READY_FOR_PRODUCT_REVIEW" } },
    {
      id: "review",
      agent: "product-review-agent",
      executor: "reviewer",
      consumes: ["specification.md"],
      produces: ["product-review.md"],
      gate: { required_artifacts: ["product-review.md"], status: "READY_FOR_DESIGN" },
      on_fail: { rework: "author", max_rounds: 2 },
    },
  ],
  ...extra,
});

// ---- parser ----------------------------------------------------------------

test("parser: on_fail must target an earlier top-level stage", () => {
  assert.throws(
    () => parseWorkflow({ id: "x", stages: [{ id: "a", agent: "feature-agent", on_fail: { rework: "b" } }, { id: "b", agent: "feature-agent" }] }),
    /earlier stage/
  );
  assert.throws(() => parseWorkflow({ id: "x", stages: [{ id: "a", agent: "feature-agent", on_fail: { rework: "nope" } }] }), /unknown/);
});

test("parser: shipped workflows declare approvals, rework targets and checks", () => {
  const registry = loadWorkflowRegistry();
  const full = parseWorkflow(registry.get("feature-development").raw);
  assert.equal(full.humanApproval, true);
  assert.equal(full.stages.find((s) => s.id === "product-review").onFail.rework, "feature");
  assert.equal(full.stages.find((s) => s.id === "code-review").onFail.rework, "backend-implementation");
  assert.deepEqual(full.stages.find((s) => s.id === "backend-implementation").gate.checks, ["build", "unit-tests"]);
  assert.deepEqual(full.stages.find((s) => s.id === "qa").gate.reject_statuses, ["CHANGES_REQUIRED", "REJECTED"]);

  const quick = parseWorkflow(registry.get("quick-change").raw);
  assert.equal(quick.track, "quick-change");
  assert.deepEqual(
    quick.stages.map((s) => s.id),
    ["feature", "track-check", "implementation", "qa", "code-review"]
  );
  assert.deepEqual(quick.stages[1].gate.markers, ["TRACK: QUICK_CHANGE"]);
});

// ---- gate evaluator --------------------------------------------------------

test("gate: a reject status is a verdict, a wrong status is not; markers are required lines", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adf-gate-"));
  const featureDir = path.relative(REPO_ROOT, dir);
  const gate = parseWorkflow({ id: "g", stages: [{ id: "s", gate: { required_artifacts: ["r.md"], status: "OK", markers: ["TRACK: QUICK_CHANGE"] } }] }).stages[0].gate;

  fs.writeFileSync(path.join(dir, "r.md"), "TRACK: QUICK_CHANGE\n\nSTATUS: CHANGES_REQUIRED\n");
  let result = evaluateGate(gate, { featureDir });
  assert.equal(result.passed, false);
  assert.equal(result.rejected, true);

  fs.writeFileSync(path.join(dir, "r.md"), "TRACK: QUICK_CHANGE\n\nSTATUS: DRAFT\n");
  result = evaluateGate(gate, { featureDir });
  assert.equal(result.rejected, false);

  fs.writeFileSync(path.join(dir, "r.md"), "TRACK: FULL\n\nSTATUS: OK\n");
  result = evaluateGate(gate, { featureDir });
  assert.equal(result.passed, false);
  assert.match(result.reasons.join(), /TRACK: QUICK_CHANGE/);

  fs.writeFileSync(path.join(dir, "r.md"), "TRACK: QUICK_CHANGE\n\nSTATUS: OK\n");
  assert.equal(evaluateGate(gate, { featureDir }).passed, true);
});

// ---- rework loop -----------------------------------------------------------

test("rework: a reviewer's CHANGES_REQUIRED sends findings back to the author, then passes", async () => {
  const { engine, agentRuntime, workflowRegistry, featureDir } = buildStack({ config: { workflow: { approvals: "auto" } } });
  const calls = [];
  agentRuntime.registerExecutor("author", scripted(() => "READY_FOR_PRODUCT_REVIEW", calls));
  agentRuntime.registerExecutor("reviewer", scripted((n) => (n === 1 ? "CHANGES_REQUIRED" : "READY_FOR_DESIGN"), calls));
  workflowRegistry.register("review-loop", reviewWorkflow());

  const result = await engine.run("review-loop", { featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.deepEqual(
    calls.map((c) => c.stageId),
    ["author", "review", "author", "review"]
  );
  const rerun = calls[2];
  assert.match(rerun.description, /Rework request \(round 1\)/);
  assert.match(rerun.description, /product-review\.md/);
  assert.ok(rerun.consumes.includes("product-review.md"), "author receives the review artifact as context");
  assert.doesNotMatch(calls[3].description, /Rework request/, "the reviewer is re-judged fresh");
  assert.equal(result.history.filter((e) => e.type === "rework").length, 1);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("rework: a rejection is never retried and stops for a human after max_rounds", async () => {
  const { engine, agentRuntime, workflowRegistry, featureDir } = buildStack({
    config: { workflow: { approvals: "auto" }, retry: { maxAttempts: 3, backoffMs: 1 } },
  });
  const calls = [];
  agentRuntime.registerExecutor("author", scripted(() => "READY_FOR_PRODUCT_REVIEW", calls));
  agentRuntime.registerExecutor("reviewer", scripted(() => "REJECTED", calls));
  workflowRegistry.register("review-loop", reviewWorkflow());

  const result = await engine.run("review-loop", { featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.match(result.error, /rework limit \(2 rounds\) reached/);
  // 1 original + 2 rework rounds; each review ran exactly once per round.
  assert.equal(calls.filter((c) => c.stageId === "author").length, 3);
  assert.equal(calls.filter((c) => c.stageId === "review").length, 3);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("rework: an author's garbled output is retried (with the reason), not reworked", async () => {
  const { engine, agentRuntime, workflowRegistry, featureDir } = buildStack({
    config: { workflow: { approvals: "auto" }, retry: { maxAttempts: 2, backoffMs: 1 } },
  });
  const calls = [];
  agentRuntime.registerExecutor("author", scripted((n) => (n === 1 ? "DRAFT" : "READY_FOR_PRODUCT_REVIEW"), calls));
  agentRuntime.registerExecutor("reviewer", scripted(() => "READY_FOR_DESIGN", calls));
  workflowRegistry.register("review-loop", reviewWorkflow());

  const result = await engine.run("review-loop", { featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.match(calls[1].description, /Previous attempt failed/);
  assert.match(calls[1].description, /expected "READY_FOR_PRODUCT_REVIEW"/);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

// ---- deterministic checks ------------------------------------------------------

function fakePipeline(outcomes, seen = []) {
  return {
    stepsConfig: { build: { command: "x" }, "unit-tests": { command: "x" }, lint: { command: null } },
    async run({ stages }) {
      seen.push(stages);
      const results = stages.map((step) => {
        if (!(step in this.stepsConfig) || !this.stepsConfig[step].command) return { step, result: "skipped", reason: "no command configured" };
        const passed = typeof outcomes[step] === "function" ? outcomes[step]() : outcomes[step] !== false;
        return { step, result: passed ? "passed" : "failed", exitCode: passed ? 0 : 1, stdout: "", stderr: passed ? "" : `${step} output: 2 failing` };
      });
      return { passed: results.every((r) => r.result !== "failed"), results };
    },
  };
}

const checkedStage = (checks, extra = {}) => ({
  id: "checks-wf",
  stages: [
    {
      id: "build-it",
      agent: "backend-agent",
      produces: ["backend-implementation-report.md"],
      gate: { required_artifacts: ["backend-implementation-report.md"], status: "READY_FOR_FRONTEND", checks },
      ...extra,
    },
  ],
});

test("checks: a failing gate check fails the stage even though the agent wrote the right STATUS", async () => {
  const seen = [];
  const { engine, workflowRegistry, featureDir } = buildStack({
    config: { workflow: { approvals: "auto" } },
    validationPipeline: fakePipeline({ build: true, "unit-tests": false }, seen),
  });
  workflowRegistry.register("checks-wf", checkedStage(["build", "unit-tests"]));
  const result = await engine.run("checks-wf", { featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.match(result.error, /check "unit-tests" failed/);
  assert.match(result.error, /2 failing/);
  assert.deepEqual(seen[0], ["build", "unit-tests"]);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("checks: unconfigured checks pass as unverified, unless strictChecks is on; unknown ids always fail", async () => {
  let stack = buildStack({ config: { workflow: { approvals: "auto" } }, validationPipeline: fakePipeline({}) });
  stack.workflowRegistry.register("checks-wf", checkedStage(["lint"]));
  let result = await stack.engine.run("checks-wf", { featureDir: stack.featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.deepEqual(result.stageResults["build-it"].checks.unverified, ["lint"]);

  stack = buildStack({ config: { workflow: { approvals: "auto", strictChecks: true } }, validationPipeline: fakePipeline({}) });
  stack.workflowRegistry.register("checks-wf", checkedStage(["lint"]));
  result = await stack.engine.run("checks-wf", { featureDir: stack.featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.match(result.error, /strictChecks/);

  stack = buildStack({ config: { workflow: { approvals: "auto" } }, validationPipeline: fakePipeline({}) });
  stack.workflowRegistry.register("checks-wf", checkedStage(["unit-tset"]));
  result = await stack.engine.run("checks-wf", { featureDir: stack.featureDir });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.match(result.error, /unknown validation step "unit-tset"/);
});

test("checks: failing checks on a review stage are sent back to the author as rework", async () => {
  let testsPass = false;
  const { engine, agentRuntime, workflowRegistry, featureDir } = buildStack({
    config: { workflow: { approvals: "auto" } },
    validationPipeline: fakePipeline({ "unit-tests": () => testsPass }),
  });
  const calls = [];
  agentRuntime.registerExecutor("author", {
    name: "author",
    async *run(args) {
      testsPass = calls.filter((c) => c.stageId === "author").length >= 1; // the fix lands on the rework
      yield* scripted(() => "READY_FOR_PRODUCT_REVIEW", calls).run(args);
    },
  });
  agentRuntime.registerExecutor("reviewer", scripted(() => "READY_FOR_DESIGN", calls));
  const wf = reviewWorkflow();
  wf.stages[1].gate.checks = ["unit-tests"];
  workflowRegistry.register("review-loop", wf);

  const result = await engine.run("review-loop", { featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.deepEqual(calls.map((c) => c.stageId), ["author", "review", "author", "review"]);
  assert.match(calls[2].description, /check "unit-tests" failed/);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

// ---- human approval ------------------------------------------------------------

test("approval: a run parks as awaiting_approval, and decideApproval + resume continues it", async () => {
  const { engine, workflowRegistry, featureDir } = buildStack();
  workflowRegistry.register("approve-wf", {
    id: "approve-wf",
    human_approval: true,
    stages: [
      { id: "one", agent: "feature-agent", produces: ["specification.md"], gate: { required_artifacts: ["specification.md"], status: "READY_FOR_PRODUCT_REVIEW" } },
      { id: "two", agent: "product-review-agent", produces: ["product-review.md"], gate: { required_artifacts: ["product-review.md"], status: "READY_FOR_DESIGN" } },
      { id: "release", gate: { required_artifacts: ["product-review.md"] } },
    ],
  });

  let result = await engine.run("approve-wf", { featureDir, runId: "approve-run" });
  assert.equal(result.status, RUN_STATES.AWAITING_APPROVAL);
  assert.equal(result.pendingApproval.stageId, "one");
  assert.ok(!result.stageResults.two, "stage two must not start before approval");

  assert.throws(() => engine.decideApproval("approve-run", { approved: false }), /requires a reason/);
  engine.decideApproval("approve-run", { approved: true, by: "tester" });
  result = await engine.run("approve-wf", { resumeFromRunId: "approve-run" });
  assert.equal(result.status, RUN_STATES.AWAITING_APPROVAL);
  assert.equal(result.pendingApproval.stageId, "two");

  engine.decideApproval("approve-run", { approved: true });
  result = await engine.run("approve-wf", { resumeFromRunId: "approve-run" });
  assert.equal(result.status, RUN_STATES.COMPLETED, "gate-only stages never wait for approval");
  assert.deepEqual(
    result.history.filter((e) => e.type === "approval").map((e) => e.stageId),
    ["one", "two"]
  );
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("approval: a human rejection re-runs the stage with the reason as feedback", async () => {
  const calls = [];
  let answers = [{ approved: false, reason: "Business goal has no metric" }, { approved: true }];
  const { engine, agentRuntime, workflowRegistry, featureDir } = buildStack({ onApproval: async () => answers.shift() });
  agentRuntime.registerExecutor("author", scripted(() => "READY_FOR_PRODUCT_REVIEW", calls));
  workflowRegistry.register("approve-wf", {
    id: "approve-wf",
    human_approval: true,
    stages: [{ id: "one", agent: "feature-agent", executor: "author", produces: ["specification.md"], gate: { required_artifacts: ["specification.md"], status: "READY_FOR_PRODUCT_REVIEW" } }],
  });
  const result = await engine.run("approve-wf", { featureDir });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.equal(calls.length, 2);
  assert.match(calls[1].description, /Business goal has no metric/);
  assert.match(calls[1].description, /a human approver/);
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("approval: autoApprove / approvals=auto skip the wait but record it", async () => {
  const { engine, workflowRegistry, featureDir } = buildStack();
  workflowRegistry.register("approve-wf", {
    id: "approve-wf",
    human_approval: true,
    stages: [{ id: "one", agent: "feature-agent", produces: ["specification.md"], gate: { required_artifacts: ["specification.md"], status: "READY_FOR_PRODUCT_REVIEW" } }],
  });
  const result = await engine.run("approve-wf", { featureDir, autoApprove: true });
  assert.equal(result.status, RUN_STATES.COMPLETED);
  assert.equal(result.history[0].by, "auto");
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

// ---- write scope ---------------------------------------------------------------

test("write-scope: glob semantics", () => {
  assert.ok(globToRegExp("src/**").test("src/a/b.cs"));
  assert.ok(globToRegExp("src/**/x.md").test("src/x.md"));
  assert.ok(globToRegExp("src/**/x.md").test("src/a/b/x.md"));
  assert.ok(!globToRegExp("src/*.cs").test("src/a/b.cs"));
  assert.ok(globToRegExp("bugs/<bug-id>/debug-report.md").test("bugs/BUG-1/debug-report.md"));
  assert.ok(!globToRegExp("bugs/<bug-id>/debug-report.md").test("bugs/a/b/debug-report.md"));
  assert.ok(!globToRegExp("a.md").test("aXmd"));
});

test("write-scope: every agent.yaml permissions entry is an enforceable pattern", () => {
  const cfg = loadRuntimeConfig().guardrails.writeScope;
  for (const agent of loadAgentRegistry().list()) {
    const permissions = agent.raw.permissions;
    assert.ok(permissions?.write?.length, `${agent.id} declares permissions.write`);
    for (const entry of [...(permissions.write ?? []), ...(permissions.deny ?? [])]) {
      assert.ok(isValidScopeEntry(entry), `${agent.id}: "${entry}" is prose, not a path pattern`);
    }
    assert.doesNotThrow(() => resolveWriteScope(agent, { featureDir: "features/x", aliases: cfg.pathAliases }), agent.id);
  }
});

test("write-scope: backend may write backend code and its report, not frontend code or the spec", () => {
  const agents = loadAgentRegistry();
  const aliases = loadRuntimeConfig().guardrails.writeScope.pathAliases;
  const backend = resolveWriteScope(agents.get("backend-agent"), { featureDir: "features/f", aliases });
  const frontend = resolveWriteScope(agents.get("frontend-agent"), { featureDir: "features/f", aliases });
  const v = (paths, scopes) => checkWriteScope(paths, scopes).map((x) => x.path);
  assert.deepEqual(v(["src/backend/A.cs", "tests/backend/ATests.cs", "features/f/backend-implementation-report.md"], [backend]), []);
  assert.deepEqual(v(["src/frontend/page.tsx", "features/f/specification.md", "README.md"], [backend]), [
    "src/frontend/page.tsx",
    "features/f/specification.md",
    "README.md",
  ]);
  // Parallel stage: union of scopes, but each agent's own deny still applies to it.
  assert.deepEqual(v(["src/backend/A.cs", "src/frontend/page.tsx"], [backend, frontend]), []);
});

function tmpGitRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "adf-scope-git-"));
  const git = (...args) => execFileSync("git", args, { cwd: root, stdio: "ignore" });
  git("init", "-q");
  git("config", "user.email", "t@example.com");
  git("config", "user.name", "t");
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "a.txt"), "a\n");
  fs.writeFileSync(path.join(root, "README.md"), "readme\n");
  git("add", ".");
  git("commit", "-q", "-m", "init");
  return { root, git };
}

test("write-scope: snapshot diff sees new, modified, deleted and committed files, ignoring pre-existing edits", () => {
  const { root, git } = tmpGitRepo();
  fs.writeFileSync(path.join(root, "README.md"), "local edit before the stage\n");
  const snapshot = snapshotWorkingTree(root);

  fs.writeFileSync(path.join(root, "new.txt"), "n\n");
  fs.writeFileSync(path.join(root, "src", "a.txt"), "changed\n");
  assert.deepEqual(changedSince(snapshot), ["new.txt", "src/a.txt"]);

  fs.rmSync(path.join(root, "src", "a.txt"));
  git("add", "-A");
  git("commit", "-q", "-m", "agent commit");
  assert.deepEqual(changedSince(snapshot), ["new.txt", "src/a.txt"]);
});

test("write-scope: revert restores tracked files and removes new ones, never touching pre-existing edits", () => {
  const { root } = tmpGitRepo();
  fs.writeFileSync(path.join(root, "README.md"), "mine\n");
  const snapshot = snapshotWorkingTree(root);
  fs.writeFileSync(path.join(root, "src", "a.txt"), "agent\n");
  fs.writeFileSync(path.join(root, "rogue.txt"), "agent\n");
  fs.writeFileSync(path.join(root, "README.md"), "agent overwrote mine\n");
  const { reverted, unrevertable } = revertPaths(snapshot, ["src/a.txt", "rogue.txt", "README.md"]);
  assert.deepEqual(reverted.sort(), ["rogue.txt", "src/a.txt"]);
  assert.deepEqual(unrevertable, ["README.md"]);
  assert.equal(fs.readFileSync(path.join(root, "src", "a.txt"), "utf8"), "a\n");
  assert.ok(!fs.existsSync(path.join(root, "rogue.txt")));
});

test("write-scope: the engine fails a stage that wrote outside its agent's scope, and never retries it", async () => {
  const { root } = tmpGitRepo();
  let calls = 0;
  const { engine, agentRuntime, workflowRegistry } = buildStack({
    config: {
      repoRoot: root,
      workflow: { approvals: "auto" },
      retry: { maxAttempts: 3, backoffMs: 1 },
      guardrails: { writeScope: { enabled: true, onViolation: "revert", pathAliases: { "source-code": ["src/**"] }, alwaysAllowed: [] } },
    },
  });
  agentRuntime.registerExecutor("rogue", {
    name: "rogue",
    async *run() {
      calls++;
      fs.mkdirSync(path.join(root, "features", "f"), { recursive: true });
      fs.writeFileSync(path.join(root, "features", "f", "specification.md"), "spec\n");
      fs.writeFileSync(path.join(root, "src", "a.txt"), "the feature agent wrote code\n");
      yield { type: "result", content: "", artifacts: [] };
    },
  });
  workflowRegistry.register("scope-wf", { id: "scope-wf", stages: [{ id: "spec", agent: "feature-agent", executor: "rogue", produces: [] }] });

  const result = await engine.run("scope-wf", { featureDir: "features/f" });
  assert.equal(result.status, RUN_STATES.FAILED);
  assert.equal(calls, 1, "a scope violation is not retried");
  assert.match(result.error, /write outside permitted scope: src\/a\.txt/);
  assert.doesNotMatch(result.error, /specification\.md/, "its own artifact is in scope");
  assert.deepEqual(result.stageResults.spec.writeScope.reverted.reverted, ["src/a.txt"]);
  assert.equal(fs.readFileSync(path.join(root, "src", "a.txt"), "utf8"), "a\n");
});
