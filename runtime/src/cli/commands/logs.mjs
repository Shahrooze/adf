import { parseArgs } from "../args.mjs";
import { printJson } from "../output.mjs";
import * as codes from "../exit-codes.mjs";
import { Logger } from "../../logging/logger.mjs";
import { buildTimeline, renderTimelineText } from "../../observability/timeline.mjs";
import { computeMetrics } from "../../observability/metrics.mjs";

const HELP = `Usage:
  adf logs                  List every run id with a log file.
  adf logs <run-id>          Print that run's timeline.
  adf logs <run-id> --tail N Print only the last N entries.
  adf logs <run-id> --json   Print raw JSONL entries as JSON.
  adf logs <run-id> --metrics Print aggregated agent/tool metrics for the run.`;

export async function logsCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const [runId] = positional;

  if (!runId) {
    for (const id of Logger.listRuns(harness.logger.logDir)) console.log(id);
    return codes.OK;
  }

  let entries = Logger.readRun(runId, harness.logger.logDir);
  if (entries.length === 0) {
    console.error(`No log entries found for run "${runId}".`);
    return codes.USAGE_ERROR;
  }
  if (flags.tail) entries = entries.slice(-Number(flags.tail));

  if (flags.metrics) {
    printJson(computeMetrics(entries));
    return codes.OK;
  }
  if (flags.json) {
    printJson(entries);
    return codes.OK;
  }

  console.log(renderTimelineText(buildTimeline(entries)));
  return codes.OK;
}
