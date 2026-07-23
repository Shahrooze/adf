// `adf run <workflow-id>` is a convenience alias for the most common
// action — `adf workflow run <workflow-id>` — kept as its own top-level
// verb because that is how it is listed in the Harness's CLI surface.
import { workflowCommand } from "./workflow.mjs";

export async function runCommand(harness, argv) {
  return workflowCommand(harness, ["run", ...argv]);
}
