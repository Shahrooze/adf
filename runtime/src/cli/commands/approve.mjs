import { parseArgs } from "../args.mjs";
import { section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";
import { reportRunOutcome } from "./workflow.mjs";

const HELP = `Usage:
  adf approve <run-id> [--by <name>]
  adf approve <run-id> --reject --reason "<what must change>" [--by <name>]

Records a human decision on a workflow run that is "awaiting_approval"
and continues it. Approving moves on to the next stage. Rejecting re-runs
the stage that is waiting, with --reason given to its agent as rework
feedback (bounded by the stage's on_fail.max_rounds / workflow.maxReworkRounds).`;

export async function approveCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h || positional.length === 0) {
    console.log(HELP);
    return positional.length === 0 ? codes.USAGE_ERROR : codes.OK;
  }
  const [runId] = positional;
  const checkpoint = harness.checkpointStore.load(runId);
  if (!checkpoint) {
    console.error(`No checkpoint found for run "${runId}".`);
    return codes.USAGE_ERROR;
  }
  const reject = Boolean(flags.reject);
  const reason = typeof flags.reason === "string" ? flags.reason : null;
  if (reject && !reason) {
    console.error('Rejecting needs --reason "<what must change>" — it is sent to the agent as feedback.');
    return codes.USAGE_ERROR;
  }

  let decision;
  try {
    decision = harness.workflowEngine.decideApproval(runId, {
      approved: !reject,
      reason,
      by: typeof flags.by === "string" ? flags.by : process.env.USER ?? "cli",
    });
  } catch (err) {
    console.error(err.message);
    return codes.USAGE_ERROR;
  }
  section(`Run ${runId}`);
  console.log(`Stage "${decision.stageId}" ${decision.approved ? "approved" : "rejected"}; continuing...`);

  const result = await harness.workflowEngine.run(checkpoint.workflowId, { resumeFromRunId: runId });
  return reportRunOutcome(result);
}
