// Backward-compatible passthrough to adf-core/cli.mjs — the pre-Harness
// feature-registry/validation/context-generation tool. It is untouched by
// this refactor and keeps working exactly as before; this just gives it a
// namespaced home under the new unified `adf` CLI so `adf validate` can
// mean "run the Validation Pipeline" without colliding with adf-core's own
// (differently-scoped) `validate` command.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { REPO_ROOT } from "../../config/paths.mjs";
import * as codes from "../exit-codes.mjs";

const ADF_CORE_CLI = path.join(REPO_ROOT, "adf-core", "cli.mjs");

const HELP = `Usage:
  adf registry <init|new|next-id|backfill|generate|validate|sync> [args...]

Passes through to adf-core/cli.mjs — the feature registry, project index,
context digest, dependency graph, and staged-gate validation tool that
predates the Harness. See adf-core/README.md for its full command
reference. Unaffected by anything else in the Harness.`;

export async function registryCommand(_harness, argv) {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    return codes.OK;
  }
  const result = spawnSync(process.execPath, [ADF_CORE_CLI, ...argv], { stdio: "inherit" });
  return result.status ?? codes.GENERIC_ERROR;
}
