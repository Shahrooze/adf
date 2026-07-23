import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ToolRegistry, ToolDescriptor } from "../src/registry/tool-registry.mjs";
import { PolicyEngine } from "../src/guardrails/policy-engine.mjs";
import { ToolRuntime } from "../src/tools/tool-runtime.mjs";
import { ValidationPipeline, STEP_RESULTS } from "../src/validation/validation-pipeline.mjs";

function buildToolRuntime() {
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(new ToolDescriptor({ id: "terminal", module: "terminal-tool.mjs", timeoutMs: 10000 }));
  const policyEngine = new PolicyEngine({
    guardrails: {
      defaultPolicy: "allow",
      toolPermissions: {},
      agentOverrides: {},
      dangerousCommandPatterns: [],
      approvalHooks: { autoApproveInNonInteractive: true },
      sandbox: { enabled: false },
    },
  });
  return new ToolRuntime({ toolRegistry, policyEngine });
}

function writeStepsConfig(steps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adf-validation-"));
  const file = path.join(dir, "validation-steps.json");
  fs.writeFileSync(file, JSON.stringify({ steps }));
  return file;
}

test("ValidationPipeline skips steps with no configured command", async () => {
  const toolRuntime = buildToolRuntime();
  const stepsConfigPath = writeStepsConfig({ lint: { command: null } });
  const pipeline = new ValidationPipeline({ toolRuntime, stepsConfigPath, steps: ["lint"] });
  const result = await pipeline.run();
  assert.equal(result.passed, true);
  assert.equal(result.results[0].result, STEP_RESULTS.SKIPPED);
});

test("ValidationPipeline runs a configured command and reports pass/fail", async () => {
  const toolRuntime = buildToolRuntime();
  const stepsConfigPath = writeStepsConfig({
    "unit-tests": { command: "echo all good && exit 0" },
  });
  const pipeline = new ValidationPipeline({ toolRuntime, stepsConfigPath, steps: ["unit-tests"] });
  const result = await pipeline.run();
  assert.equal(result.passed, true);
  assert.equal(result.canContinue, true);
  assert.match(result.results[0].stdout, /all good/);
});

test("ValidationPipeline fail-fast stops the pipeline at the first failing step by default", async () => {
  const toolRuntime = buildToolRuntime();
  const stepsConfigPath = writeStepsConfig({
    lint: { command: "exit 1" },
    "unit-tests": { command: "echo should-not-run" },
  });
  const pipeline = new ValidationPipeline({ toolRuntime, stepsConfigPath, steps: ["lint", "unit-tests"], continueOnFailure: false });
  const result = await pipeline.run();
  assert.equal(result.passed, false);
  assert.equal(result.canContinue, false);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].step, "lint");
  assert.equal(result.results[0].result, STEP_RESULTS.FAILED);
});

test("ValidationPipeline continueOnFailure runs every step and reports the full picture", async () => {
  const toolRuntime = buildToolRuntime();
  const stepsConfigPath = writeStepsConfig({
    lint: { command: "exit 1" },
    "unit-tests": { command: "exit 0" },
  });
  const pipeline = new ValidationPipeline({ toolRuntime, stepsConfigPath, steps: ["lint", "unit-tests"], continueOnFailure: true });
  const result = await pipeline.run();
  assert.equal(result.passed, false);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].result, STEP_RESULTS.FAILED);
  assert.equal(result.results[1].result, STEP_RESULTS.PASSED);
});

test("ValidationPipeline's default config/validation-steps.json wires unit-tests to the Harness's own suite", async () => {
  // Checked without actually executing it here (that would recursively
  // spawn the whole `node --test` suite from inside itself) — the real
  // execution path is already covered by the "runs a configured command"
  // test above against an isolated config file.
  const toolRuntime = buildToolRuntime();
  const pipeline = new ValidationPipeline({ toolRuntime, steps: ["unit-tests"] });
  assert.equal(pipeline.stepsConfig["unit-tests"].command, "node --test");
});
