// True end-to-end tests: invoke the shipped `bin/adf.mjs` binary exactly
// as an operator would, over real subprocesses and real stdout — not the
// in-process command handlers (those are covered by cli.test.mjs). This
// is what actually proves the CLI works, not just that its internals do.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "../src/config/paths.mjs";

const ADF_BIN = path.join(REPO_ROOT, "bin", "adf.mjs");

function adf(args, opts = {}) {
  try {
    const stdout = execFileSync(process.execPath, [ADF_BIN, ...args], { encoding: "utf8", cwd: REPO_ROOT, ...opts });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function cleanupFeatureDir(relDir) {
  fs.rmSync(path.join(REPO_ROOT, relDir), { recursive: true, force: true });
}

test("e2e: run a parallel workflow through the real CLI binary and inspect it end to end", () => {
  const featureDir = `features/__e2e_${Date.now()}__`;
  const runId = `e2e-run-${Date.now()}`;

  const runResult = adf(["run", "parallel-development", "--feature-dir", featureDir, "--run-id", runId, "--report"]);
  assert.equal(runResult.code, 0, runResult.stdout + runResult.stderr);
  assert.match(runResult.stdout, /finished with status: completed/);
  assert.match(runResult.stdout, /Report written to/);

  for (const file of [
    "specification.md",
    "architecture.md",
    "backend-implementation-report.md",
    "frontend-implementation-report.md",
    "qa-report.md",
    "code-review-report.md",
    "operations-readiness-report.md",
  ]) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, file)), `expected ${file} to exist`);
  }

  const statusResult = adf(["status", runId]);
  assert.equal(statusResult.code, 0);
  assert.match(statusResult.stdout, /Status: completed/);

  const logsResult = adf(["logs", runId]);
  assert.equal(logsResult.code, 0);
  assert.match(logsResult.stdout, /Workflow run ".*" completed/);

  const artifactsResult = adf(["artifacts", "--workflow-run-id", runId]);
  assert.equal(artifactsResult.code, 0);
  assert.match(artifactsResult.stdout, /specification\.md/);

  cleanupFeatureDir(featureDir);
});

test("e2e: adf validate skips (not fails) a step with no configured command", () => {
  // Workflow-run failure/retry/rollback end-to-end paths are already
  // covered at the module level in workflow-engine.test.mjs, driven
  // through synthetic always-failing executors — that's not reachable
  // from the CLI without either editing repo files or waiting on a real
  // AI CLI. This exercises the one deterministic failure-adjacent path
  // that *is* reachable through the real binary: an unconfigured
  // validation step must be reported as skipped, not silently "passed".
  const result = adf(["validate", "--stages", "does-not-exist-step"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /skip/);
});

test("e2e: adf agent run produces a tracked artifact visible via adf artifacts show", () => {
  const featureDir = `features/__e2e_agent_${Date.now()}__`;
  const runResult = adf(["agent", "run", "qa-agent", "--feature-dir", featureDir, "--produces", "qa-report.md"]);
  assert.equal(runResult.code, 0, runResult.stdout + runResult.stderr);

  const artifactId = `${featureDir}/qa-report.md`;
  const showResult = adf(["artifacts", "show", artifactId]);
  assert.equal(showResult.code, 0);
  assert.match(showResult.stdout, /"status": "draft"/);

  cleanupFeatureDir(featureDir);
});

test("e2e: adf doctor, adf agent list, and adf workflow list all succeed against the real repo", () => {
  assert.equal(adf(["doctor"]).code, 0);
  const agentList = adf(["agent", "list"]);
  assert.equal(agentList.code, 0);
  assert.match(agentList.stdout, /backend-agent/);
  const workflowList = adf(["workflow", "list"]);
  assert.equal(workflowList.code, 0);
  assert.match(workflowList.stdout, /feature-development/);
});

test("e2e: a workflow with an unsatisfiable gate fails through the CLI, and adf retry retries it", () => {
  // Deterministic, CLI-only way to force a real failure without a live AI
  // CLI: a gate that requires an artifact the stage never produces always
  // fails, regardless of executor. Proves adf run -> FAILED -> adf retry
  // -> FAILED again (still unsatisfiable) end to end through real
  // subprocesses and real checkpoint files on disk.
  const workflowPath = path.join(REPO_ROOT, "workflows", `e2e-failing-${Date.now()}.yaml`);
  const workflowId = path.basename(workflowPath, ".yaml");
  fs.writeFileSync(
    workflowPath,
    [
      `id: ${workflowId}`,
      "name: E2E Failing Workflow",
      "stages:",
      "  - id: will-fail",
      "    agent: feature-agent",
      "    produces:",
      "      - specification.md",
      "    gate:",
      "      required_artifacts:",
      "        - this-file-will-never-exist.md",
      "",
    ].join("\n")
  );

  const featureDir = `features/__e2e_fail_${Date.now()}__`;
  const runId = `e2e-fail-run-${Date.now()}`;

  try {
    const runResult = adf(["run", workflowId, "--feature-dir", featureDir, "--run-id", runId]);
    assert.equal(runResult.code, 3); // RUN_FAILED
    assert.match(runResult.stdout, /finished with status: failed/);
    assert.match(runResult.stdout, /FAIL.*will-fail/);

    const statusResult = adf(["status", runId]);
    assert.match(statusResult.stdout, /Status: failed/);

    const retryResult = adf(["retry", runId]);
    assert.equal(retryResult.code, 3);
    assert.match(retryResult.stdout, /Retrying workflow/);
    assert.match(retryResult.stdout, /Status: failed/);
  } finally {
    fs.rmSync(workflowPath, { force: true });
    cleanupFeatureDir(featureDir);
  }
});

test("e2e: legacy adf-core commands keep working unmodified through adf registry", () => {
  const result = adf(["registry", "validate", "--json"]);
  assert.equal(result.code, 0);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
});
