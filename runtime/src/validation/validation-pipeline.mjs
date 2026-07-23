// The Validation Engine: lint -> unit tests -> integration tests ->
// security scan -> performance checks -> build -> review, in whatever
// order runtime.config.json's validation.pipeline lists. Every step is
// just a shell command configured in config/validation-steps.json — a
// step with no command configured is skipped (not failed), so a fresh
// project can adopt the Harness before it has, say, a security scanner
// wired up. The Harness itself decides whether execution may continue:
// by default the first failing step stops the pipeline (fail-fast); set
// runtime.config.json's validation.continueOnFailure to run every step
// regardless and report the full picture.
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR, REPO_ROOT } from "../config/paths.mjs";

export const STEP_RESULTS = Object.freeze({
  PASSED: "passed",
  FAILED: "failed",
  SKIPPED: "skipped",
});

function loadStepsConfig(configPath) {
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, "utf8")).steps ?? {};
}

export class ValidationPipeline {
  constructor({
    steps,
    stepsConfigPath = path.join(CONFIG_DIR, "validation-steps.json"),
    toolRuntime,
    logger = null,
    continueOnFailure = false,
  }) {
    this.steps = steps ?? ["lint", "unit-tests", "integration-tests", "security-scan", "performance", "build", "review"];
    this.stepsConfig = loadStepsConfig(stepsConfigPath);
    this.toolRuntime = toolRuntime;
    this.logger = logger;
    this.continueOnFailure = continueOnFailure;
  }

  async run({ cwd = REPO_ROOT, agentId = "validation-pipeline", stages = null } = {}) {
    const results = [];
    const stepIds = stages ?? this.steps;

    for (const stepId of stepIds) {
      const stepConfig = this.stepsConfig[stepId];
      if (!stepConfig?.command) {
        results.push({ step: stepId, result: STEP_RESULTS.SKIPPED, reason: "no command configured" });
        this.logger?.info?.(`Validation step "${stepId}" skipped (no command configured)`, {});
        continue;
      }

      const toolResult = await this.toolRuntime.execute("terminal", { command: stepConfig.command, cwd }, { agentId });
      const exitCode = toolResult.result?.exitCode;
      const passed = toolResult.ok && exitCode === 0;
      const entry = {
        step: stepId,
        result: passed ? STEP_RESULTS.PASSED : STEP_RESULTS.FAILED,
        command: stepConfig.command,
        exitCode: exitCode ?? null,
        stdout: (toolResult.result?.stdout ?? "").slice(-4000),
        stderr: (toolResult.result?.stderr ?? "").slice(-4000),
        error: toolResult.ok ? null : toolResult.error,
      };
      results.push(entry);

      if (passed) {
        this.logger?.info?.(`Validation step "${stepId}" passed`, {});
      } else {
        this.logger?.error?.(`Validation step "${stepId}" failed`, { error: entry.error ?? `exit code ${exitCode}` });
        if (!this.continueOnFailure) break;
      }
    }

    const ran = results.filter((r) => r.result !== STEP_RESULTS.SKIPPED);
    const passed = ran.every((r) => r.result === STEP_RESULTS.PASSED);
    const executedAll = results.length === stepIds.length;

    return {
      passed,
      // The Harness's actual gate decision: only "continue" when every
      // step that ran passed AND the pipeline wasn't cut short by an
      // earlier failure.
      canContinue: passed && executedAll,
      results,
    };
  }
}
