import fs from "node:fs";
import path from "node:path";
import { parseArgs, parseKeyValueList } from "../args.mjs";
import { printTable, printJson, section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";
import { parseWorkflow } from "../../workflow/workflow-parser.mjs";
import { renderRunReport } from "../../observability/report.mjs";
import { Logger } from "../../logging/logger.mjs";
import { adfStateDir, REPO_ROOT } from "../../config/paths.mjs";

const HELP = `Usage:
  adf workflow list
  adf workflow show <workflow-id>
  adf workflow run <workflow-id> [--feature-dir <dir>] [--run-id <id>] [--context k=v,...] [--report]

Runs a declarative workflow (workflows/*.yaml) through the Workflow Engine.`;

export async function workflowCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const [sub, ...rest] = positional;

  if (sub === "list") {
    const rows = harness.workflowRegistry.list().map((w) => ({
      id: w.raw.id,
      name: w.raw.name ?? w.raw.id,
      stages: (w.raw.stages ?? []).length,
      file: w.file,
    }));
    printTable(rows, [
      { key: "id", header: "ID" },
      { key: "name", header: "NAME" },
      { key: "stages", header: "STAGES" },
      { key: "file", header: "FILE" },
    ]);
    return codes.OK;
  }

  if (sub === "show") {
    const [workflowId] = rest;
    if (!workflowId) {
      console.error("Usage: adf workflow show <workflow-id>");
      return codes.USAGE_ERROR;
    }
    const def = parseWorkflow(harness.workflowRegistry.get(workflowId).raw);
    section(`${def.name} (${def.id})`);
    console.log(def.description);
    for (const stage of def.stages) {
      if (stage.type === "parallel") {
        console.log(`  [parallel] ${stage.id}: ${stage.branches.map((b) => b.agent ?? b.id).join(" + ")}`);
      } else {
        console.log(`  [${stage.type}] ${stage.id}${stage.agent ? ` -> ${stage.agent}` : ""}${stage.condition ? " (conditional)" : ""}`);
      }
    }
    return codes.OK;
  }

  if (sub === "run") {
    const [workflowId] = rest;
    if (!workflowId) {
      console.error("Usage: adf workflow run <workflow-id> [options]");
      return codes.USAGE_ERROR;
    }
    if (!harness.workflowRegistry.has(workflowId)) {
      console.error(`Unknown workflow "${workflowId}". Run "adf workflow list" to see what's available.`);
      return codes.USAGE_ERROR;
    }

    const featureDir = flags["feature-dir"] ?? null;
    const runId = flags["run-id"] ?? null;
    const context = parseKeyValueList(flags.context);

    console.log(`Running workflow "${workflowId}"${featureDir ? ` (feature dir: ${featureDir})` : ""}...`);
    const result = await harness.workflowEngine.run(workflowId, { runId, featureDir, context });
    console.log(`\nRun "${result.id}" finished with status: ${result.status}`);
    if (result.error) console.error(`Error: ${result.error}`);

    for (const [stageId, stageResult] of Object.entries(result.stageResults)) {
      const marker = stageResult.skipped ? "skip" : stageResult.passed ? "ok  " : "FAIL";
      console.log(`  [${marker}] ${stageId}${stageResult.error ? ` — ${stageResult.error}` : ""}`);
    }

    if (flags.report) {
      const def = parseWorkflow(harness.workflowRegistry.get(workflowId).raw);
      const logEntries = Logger.readRun(result.id, harness.logger.logDir);
      const report = renderRunReport({ workflowDefinition: def, runResult: result, logEntries });
      const reportPath = path.join(adfStateDir("reports"), `${result.id}.md`);
      fs.writeFileSync(reportPath, report, "utf8");
      console.log(`\nReport written to ${path.relative(REPO_ROOT, reportPath)}`);
    }

    if (flags.json) printJson(result);

    if (result.status === "completed") return codes.OK;
    if (result.status === "cancelled") return codes.RUN_CANCELLED;
    return codes.RUN_FAILED;
  }

  console.log(HELP);
  return codes.USAGE_ERROR;
}
