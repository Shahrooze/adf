import { parseArgs } from "../args.mjs";
import { section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";

const HELP = `Usage:
  adf resume <run-id>

Resumes a paused or interrupted workflow run from its last checkpoint
(.adf/checkpoints/<run-id>.json), continuing from the first not-yet-passed
stage. See "adf retry" for re-running a run that ended FAILED.`;

export async function resumeCommand(harness, argv) {
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
  console.log(`Resuming workflow "${checkpoint.workflowId}" run "${runId}" from stage index ${checkpoint.currentStageIndex}...`);

  const result = await harness.workflowEngine.run(checkpoint.workflowId, { resumeFromRunId: runId });
  section(`Run ${result.id}`);
  console.log(`Status: ${result.status}`);
  if (result.error) console.error(`Error: ${result.error}`);

  if (result.status === "completed") return codes.OK;
  if (result.status === "cancelled") return codes.RUN_CANCELLED;
  return codes.RUN_FAILED;
}
