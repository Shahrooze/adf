import fs from "node:fs";
import path from "node:path";
import {
  REPO_ROOT,
  ADF_CORE_DIR,
  writeJson,
  writeText,
  today,
  relativeToRoot,
} from "./fs-utils.mjs";
import { writeManifest, listArtifactFiles } from "./feature-io.mjs";
import { buildRecords, recordId } from "./records.mjs";
import { STAGES } from "./workflow-stages.mjs";

const GENERATED_HEADER = (title) =>
  `<!--\n  GENERATED FILE — do not hand-edit.\n  Produced by: node adf-core/cli.mjs generate\n  Source of truth: features/**/feature.json + features/**/*.md (each artifact's\n  own STATUS line) + context/**, policies/**, templates/**, agents/**.\n  Regenerate after any stage completes; never edit this file directly, your\n  changes will be overwritten on the next run.\n-->\n\n# ${title}\n`;

function mdList(dir, glob = /\.md$/) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && glob.test(e.name))
    .map((e) => e.name)
    .sort();
}

function firstLineAfterTitle(filePath) {
  if (!fs.existsSync(filePath)) return "";
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  let sawTitle = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!sawTitle) {
      if (line.startsWith("#")) sawTitle = true;
      continue;
    }
    if (line && !line.startsWith("#") && line !== "---") return line;
  }
  return "";
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function table(headers, rows) {
  if (rows.length === 0) return `_None._\n`;
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map(escapeCell).join(" | ")} |`).join("\n");
  return `${head}\n${sep}\n${body}\n`;
}

function statusOf(record) {
  return record.derived.status_summary.completion_status;
}

// --- feature.json "generated" block -----------------------------------

function writeGeneratedManifestBlocks(records) {
  for (const r of records) {
    if (!r.manifest) continue;
    r.manifest.generated = {
      stage: r.derived.stage,
      status: statusOf(r),
      gates: r.derived.gates,
      documents: r.derived.documents,
      status_summary: r.derived.status_summary,
      orphan_files: r.orphans,
      last_synced: today(),
    };
    writeManifest(r.dir, r.manifest);
  }
}

// --- registry.json -------------------------------------------------------

function buildRegistry(records) {
  return {
    generated_at: today(),
    feature_count: records.length,
    features: records.map((r) => ({
      id: recordId(r),
      name: r.manifest?.name ?? r.name,
      path: r.relPath,
      archived: r.archived,
      priority: r.manifest?.priority ?? null,
      owner: r.manifest?.owner ?? null,
      dependencies: r.manifest?.dependencies ?? [],
      related_features: r.manifest?.related_features ?? [],
      stage: r.derived.stage,
      status: statusOf(r),
      status_summary: r.derived.status_summary,
      gates: r.derived.gates,
      last_updated: r.manifest?.updated_at ?? r.manifest?.created_at ?? null,
      orphan_files: r.orphans,
    })),
  };
}

// --- INDEX.md --------------------------------------------------------------

function buildIndex(records) {
  const active = records.filter((r) => !r.archived);
  const released = active.filter((r) => statusOf(r) === "Release Ready");
  const inProgress = active.filter((r) => statusOf(r).startsWith("In Progress"));
  const blocked = active.filter((r) => statusOf(r).startsWith("Blocked"));
  const notStarted = active.filter((r) => statusOf(r) === "Not Started");
  const archived = records.filter((r) => r.archived);

  const featureRow = (r) => [
    recordId(r),
    r.manifest?.name ?? r.name,
    r.derived.stage ?? "—",
    statusOf(r),
    r.manifest?.priority ?? "—",
    r.manifest?.owner ?? "—",
  ];
  const headers = ["ID", "Name", "Last Completed Stage", "Status", "Priority", "Owner"];

  let out = GENERATED_HEADER("Project Index");
  out += `\nSingle entry point for "what exists and where" — read this before searching the repository by hand. Machine-readable equivalent: \`adf-core/registry.json\`.\n`;

  out += `\n## Snapshot\n\n`;
  out += table(
    ["Release Ready", "In Progress", "Blocked", "Not Started", "Archived"],
    [[released.length, inProgress.length, blocked.length, notStarted.length, archived.length]]
  );

  out += `\n## Blocked Features (need attention)\n\n`;
  out += table(headers, blocked.map(featureRow));

  out += `\n## In Progress\n\n`;
  out += table(headers, inProgress.map(featureRow));

  out += `\n## Release Ready\n\n`;
  out += table(headers, released.map(featureRow));

  if (notStarted.length) {
    out += `\n## Not Started\n\n`;
    out += table(headers, notStarted.map(featureRow));
  }

  out += `\n## Archived Features\n\n`;
  out += table(headers, archived.map(featureRow));

  out += `\n## Repository Map\n\n`;
  out += `### Framework layer (\`adf-core/\`)\n\n`;
  out += `- \`adf-core/registry.json\` — machine-readable Feature Registry (all fields above, per feature)\n`;
  out += `- \`adf-core/INDEX.md\` — this file\n`;
  out += `- \`adf-core/CONTEXT.md\` — generated project-state digest for agent context loading\n`;
  out += `- \`adf-core/DEPENDENCY-GRAPH.md\` — feature dependency graph and suggested build order\n`;
  out += `- \`adf-core/schema/feature.schema.md\` — feature.json field reference\n`;

  out += `\n### Durable context (\`context/\`)\n\n`;
  for (const f of mdList(path.join(REPO_ROOT, "context"))) {
    out += `- \`context/${f}\` — ${firstLineAfterTitle(path.join(REPO_ROOT, "context", f))}\n`;
  }

  const docsDir = path.join(REPO_ROOT, "docs");
  if (fs.existsSync(docsDir) && mdList(docsDir).length) {
    out += `\n### Standalone engineering docs (\`docs/\`)\n\n`;
    for (const f of mdList(docsDir)) {
      out += `- \`docs/${f}\` — ${firstLineAfterTitle(path.join(docsDir, f))}\n`;
    }
  }

  out += `\n### Engineering policies (\`policies/\`)\n\n`;
  for (const f of mdList(path.join(REPO_ROOT, "policies"))) {
    out += `- \`policies/${f}\` — ${firstLineAfterTitle(path.join(REPO_ROOT, "policies", f))}\n`;
  }

  out += `\n### Stage templates (\`templates/\`)\n\n`;
  for (const f of mdList(path.join(REPO_ROOT, "templates"))) {
    out += `- \`templates/${f}\`\n`;
  }

  out += `\n### Agents (\`agents/<stage>/\`)\n\n`;
  const agentsDir = path.join(REPO_ROOT, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const stage of fs.readdirSync(agentsDir).sort()) {
      out += `- \`agents/${stage}/\` — agent.yaml, instructions.md, system.md\n`;
    }
  }

  out += `\n### Slash commands\n\n`;
  out += `- Claude Code: \`.claude/commands/<stage>.md\`\n`;
  out += `- Codex CLI: \`.codex/prompts/<stage>.md\`\n`;

  out += `\n### Workflow definition\n\n`;
  out += `- \`workflows/feature-development.yaml\` — canonical stage order, gates, pass/fail criteria\n`;

  return out;
}

