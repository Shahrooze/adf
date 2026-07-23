import { parseArgs } from "../args.mjs";
import { printTable, printJson, section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";
import { parseWorkflow } from "../../workflow/workflow-parser.mjs";
import { renderRunReport } from "../../observability/report.mjs";
import { Logger } from "../../logging/logger.mjs";

const HELP = `Usage:
  adf status                Show the queue and every known workflow run's checkpoint status.
  adf status <run-id>       Show a single run's detail.
  adf status <run-id> --report   Also print the full execution report (mermaid diagram, metrics, timeline).`;

export async function statusCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const [runId] = positional;

  if (!runId) {
    section("Queue");
    console.log(`${harness.queue.size} job(s) tracked (running + queued).`);

    section("Workflow runs (from checkpoints)");
    const runs = harness.checkpointStore.list().map((id) => harness.checkpointStore.load(id));
    printTable(
      runs.map((r) => ({
        id: r.id,
        workflowId: r.workflowId,
        status: r.status,
        stage: r.currentStageIndex,
        updated: r.checkpointedAt,
      })),
      [
        { key: "id", header: "RUN ID" },
        { key: "workflowId", header: "WORKFLOW" },
        { key: "status", header: "STATUS" },
        { key: "stage", header: "STAGE#" },
        { key: "updated", header: "CHECKPOINTED AT" },
      ]
    );
    return codes.OK;
  }

  const checkpoint = harness.checkpointStore.load(runId);
  if (!checkpoint) {
    console.error(`No checkpoint found for run "${runId}".`);
    return codes.USAGE_ERROR;
  }

  section(`Run ${runId}`);
  console.log(`Workflow: ${checkpoint.workflowId}`);
  console.log(`Status: ${checkpoint.status}`);
  console.log(`Stage index: ${checkpoint.currentStageIndex}`);
  if (checkpoint.error) console.log(`Error: ${checkpoint.error}`);
  for (const [stageId, r] of Object.entries(checkpoint.stageResults ?? {})) {
    console.log(`  [${r.skipped ? "skip" : r.passed ? "ok  " : "FAIL"}] ${stageId}`);
  }

  if (flags.report) {
    const def = parseWorkflow(harness.workflowRegistry.get(checkpoint.workflowId).raw);
    const logEntries = Logger.readRun(runId, harness.logger.logDir);
    console.log("\n" + renderRunReport({ workflowDefinition: def, runResult: checkpoint, logEntries }));
  }

  if (flags.json) printJson(checkpoint);
  return codes.OK;
}
