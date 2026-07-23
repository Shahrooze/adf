import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Harness } from "../src/harness.mjs";
import { workflowCommand } from "../src/cli/commands/workflow.mjs";
import { agentCommand } from "../src/cli/commands/agent.mjs";
import { statusCommand } from "../src/cli/commands/status.mjs";
import { validateCommand } from "../src/cli/commands/validate.mjs";
import { resumeCommand } from "../src/cli/commands/resume.mjs";
import { retryCommand } from "../src/cli/commands/retry.mjs";
import { doctorCommand } from "../src/cli/commands/doctor.mjs";
import { artifactsCommand } from "../src/cli/commands/artifacts.mjs";
import * as codes from "../src/cli/exit-codes.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

function silence(fn) {
  const origLog = console.log;
  const origErr = console.error;
  const lines = [];
  console.log = (...args) => lines.push(args.join(" "));
  console.error = (...args) => lines.push(args.join(" "));
  return fn(lines).finally(() => {
    console.log = origLog;
    console.error = origErr;
  });
}

function tmpHarness() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "adf-cli-"));
  const harness = new Harness({ runId: null });
  // Redirect every stateful subsystem into an isolated tmp dir so CLI tests
  // never touch the real repo's .adf/ state.
  harness.checkpointStore.dir = path.join(tmpRoot, "checkpoints");
  fs.mkdirSync(harness.checkpointStore.dir, { recursive: true });
  harness.logger.logDir = path.join(tmpRoot, "logs");
  fs.mkdirSync(harness.logger.logDir, { recursive: true });
  return { harness, tmpRoot };
}

test("CLI workflow command: list, show, run", async () => {
  const { harness, tmpRoot } = tmpHarness();
  await silence(async (lines) => {
    const listCode = await workflowCommand(harness, ["list"]);
    assert.equal(listCode, codes.OK);
    assert.ok(lines.some((l) => l.includes("parallel-development")));
  });

  await silence(async (lines) => {
    const showCode = await workflowCommand(harness, ["show", "parallel-development"]);
    assert.equal(showCode, codes.OK);
    assert.ok(lines.some((l) => l.includes("parallel")));
  });

  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "cli-demo"));
  let runCode;
  await silence(async () => {
    runCode = await workflowCommand(harness, ["run", "parallel-development", "--feature-dir", featureDir]);
  });
  assert.equal(runCode, codes.OK);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "specification.md")));
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("CLI workflow run exits USAGE_ERROR for an unknown workflow", async () => {
  const { harness } = tmpHarness();
  let code;
  await silence(async () => {
    code = await workflowCommand(harness, ["run", "not-a-real-workflow"]);
  });
  assert.equal(code, codes.USAGE_ERROR);
});

test("CLI agent run executes a single agent and reports its produced artifact", async () => {
  const { harness, tmpRoot } = tmpHarness();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "agent-cli-demo"));
  let code;
  await silence(async () => {
    code = await agentCommand(harness, ["run", "feature-agent", "--feature-dir", featureDir, "--produces", "specification.md"]);
  });
  assert.equal(code, codes.OK);
  assert.ok(fs.existsSync(path.join(REPO_ROOT, featureDir, "specification.md")));
  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("CLI status lists checkpointed runs and shows run detail", async () => {
  const { harness, tmpRoot } = tmpHarness();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "status-cli-demo"));
  let runResult;
  await silence(async () => {
    await workflowCommand(harness, ["run", "feature-development", "--feature-dir", featureDir, "--run-id", "status-cli-run"]);
  });

  await silence(async (lines) => {
    const code = await statusCommand(harness, []);
    assert.equal(code, codes.OK);
    assert.ok(lines.some((l) => l.includes("status-cli-run")));
  });

  await silence(async (lines) => {
    const code = await statusCommand(harness, ["status-cli-run"]);
    assert.equal(code, codes.OK);
    assert.ok(lines.some((l) => l.includes("completed")));
  });

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("CLI validate runs the pipeline and returns a non-OK code on failure", async () => {
  const { harness } = tmpHarness();
  const stepsConfigPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "adf-cli-validate-")), "steps.json");
  fs.writeFileSync(stepsConfigPath, JSON.stringify({ steps: { "cli-fail-step": { command: "exit 1" } } }));
  harness.validationPipeline.stepsConfig = JSON.parse(fs.readFileSync(stepsConfigPath, "utf8")).steps;

  let code;
  await silence(async () => {
    code = await validateCommand(harness, ["--stages", "cli-fail-step"]);
  });
  assert.equal(code, codes.RUN_FAILED);
});

test("CLI retry refuses a run that did not fail, resume refuses an unknown run", async () => {
  const { harness, tmpRoot } = tmpHarness();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "retry-cli-demo"));
  await silence(async () => {
    await workflowCommand(harness, ["run", "feature-development", "--feature-dir", featureDir, "--run-id", "retry-cli-run"]);
  });

  let retryCode;
  await silence(async () => {
    retryCode = await retryCommand(harness, ["retry-cli-run"]);
  });
  assert.equal(retryCode, codes.USAGE_ERROR);

  let resumeCode;
  await silence(async () => {
    resumeCode = await resumeCommand(harness, ["no-such-run"]);
  });
  assert.equal(resumeCode, codes.USAGE_ERROR);

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("CLI doctor passes against the real repo config", async () => {
  const { harness } = tmpHarness();
  let code;
  await silence(async () => {
    code = await doctorCommand(harness, []);
  });
  assert.equal(code, codes.OK);
});

test("CLI artifacts lists and shows artifacts produced by a run", async () => {
  const { harness, tmpRoot } = tmpHarness();
  const featureDir = path.relative(REPO_ROOT, path.join(tmpRoot, "features", "artifacts-cli-demo"));
  await silence(async () => {
    await agentCommand(harness, ["run", "feature-agent", "--feature-dir", featureDir, "--produces", "specification.md"]);
  });

  await silence(async (lines) => {
    const code = await artifactsCommand(harness, []);
    assert.equal(code, codes.OK);
    assert.ok(lines.some((l) => l.includes("specification.md")));
  });

  const artifactId = `${featureDir}/specification.md`;
  await silence(async (lines) => {
    const code = await artifactsCommand(harness, ["show", artifactId]);
    assert.equal(code, codes.OK);
    assert.ok(lines.some((l) => l.includes("\"status\"")));
  });

  fs.rmSync(path.join(REPO_ROOT, featureDir), { recursive: true, force: true });
});

test("adf --help and adf --version run as real subprocesses", () => {
  const help = execFileSync(process.execPath, [path.join(REPO_ROOT, "bin", "adf.mjs"), "--help"], { encoding: "utf8" });
  assert.match(help, /Usage: adf <command>/);

  const version = execFileSync(process.execPath, [path.join(REPO_ROOT, "bin", "adf.mjs"), "--version"], { encoding: "utf8" });
  assert.match(version.trim(), /^\d+\.\d+\.\d+$/);
});

test("adf doctor runs end to end as a real subprocess and exits 0", () => {
  const output = execFileSync(process.execPath, [path.join(REPO_ROOT, "bin", "adf.mjs"), "doctor"], { encoding: "utf8" });
  assert.match(output, /All critical checks passed\./);
});
