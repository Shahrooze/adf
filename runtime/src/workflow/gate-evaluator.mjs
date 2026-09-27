// Checks a stage's quality gate: every required artifact must exist, and
// if the gate specifies a status, the artifact's own STATUS line (the
// convention every templates/*.md already follows) must match. This
// reuses adf-core's own status-line extraction so the Harness and
// adf-core's `validate`/`sync` commands agree on what "the status" means
// for a given document — one convention, not two.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../config/paths.mjs";
import { extractStatusLine } from "../../../adf-core/lib/fs-utils.mjs";

// Returns { passed, rejected, statuses, reasons }. `rejected` is true when
// an artifact carries one of the gate's reject_statuses: the agent did its
// job and the verdict is "no" -- distinct from a missing/garbled artifact.
// Deterministic checks (gate.checks) are run by the Workflow Engine, not
// here, because they need the Validation Pipeline.
export function evaluateGate(gate, { featureDir = null } = {}) {
  if (!gate) return { passed: true, rejected: false, statuses: {}, reasons: [] };

  const reasons = [];
  const statuses = {};
  let rejected = false;
  for (const filename of gate.required_artifacts ?? []) {
    const relPath = featureDir ? path.join(featureDir, filename) : filename;
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      reasons.push(`missing required artifact "${filename}"`);
      continue;
    }
    const content = fs.readFileSync(absPath, "utf8");
    const status = extractStatusLine(content);
    statuses[filename] = status;
    if (gate.status && status !== gate.status) {
      if (status && (gate.reject_statuses ?? []).includes(status)) {
        rejected = true;
        reasons.push(`artifact "${filename}" was rejected by its reviewer (STATUS: ${status})`);
      } else {
        reasons.push(`artifact "${filename}" has STATUS "${status ?? "(none)"}", expected "${gate.status}"`);
      }
    }
    if (gate.markers?.length) {
      const lines = new Set(content.split(/\r?\n/).map((l) => l.trim()));
      for (const marker of gate.markers) {
        if (!lines.has(marker)) reasons.push(`artifact "${filename}" is missing required line "${marker}"`);
      }
    }
  }

  return { passed: reasons.length === 0, rejected, statuses, reasons };
}