// --- CONTEXT.md --------------------------------------------------------------

function buildContext(records) {
  const active = records.filter((r) => !r.archived);
  const blocked = active.filter((r) => statusOf(r).startsWith("Blocked"));
  const inProgress = active.filter((r) => statusOf(r).startsWith("In Progress"));
  const released = active.filter((r) => statusOf(r) === "Release Ready");

  let out = GENERATED_HEADER("Generated Project Context");
  out += `\nA point-in-time digest of repository state, assembled entirely from existing files (feature manifests, artifact status lines, policy/context filenames). It never introduces information that isn't already recorded somewhere else — read the pointed-to file for full detail.\n`;

  out += `\n## Active Work\n\n`;
  out += inProgress.length
    ? inProgress
        .map((r) => `- **${recordId(r)}** ${r.manifest?.name ?? r.name} — ${statusOf(r)} (owner: ${r.manifest?.owner ?? "unassigned"})`)
        .join("\n") + "\n"
    : "_Nothing in progress._\n";

  out += `\n## Blocked Work (needs a decision or fix before it can continue)\n\n`;
  out += blocked.length
    ? blocked
        .map((r) => `- **${recordId(r)}** ${r.manifest?.name ?? r.name} — ${statusOf(r)}`)
        .join("\n") + "\n"
    : "_Nothing blocked._\n";

  out += `\n## Completed Work\n\n`;
  out += released.length
    ? `${released.length} features are Release Ready: ${released.map(recordId).join(", ")}\n`
    : "_None yet._\n";

  out += `\n## Architecture & Design Decisions\n\n`;
  out += `Per-feature architecture decisions live in \`features/<id>/architecture.md\` (technical) and \`features/<id>/design.md\` (UX/UI) — see the Project Index for which features have them. Project-wide technical conventions: \`context/tech-stack.md\`. Project-wide design conventions: \`context/design-system.md\`.\n`;

  out += `\n## Coding, Testing & Review Conventions\n\n`;
  out += `Enforced by the stages listed in \`workflows/feature-development.yaml\`; the human-readable rules live in \`policies/**\` (coding, testing, security, accessibility, api-design, architecture, observability, git, naming, quality-gates). Every implementation/review stage must read the policy file relevant to its own responsibility before writing content — see \`AGENTS.md\` → "Hard rules".\n`;

  out += `\n## Mandatory Constraints\n\n`;
  out += `- Check \`policies/quality-gates.md\` for any mandatory build/test verification rules this project has adopted — never report a stage, fix, or feature done without actually running and passing them.\n`;
  out += `- ADF Core sync is mandatory: every stage must end by running \`node adf-core/cli.mjs sync <feature-id>\` — see \`AGENTS.md\` → "Hard rules".\n`;
  out += `- No stage may modify an artifact owned by a previous stage; no reviewing stage may modify the artifact it reviews.\n`;

  out += `\n## Vision & Principles\n\n`;
  out += `See \`context/project.md\` (not duplicated here — it changes rarely and is the durable source).\n`;

  return out;
}

