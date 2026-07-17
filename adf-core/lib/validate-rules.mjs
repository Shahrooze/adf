import { STAGES } from "./workflow-stages.mjs";

export const PRIORITY_LEVELS = ["Critical", "High", "Medium", "Low"];
const REQUIRED_FIELDS = ["id", "name", "priority", "owner"];

// Each rule takes the full list of resolved feature records
// ({ name, dir, archived, manifest, derived, orphans, relPath }) and returns
// an array of { level: "error" | "warning", code, feature, message }.
// Keeping every rule a pure function over the same input makes it trivial to
// unit test (see adf-core/tests) and to add new rules without touching the
// CLI or the aggregation logic.

function finding(level, code, feature, message) {
  return { level, code, feature, message };
}

export function ruleManifestPresent(records) {
  return records
    .filter((r) => !r.manifest)
    .map((r) =>
      finding(
        "error",
        "missing-manifest",
        r.name,
        `${r.relPath}/feature.json does not exist. Run: node adf-core/cli.mjs backfill`
      )
    );
}

export function ruleRequiredFields(records) {
  const out = [];
  for (const r of records) {
    if (!r.manifest) continue;
    for (const field of REQUIRED_FIELDS) {
      if (!r.manifest[field]) {
        out.push(
          finding("error", "missing-field", r.name, `feature.json is missing required field "${field}"`)
        );
      }
    }
    if (r.manifest.priority && !PRIORITY_LEVELS.includes(r.manifest.priority)) {
      out.push(
        finding(
          "error",
          "invalid-priority",
          r.name,
          `priority "${r.manifest.priority}" is not one of ${PRIORITY_LEVELS.join(", ")}`
        )
      );
    }
  }
  return out;
}

export function ruleIdConsistency(records) {
  const out = [];
  const seen = new Map();
  for (const r of records) {
    const expected = r.expectedId;
    if (r.manifest && r.manifest.id && r.manifest.id !== expected) {
      out.push(
        finding(
          "error",
          "id-mismatch",
          r.name,
          `feature.json id "${r.manifest.id}" does not match directory-derived id "${expected}"`
        )
      );
    }
    const id = r.manifest?.id ?? expected;
    if (seen.has(id)) {
      out.push(
        finding(
          "error",
          "duplicate-id",
          r.name,
          `duplicate Feature ID "${id}" also used by ${seen.get(id)}`
        )
      );
    } else {
      seen.set(id, r.name);
    }
  }
  return out;
}

export function ruleReferences(records) {
  const out = [];
  const knownIds = new Set(records.map((r) => r.manifest?.id ?? r.expectedId));
  for (const r of records) {
    if (!r.manifest) continue;
    const id = r.manifest.id ?? r.expectedId;
    for (const field of ["dependencies", "related_features"]) {
      for (const ref of r.manifest[field] ?? []) {
        if (ref === id) {
          out.push(finding("error", "self-reference", r.name, `${field} references itself ("${ref}")`));
        } else if (!knownIds.has(ref)) {
          out.push(
            finding("error", "broken-reference", r.name, `${field} references unknown feature "${ref}"`)
          );
        }
      }
    }
  }
  return out;
}

export function ruleCircularDependencies(records) {
  const byId = new Map(records.map((r) => [r.manifest?.id ?? r.expectedId, r]));
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const out = [];

  function visit(id, chain) {
    if (color.get(id) === BLACK) return;
    if (color.get(id) === GRAY) {
      const cycleStart = chain.indexOf(id);
      const cycle = [...chain.slice(cycleStart), id].join(" -> ");
      out.push(finding("error", "circular-dependency", byId.get(id)?.name ?? id, `dependency cycle: ${cycle}`));
      return;
    }
    color.set(id, GRAY);
    const record = byId.get(id);
    for (const dep of record?.manifest?.dependencies ?? []) {
      if (byId.has(dep)) visit(dep, [...chain, id]);
    }
    color.set(id, BLACK);
  }

  for (const id of byId.keys()) {
    if (color.get(id) !== BLACK) visit(id, []);
  }
  // De-duplicate: a single cycle is discovered once per node visited from a
  // fresh start; keep only the first report per unique cycle message.
  const uniq = new Map();
  for (const f of out) uniq.set(f.message, f);
  return [...uniq.values()];
}

export function ruleOrphanFiles(records) {
  const out = [];
  for (const r of records) {
    for (const file of r.orphans ?? []) {
      out.push(
        finding(
          "warning",
          "orphan-file",
          r.name,
          `${file} is not a recognized pipeline artifact. Declare it in feature.json's "supplementary_documents" if intentional, otherwise remove or rename it.`
        )
      );
    }
  }
  return out;
}

export function ruleIncompleteRelease(records) {
  const out = [];
  for (const r of records) {
    if (r.archived) continue;
    const gates = r.derived?.gates ?? {};
    if (gates["code-review"] !== "RELEASE_READY") continue;
    for (const stage of STAGES) {
      if (!gates[stage.id]) {
        const doc = r.derived?.documents?.[stage.id];
        const reason = doc === null
          ? `${stage.artifact} does not exist`
          : `${stage.artifact} exists but has no recognizable terminal STATUS line (it may be stopped/blocked, or the line is missing/misplaced)`;
        out.push(
          finding(
            "error",
            "incomplete-release",
            r.name,
            `claims RELEASE_READY but ${stage.id} is not satisfied — ${reason}`
          )
        );
      }
    }
  }
  return out;
}

export function ruleInconsistentGate(records) {
  const out = [];
  for (const r of records) {
    if (r.archived) continue;
    for (const stage of STAGES) {
      const doc = r.derived?.documents?.[stage.id];
      if (!doc || !doc.status) continue;
      if (doc.status !== stage.readyStatus) {
        out.push(
          finding(
            "warning",
            "gate-not-satisfied",
            r.name,
            `${stage.artifact} ends with STATUS: ${doc.status}, not the expected gate value ${stage.readyStatus} — pipeline is stopped at this stage until it is resubmitted`
          )
        );
      }
    }
  }
  return out;
}

export const ALL_RULES = [
  ruleManifestPresent,
  ruleRequiredFields,
  ruleIdConsistency,
  ruleReferences,
  ruleCircularDependencies,
  ruleOrphanFiles,
  ruleIncompleteRelease,
  ruleInconsistentGate,
];

export function runAllRules(records) {
  return ALL_RULES.flatMap((rule) => rule(records));
}
