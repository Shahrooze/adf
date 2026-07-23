import { parseArgs } from "../args.mjs";
import { printTable, printJson, section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";

const HELP = `Usage:
  adf artifacts [--type T] [--status S] [--workflow-run-id ID]   List tracked artifacts.
  adf artifacts show <artifact-id>                               Show one artifact's detail + history.`;

export async function artifactsCommand(harness, argv) {
  const { flags, positional } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const [sub] = positional;

  if (sub === "show") {
    const [id] = positional.slice(1);
    if (!id || !harness.artifactManager.has(id)) {
      console.error(`Unknown artifact "${id}". Run "adf artifacts" to list known artifacts.`);
      return codes.USAGE_ERROR;
    }
    const record = harness.artifactManager.get(id);
    section(`Artifact ${id}`);
    printJson(record);
    return codes.OK;
  }

  const list = harness.artifactManager.list({
    type: flags.type ?? null,
    status: flags.status ?? null,
    workflowRunId: flags["workflow-run-id"] ?? null,
  });

  if (flags.json) {
    printJson(list);
    return codes.OK;
  }

  printTable(
    list.map((a) => ({ id: a.id, type: a.type, version: a.version, status: a.status, author: a.author, updated: a.updatedAt })),
    [
      { key: "id", header: "ID" },
      { key: "type", header: "TYPE" },
      { key: "version", header: "VERSION" },
      { key: "status", header: "STATUS" },
      { key: "author", header: "AUTHOR" },
      { key: "updated", header: "UPDATED AT" },
    ]
  );
  return codes.OK;
}
