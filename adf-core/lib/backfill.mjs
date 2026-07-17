import path from "node:path";
import { readTextIfExists, today } from "./fs-utils.mjs";
import { writeManifest, listArtifactFiles } from "./feature-io.mjs";
import { ARTIFACT_FILENAMES } from "./workflow-stages.mjs";
import { buildRecords } from "./records.mjs";

// Handles both metadata block conventions seen in this repo: active
// features use `* Label: value` (templates/specification.md), while the
// older bug-fix template (see _archive/BUG-AUTH-REDIRECT) uses
// `- **Label:** value`. Also joins wrapped continuation lines (a long
// Feature Name that line-wraps in the source, e.g. FEAT-006) so the parsed
// value isn't silently truncated at the first newline.
function parseSpecField(specText, labels) {
  if (!specText) return null;
  const lines = specText.split(/\r?\n/);
  for (const label of Array.isArray(labels) ? labels : [labels]) {
    const re = new RegExp(`^[*-]\\s*\\*{0,2}${label}:\\*{0,2}\\s*(.*)$`);
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(re);
      if (!match) continue;
      let value = match[1].trim();
      let j = i + 1;
      while (j < lines.length) {
        const trimmed = lines[j].trim();
        if (trimmed === "" || trimmed === "---" || trimmed === "⸻" || /^[*-]\s/.test(trimmed) || trimmed.startsWith("#")) break;
        value += (value ? " " : "") + trimmed;
        j++;
      }
      return value || null;
    }
  }
  return null;
}

function humanize(dirName) {
  return dirName
    .replace(/^FEAT-\d{3,}-/, "")
    .replace(/^BUG-/, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const PRIORITY_ALIASES = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };

// One-time (idempotent) recovery for feature directories that predate
// ADF Core: synthesizes a feature.json from what already exists on disk —
// the specification.md metadata block for name/priority, and the set of
// files actually present for supplementary_documents — instead of asking a
// human to retype 32 manifests by hand.
export function backfill({ dryRun = false } = {}) {
  const records = buildRecords();
  const created = [];
  const skipped = [];

  for (const r of records) {
    if (r.manifest) {
      skipped.push(r.name);
      continue;
    }
    const specText = readTextIfExists(path.join(r.dir, "specification.md"));
    const name = parseSpecField(specText, ["Feature Name", "Bug Name"]) ?? humanize(r.name);
    const rawPriority = parseSpecField(specText, ["Priority"]);
    const priority = rawPriority && PRIORITY_ALIASES[rawPriority.toLowerCase()]
      ? PRIORITY_ALIASES[rawPriority.toLowerCase()]
      : "Medium";

    const knownSet = new Set([...ARTIFACT_FILENAMES, "feature.json"]);
    const supplementary = listArtifactFiles(r.dir).filter((f) => !knownSet.has(f));

    const manifest = {
      id: r.expectedId,
      name,
      priority,
      owner: "Engineering",
      dependencies: [],
      related_features: [],
      supplementary_documents: supplementary,
      created_at: today(),
      backfilled: true,
    };

    if (!dryRun) writeManifest(r.dir, manifest);
    created.push(r.name);
  }

  return { created, skipped };
}
