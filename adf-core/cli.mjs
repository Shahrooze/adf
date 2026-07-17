#!/usr/bin/env node
// ADF Core CLI — repository-based feature registry, project index, context
// generator, dependency graph, and validation engine. Zero dependencies:
// plain Node ESM, no npm install required. See adf-core/README.md.
//
// Usage:
//   node adf-core/cli.mjs next-id [FEAT|BUG]
//   node adf-core/cli.mjs new <feature-dir-name> --priority <P> --owner <O> [--depends A,B] [--related A,B]
//   node adf-core/cli.mjs backfill [--dry-run]
//   node adf-core/cli.mjs generate
//   node adf-core/cli.mjs validate [feature-id]
//   node adf-core/cli.mjs sync [feature-id]

import path from "node:path";
import { FEATURES_DIR, ARCHIVE_DIR, readTextIfExists } from "./lib/fs-utils.mjs";
import { listFeatureEntries, readManifest, writeManifest, idFromDirName } from "./lib/feature-io.mjs";
import { buildRecords, recordId } from "./lib/records.mjs";
import { runAllRules } from "./lib/validate-rules.mjs";
import { generate } from "./lib/generate.mjs";
import { backfill } from "./lib/backfill.mjs";
import { today } from "./lib/fs-utils.mjs";

const GLOBAL_CODES = new Set(["duplicate-id", "circular-dependency"]);

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function cmdNextId(argv) {
  const prefix = argv[0] === "BUG" ? "BUG" : "FEAT";
  const entries = listFeatureEntries();
  let max = 0;
  for (const e of entries) {
    const match = e.name.match(/^FEAT-(\d{3,})/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  const next = String(max + 1).padStart(3, "0");
  console.log(prefix === "FEAT" ? `FEAT-${next}` : "BUG-<short-descriptive-slug>");
}

function cmdNew(argv) {
  const { flags, positional } = parseFlags(argv);
  const dirName = positional[0];
  if (!dirName) {
    console.error("Usage: node adf-core/cli.mjs new <feature-dir-name> --priority <P> --owner <O>");
    process.exit(1);
  }
  const dir = path.join(FEATURES_DIR, dirName);
  const specPath = path.join(dir, "specification.md");
  if (!readTextIfExists(specPath)) {
    console.error(
      `Error: ${dirName}/specification.md does not exist yet. Create the feature directory and specification.md first (per agents/feature/instructions.md), then run this command.`
    );
    process.exit(1);
  }
  const existing = readManifest(dir);
  if (existing) {
    console.error(`Error: ${dirName}/feature.json already exists. Edit it directly or use sync to refresh generated fields.`);
    process.exit(1);
  }
  const id = idFromDirName(dirName);
  const nameMatch = readTextIfExists(specPath).match(/^\*\s*Feature Name:\s*(.+)$/m);
  const manifest = {
    id,
    name: nameMatch ? nameMatch[1].trim() : dirName,
    priority: flags.priority ?? "Medium",
    owner: flags.owner ?? "Engineering",
    dependencies: flags.depends ? String(flags.depends).split(",").map((s) => s.trim()).filter(Boolean) : [],
    related_features: flags.related ? String(flags.related).split(",").map((s) => s.trim()).filter(Boolean) : [],
    supplementary_documents: [],
    created_at: today(),
  };
  writeManifest(dir, manifest);
  console.log(`Created ${dirName}/feature.json (id: ${id})`);
  generate();
  console.log("Regenerated adf-core registry/index/context/dependency-graph.");
}

function cmdBackfill(argv) {
  const { flags } = parseFlags(argv);
  const { created, skipped } = backfill({ dryRun: Boolean(flags["dry-run"]) });
  console.log(`feature.json created for ${created.length} feature(s): ${created.join(", ") || "(none)"}`);
  console.log(`Skipped ${skipped.length} feature(s) that already had feature.json.`);
  if (!flags["dry-run"] && created.length) {
    generate();
    console.log("Regenerated adf-core registry/index/context/dependency-graph.");
  }
}

function cmdGenerate() {
  generate();
  console.log("Regenerated adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and every feature.json's generated block.");
}

// scopeId may be either the short Feature ID (FEAT-001) or the full feature
// directory name (FEAT-001-user-authentication) — stage commands pass
// whichever form the caller used for <feature-name>, so both must resolve
// to the same feature.
function runValidation(scopeId) {
  const records = buildRecords();
  let findings = runAllRules(records);
  if (scopeId) {
    const scopeRecord = records.find((r) => r.name === scopeId || recordId(r) === scopeId);
    const scopeIds = scopeRecord ? new Set([scopeRecord.name, recordId(scopeRecord)]) : new Set([scopeId]);
    findings = findings.filter((f) => scopeIds.has(f.feature) || GLOBAL_CODES.has(f.code));
  }
  return { records, findings };
}

function cmdValidate(argv) {
  const scopeId = argv[0];
  const { findings } = runValidation(scopeId);
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  if (scopeId) console.log(`ADF Core validation — scope: ${scopeId}\n`);
  else console.log(`ADF Core validation — full repository\n`);

  for (const f of errors) console.log(`ERROR   [${f.code}] ${f.feature}: ${f.message}`);
  for (const f of warnings) console.log(`WARNING [${f.code}] ${f.feature}: ${f.message}`);

  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
  if (errors.length) {
    console.log("Validation FAILED.");
    process.exit(1);
  }
  console.log("Validation passed.");
}

function cmdSync(argv) {
  const scopeId = argv[0];
  generate();
  cmdValidate(scopeId ? [scopeId] : []);
}

function main() {
  const [, , command, ...rest] = process.argv;
  switch (command) {
    case "next-id":
      return cmdNextId(rest);
    case "new":
      return cmdNew(rest);
    case "backfill":
      return cmdBackfill(rest);
    case "generate":
      return cmdGenerate();
    case "validate":
      return cmdValidate(rest);
    case "sync":
      return cmdSync(rest);
    default:
      console.error(
        "Usage: node adf-core/cli.mjs <next-id|new|backfill|generate|validate|sync> [args]"
      );
      process.exit(1);
  }
}

main();
