#!/usr/bin/env node
// ADF Core CLI — repository-based feature registry, project index, context
// generator, dependency graph, and validation engine. Zero dependencies:
// plain Node ESM, no npm install required. See adf-core/README.md.
//
// Usage:
//   node adf-core/cli.mjs init [--yes|-y] [--from <file>] [--set k=v ...] [--force|-f]
//   node adf-core/cli.mjs next-id [FEAT|BUG]
//   node adf-core/cli.mjs new <feature-dir-name> --priority <P> --owner <O> [--depends A,B] [--related A,B]
//   node adf-core/cli.mjs backfill [--dry-run]
//   node adf-core/cli.mjs generate
//   node adf-core/cli.mjs validate [feature-id] [--json]
//   node adf-core/cli.mjs sync [feature-id]
//
// Every command accepts --help/-h. Run with --version/-v to print the ADF
// Core version.

import path from "node:path";
import { FEATURES_DIR, ARCHIVE_DIR, readTextIfExists } from "./lib/fs-utils.mjs";
import { listFeatureEntries, readManifest, writeManifest, idFromDirName } from "./lib/feature-io.mjs";
import { buildRecords, recordId } from "./lib/records.mjs";
import { runAllRules } from "./lib/validate-rules.mjs";
import { generate } from "./lib/generate.mjs";
import { backfill } from "./lib/backfill.mjs";
import { today } from "./lib/fs-utils.mjs";
import { runInit, adfVersion } from "./lib/init.mjs";
import { red, yellow } from "./lib/color.mjs";
import * as exitCodes from "./lib/exit-codes.mjs";

const GLOBAL_CODES = new Set(["duplicate-id", "circular-dependency"]);

// Flags that may be passed more than once and should accumulate into an
// array instead of the last occurrence silently winning (needed for
// `init --set a=1 --set b=2`).
const REPEATABLE_FLAGS = new Set(["set"]);

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      const hasValue = next !== undefined && !next.startsWith("-");
      const value = hasValue ? next : true;
      if (hasValue) i++;
      if (REPEATABLE_FLAGS.has(key)) {
        (flags[key] ??= []).push(value);
      } else {
        flags[key] = value;
      }
    } else if (/^-[a-zA-Z]$/.test(arg)) {
      flags[arg.slice(1)] = true;
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

// Treats a set of aliases (e.g. "yes"/"y") as one boolean flag.
function hasFlag(flags, ...names) {
  return names.some((n) => Boolean(flags[n]));
}

const INIT_USAGE = `Usage: node adf-core/cli.mjs init [options]

Scaffold adf.config.json and (re)generate context/tech-stack.md,
context/project.md and context/design-system.md from it. Interactive by
default; prompts show the current/default value in [brackets] — press
Enter to accept it.

Options:
  --yes, -y          Accept every default without prompting.
  --from <file>       Read project/stack answers from a JSON file (see
                       adf-core/schema/adf-config.schema.md). Missing
                       fields fall back to defaults (or a prompt, if
                       interactive).
  --set k=v            Override a single field by dot-path, e.g.
                       --set stack.backend.framework=Express. Repeatable.
  --force, -f          Overwrite an existing adf.config.json without the
                       confirmation prompt.
  --help, -h           Show this help.`;

async function cmdInit(argv) {
  const { flags } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(INIT_USAGE);
    return;
  }
  const setPairs = Array.isArray(flags.set) ? flags.set : flags.set ? [flags.set] : [];
  const code = await runInit({
    yes: hasFlag(flags, "yes", "y"),
    force: hasFlag(flags, "force", "f"),
    fromPath: typeof flags.from === "string" ? flags.from : null,
    setPairs,
  });
  if (code !== exitCodes.OK) process.exit(code);
}

const NEXT_ID_USAGE = `Usage: node adf-core/cli.mjs next-id [FEAT|BUG]

Print the next free Feature ID (e.g. FEAT-034), or a BUG-<slug>
placeholder if "BUG" is passed.`;

