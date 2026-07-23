import { parseArgs, parseCsv } from "../args.mjs";
import { section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";

const HELP = `Usage:
  adf validate [--stages lint,unit-tests,...] [--continue-on-failure]

Runs the Validation Pipeline (config/validation-steps.json). A step with
no configured command is skipped. Exits non-zero if the pipeline can't
continue (see runtime.config.json's validation.continueOnFailure).`;

export async function validateCommand(harness, argv) {
  const { flags } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }

  const stages = parseCsv(flags.stages).length ? parseCsv(flags.stages) : null;
  if (flags["continue-on-failure"]) harness.validationPipeline.continueOnFailure = true;

  const result = await harness.validationPipeline.run({ stages });

  section("Validation Pipeline");
  for (const step of result.results) {
    const marker = step.result === "passed" ? "ok  " : step.result === "skipped" ? "skip" : "FAIL";
    console.log(`  [${marker}] ${step.step}${step.command ? ` (${step.command})` : ""}`);
    if (step.result === "failed") {
      if (step.error) console.error(`        ${step.error}`);
      if (step.stderr) console.error(step.stderr.split("\n").map((l) => `        ${l}`).join("\n"));
    }
  }

  console.log(`\nOverall: ${result.passed ? "PASSED" : "FAILED"} — canContinue: ${result.canContinue}`);
  return result.canContinue ? codes.OK : codes.RUN_FAILED;
}
