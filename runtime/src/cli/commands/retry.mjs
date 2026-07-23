import { parseArgs } from "../args.mjs";
import { section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";

const HELP = `Usage:
  adf retry <run-id>

Re-runs a workflow that ended FAILED, starting from the stage that
failed (checkpoints record the index of the first not-yet-passed stage,
so this and "adf resume" share the same underlying mechanism — this
command just checks the run actually failed first and reports it as a
retry).`;

export async function retryCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h || positional.length === 0) {
    console.log(HELP);
    return positional.length === 0 ? codes.USAGE_ERROR : codes.OK;
  }
  const [runId] = positional;

  if (!harness.checkpointStore.exists(runId)) {
    console.error(`No checkpoint found for run "${runId}".`);
    return codes.USAGE_ERROR;
  }
  const checkpoint = harness.checkpointStore.load(runId);
  if (checkpoint.status !== "failed") {
    console.error(`Run "${runId}" is "${checkpoint.status}", not "failed" — use "adf resume" instead.`);
    return codes.USAGE_ERROR;
  }

  const failedStageId = Object.values(checkpoint.stageResults).find((r) => !r.passed && !r.skipped)?.stageId;
  console.log(`Retrying workflow "${checkpoint.workflowId}" run "${runId}" — retrying stage "${failedStageId ?? "?"}"...`);

  const result = await harness.workflowEngine.run(checkpoint.workflowId, { resumeFromRunId: runId });
  section(`Run ${result.id}`);
  console.log(`Status: ${result.status}`);
  if (result.error) console.error(`Error: ${result.error}`);

  return result.status === "completed" ? codes.OK : codes.RUN_FAILED;
}