function cmdNextId(argv) {
  const { flags, positional } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(NEXT_ID_USAGE);
    return;
  }
  const prefix = positional[0] === "BUG" ? "BUG" : "FEAT";
  const entries = listFeatureEntries();
  let max = 0;
  for (const e of entries) {
    const match = e.name.match(/^FEAT-(\d{3,})/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  const next = String(max + 1).padStart(3, "0");
  console.log(prefix === "FEAT" ? `FEAT-${next}` : "BUG-<short-descriptive-slug>");
}

const NEW_USAGE = `Usage: node adf-core/cli.mjs new <feature-dir-name> --priority <P> --owner <O> [--depends A,B] [--related A,B]

Register a new feature (create feature.json) for a directory whose
specification.md already exists.`;

function cmdNew(argv) {
  const { flags, positional } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(NEW_USAGE);
    return;
  }
  const dirName = positional[0];
  if (!dirName) {
    console.error(NEW_USAGE);
    process.exit(exitCodes.USAGE_ERROR);
  }
  const dir = path.join(FEATURES_DIR, dirName);
  const specPath = path.join(dir, "specification.md");
  if (!readTextIfExists(specPath)) {
    console.error(
      `Error: ${dirName}/specification.md does not exist yet. Create the feature directory and specification.md first (per agents/feature/instructions.md), then run this command.`
    );
    process.exit(exitCodes.USAGE_ERROR);
  }
  const existing = readManifest(dir);
  if (existing) {
    console.error(`Error: ${dirName}/feature.json already exists. Edit it directly or use sync to refresh generated fields.`);
    process.exit(exitCodes.USAGE_ERROR);
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

const BACKFILL_USAGE = `Usage: node adf-core/cli.mjs backfill [--dry-run]

One-time recovery: create feature.json for legacy feature directories that
predate ADF Core, inferring name/priority from specification.md.`;

function cmdBackfill(argv) {
  const { flags } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(BACKFILL_USAGE);
    return;
  }
  const { created, skipped } = backfill({ dryRun: Boolean(flags["dry-run"]) });
  console.log(`feature.json created for ${created.length} feature(s): ${created.join(", ") || "(none)"}`);
  console.log(`Skipped ${skipped.length} feature(s) that already had feature.json.`);
  if (!flags["dry-run"] && created.length) {
    generate();
    console.log("Regenerated adf-core registry/index/context/dependency-graph.");
  }
}

const GENERATED_FILES = [
  "adf-core/registry.json",
  "adf-core/INDEX.md",
  "adf-core/CONTEXT.md",
  "adf-core/DEPENDENCY-GRAPH.md",
  "every feature.json's generated block",
];

const GENERATE_USAGE = `Usage: node adf-core/cli.mjs generate [--json]

Recompute registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md, and
every feature.json's generated block from what's currently on disk.`;

function cmdGenerate(argv = []) {
  const { flags } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(GENERATE_USAGE);
    return;
  }
  generate();
  if (hasFlag(flags, "json")) {
    console.log(JSON.stringify({ ok: true, files: GENERATED_FILES }));
  } else {
    console.log("Regenerated adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and every feature.json's generated block.");
  }
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

const VALIDATE_USAGE = `Usage: node adf-core/cli.mjs validate [feature-id] [--json]

Run the Validation Engine over every features/** and _archive/** entry.
Errors exit non-zero (blocking); warnings don't. Omit feature-id to
validate the whole repository. --json prints a single machine-readable
JSON line instead of the human-readable report.`;

function cmdValidate(argv) {
  const { flags, positional } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(VALIDATE_USAGE);
    return;
  }
  const scopeId = positional[0];
  const { findings } = runValidation(scopeId);
  const errors = findings.filter((f) => f.level === "error");
  const warnings = findings.filter((f) => f.level === "warning");

  if (hasFlag(flags, "json")) {
    console.log(JSON.stringify({
      scope: scopeId ?? null,
      ok: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
    }));
  } else {
    if (scopeId) console.log(`ADF Core validation — scope: ${scopeId}\n`);
    else console.log(`ADF Core validation — full repository\n`);

    for (const f of errors) console.log(red(`ERROR   [${f.code}] ${f.feature}: ${f.message}`));
    for (const f of warnings) console.log(yellow(`WARNING [${f.code}] ${f.feature}: ${f.message}`));

    console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);
    console.log(errors.length ? red("Validation FAILED.") : "Validation passed.");
  }

  if (errors.length) process.exit(exitCodes.VALIDATION_FAILED);
}

const SYNC_USAGE = `Usage: node adf-core/cli.mjs sync [feature-id] [--json]

generate + validate in one step — the command every ADF stage runs as its
last action.`;

function cmdSync(argv) {
  const { flags, positional } = parseFlags(argv);
  if (hasFlag(flags, "help", "h")) {
    console.log(SYNC_USAGE);
    return;
  }
  const scopeId = positional[0];
  const json = hasFlag(flags, "json");
  generate();
  if (!json) console.log("Regenerated adf-core registry/index/context/dependency-graph.\n");
  const subArgv = scopeId ? [scopeId] : [];
  if (json) subArgv.push("--json");
  cmdValidate(subArgv);
}

const COMMANDS = [
  { name: "init", summary: "Scaffold adf.config.json and context/*.md from a stack wizard." },
  { name: "next-id", summary: "Print the next free Feature ID." },
  { name: "new", summary: "Register a new feature (create feature.json)." },
  { name: "backfill", summary: "Create feature.json for pre-ADF-Core feature directories." },
  { name: "generate", summary: "Recompute registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md." },
  { name: "validate", summary: "Run the Validation Engine." },
  { name: "sync", summary: "generate + validate in one step." },
];

function printGlobalHelp() {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  console.log(`ADF Core v${adfVersion()}\n`);
  console.log("Usage: node adf-core/cli.mjs <command> [args]\n");
  console.log("Commands:");
  for (const c of COMMANDS) console.log(`  ${c.name.padEnd(width)}  ${c.summary}`);
  console.log("\nRun `node adf-core/cli.mjs <command> --help` for command-specific options.");
  console.log("Global flags: --version/-v, --help/-h. Set NO_COLOR=1 to disable color.");
}

async function main() {
  const [, , command, ...rest] = process.argv;

  if (command === "--version" || command === "-v") {
    console.log(`ADF Core v${adfVersion()}`);
    return;
  }
  if (!command || command === "--help" || command === "-h") {
    printGlobalHelp();
    if (!command) process.exit(exitCodes.USAGE_ERROR);
    return;
  }

  switch (command) {
    case "init":
      return cmdInit(rest);
    case "next-id":
      return cmdNextId(rest);
    case "new":
      return cmdNew(rest);
    case "backfill":
      return cmdBackfill(rest);
    case "generate":
      return cmdGenerate(rest);
    case "validate":
      return cmdValidate(rest);
    case "sync":
      return cmdSync(rest);
    default:
      console.error(`Unknown command: ${command}\n`);
      printGlobalHelp();
      process.exit(exitCodes.USAGE_ERROR);
  }
}

main();
