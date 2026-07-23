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

export function evaluateGate(gate, { featureDir = null } = {}) {
  if (!gate) return { passed: true, reasons: [] };

  const reasons = [];
  for (const filename of gate.required_artifacts ?? []) {
    const relPath = featureDir ? path.join(featureDir, filename) : filename;
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      reasons.push(`missing required artifact "${filename}"`);
      continue;
    }
    if (gate.status) {
      const content = fs.readFileSync(absPath, "utf8");
      const status = extractStatusLine(content);
      if (status !== gate.status) {
        reasons.push(`artifact "${filename}" has STATUS "${status ?? "(none)"}", expected "${gate.status}"`);
      }
    }
  }

  return { passed: reasons.length === 0, reasons };
}