// --- DEPENDENCY-GRAPH.md ----------------------------------------------------

function topoOrder(records) {
  const ids = records.map(recordId);
  const idSet = new Set(ids);
  const depsOf = new Map(records.map((r) => [recordId(r), (r.manifest?.dependencies ?? []).filter((d) => idSet.has(d))]));
  const remaining = new Set(ids);
  const order = [];
  const inCycle = [];
  let progress = true;
  while (remaining.size && progress) {
    progress = false;
    for (const id of [...remaining]) {
      const deps = depsOf.get(id) ?? [];
      if (deps.every((d) => !remaining.has(d))) {
        order.push(id);
        remaining.delete(id);
        progress = true;
      }
    }
  }
  if (remaining.size) inCycle.push(...remaining);
  return { order, inCycle };
}

function buildDependencyGraph(records) {
  const active = records.filter((r) => !r.archived);
  const idToRecord = new Map(active.map((r) => [recordId(r), r]));

  let out = GENERATED_HEADER("Feature Dependency Graph");
  out += `\nDerived from each feature's \`feature.json\` \`dependencies\` field. An edge \`A --> B\` means **B depends on A** (A must exist / be stable first).\n`;

  const edges = [];
  for (const r of active) {
    for (const dep of r.manifest?.dependencies ?? []) {
      if (idToRecord.has(dep)) edges.push([dep, recordId(r)]);
    }
  }

  out += `\n## Graph\n\n`;
  if (edges.length === 0) {
    out += "_No declared cross-feature dependencies yet — see each feature's `feature.json`._\n";
  } else {
    out += "```mermaid\ngraph LR\n";
    for (const [from, to] of edges) out += `  ${from} --> ${to}\n`;
    out += "```\n";
  }

  out += `\n## Downstream Impact (who breaks if this feature changes)\n\n`;
  const downstreamRows = active.map((r) => {
    const id = recordId(r);
    const downstream = active.filter((other) => (other.manifest?.dependencies ?? []).includes(id)).map(recordId);
    return [id, r.manifest?.name ?? r.name, downstream.length ? downstream.join(", ") : "—"];
  });
  out += table(["ID", "Name", "Downstream (depends on this)"], downstreamRows);

  out += `\n## Suggested Implementation Order\n\n`;
  const { order, inCycle } = topoOrder(active);
  if (inCycle.length) {
    out += `**Circular dependency detected — cannot compute a safe order for:** ${inCycle.join(", ")}. Run \`node adf-core/cli.mjs validate\` for details.\n\n`;
  }
  out += order.length
    ? order.map((id, i) => `${i + 1}. ${id} — ${idToRecord.get(id)?.manifest?.name ?? id}`).join("\n") + "\n"
    : "_Nothing to order._\n";

  return out;
}

// --- entry point -------------------------------------------------------

export function generate() {
  const records = buildRecords();
  writeGeneratedManifestBlocks(records);
  // Re-read after writing so registry/index reflect the just-written
  // generated blocks (buildRecords() already computed the same derived
  // data in memory, so this is purely for freshness symmetry — cheap at
  // this repo's scale).
  writeJson(path.join(ADF_CORE_DIR, "registry.json"), buildRegistry(records));
  writeText(path.join(ADF_CORE_DIR, "INDEX.md"), buildIndex(records));
  writeText(path.join(ADF_CORE_DIR, "CONTEXT.md"), buildContext(records));
  writeText(path.join(ADF_CORE_DIR, "DEPENDENCY-GRAPH.md"), buildDependencyGraph(records));
  return records;
}
