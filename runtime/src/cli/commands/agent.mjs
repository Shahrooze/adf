import { parseArgs, parseCsv } from "../args.mjs";
import { printTable, printJson, section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";

const HELP = `Usage:
  adf agent list
  adf agent run <agent-id> [--feature-dir <dir>] [--produces a.md,b.md] [--consumes a.md,b.md]
                            [--executor <name>] [--task "description"] [--gate-status STATUS]

Runs a single agent through the Agent Runtime, outside of any workflow.`;

export async function agentCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const [sub, ...rest] = positional;

  if (sub === "list") {
    const rows = harness.agentRegistry.list().map((a) => ({
      id: a.id,
      name: a.name,
      capabilities: a.capabilities.join(","),
      tools: a.requiredTools.join(","),
    }));
    printTable(rows, [
      { key: "id", header: "ID" },
      { key: "name", header: "NAME" },
      { key: "capabilities", header: "CAPABILITIES" },
      { key: "tools", header: "TOOLS" },
    ]);
    if (harness.agentRegistry.errors().length) {
      section("Agent registry errors");
      for (const e of harness.agentRegistry.errors()) console.error(`  ${e.dir}: ${e.error}`);
    }
    return codes.OK;
  }

  if (sub === "run") {
    const [agentId] = rest;
    if (!agentId) {
      console.error("Usage: adf agent run <agent-id> [options]");
      return codes.USAGE_ERROR;
    }
    if (!harness.agentRegistry.has(agentId)) {
      console.error(`Unknown agent "${agentId}". Run "adf agent list" to see what's available.`);
      return codes.USAGE_ERROR;
    }

    const featureDir = flags["feature-dir"] ?? null;
    const produces = parseCsv(flags.produces);
    const consumes = parseCsv(flags.consumes).length ? parseCsv(flags.consumes) : null;

    console.log(`Running agent "${agentId}"...`);
    const result = await harness.agentRuntime.run(agentId, {
      featureDir,
      consumesPaths: consumes,
      executorName: flags.executor ?? null,
      task: {
        stageId: "adhoc",
        produces,
        gateStatus: flags["gate-status"] ?? null,
        description: flags.task ?? "",
      },
    });

    console.log(`\nExecution "${result.id}" finished with status: ${result.status}`);
    if (result.error) console.error(`Error: ${result.error}`);
    if (result.artifacts?.length) {
      section("Artifacts produced");
      for (const a of result.artifacts) console.log(`  ${a.id} (v${a.version}, ${a.status})`);
    }
    if (flags.json) printJson(result);

    return result.status === "completed" ? codes.OK : codes.RUN_FAILED;
  }

  console.log(HELP);
  return codes.USAGE_ERROR;
}
