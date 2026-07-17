# ADF Core

ADF Core is the structured-context layer of the ADF (AI Development
Framework) repository. It is **not** a service, an MCP server, or a
database — it's a small set of repository conventions plus a
zero-dependency Node CLI that reads and writes plain files already inside
this repo. Its only job is to eliminate repeated context discovery: instead
of an agent grepping across `features/**` to figure out what stage a
feature is at, it reads one generated table.

## Why this exists

Before ADF Core, "what's the status of every feature" had no answer short
of opening up to 11 documents per feature, across 32+ features, and reading
the last line of each one — and even that was unreliable, because a
`STATUS:` value quoted mid-paragraph in a report could look identical to
the real terminal status line. ADF Core makes that a single, reliable
lookup, and adds a Validation Engine that automatically catches the kind of
drift that accumulates over a long-running framework (missing documents,
duplicate feature IDs, orphaned files, artifacts that claim a status their
own content doesn't support).

## Files

| Path | What it is | Hand-edited? |
|---|---|---|
| `features/<id>/feature.json` | Feature Registry entry — see `schema/feature.schema.md` | Partially (see schema doc) |
| `registry.json` | Aggregate Feature Registry, all features, machine-readable | No — generated |
| `INDEX.md` | Project Index — active/blocked/release-ready/archived features + a map of every framework directory | No — generated |
| `CONTEXT.md` | Generated project-state digest (active work, blocked work, pointers to durable docs) | No — generated |
| `DEPENDENCY-GRAPH.md` | Feature dependency graph (Mermaid) + downstream impact + suggested build order | No — generated |
| `schema/feature.schema.md` | `feature.json` field reference | Yes (rarely) |
| `cli.mjs`, `lib/*.mjs` | The CLI implementation | Yes |
| `tests/*.test.mjs` | Validation engine tests (`node --test adf-core/tests/*.test.mjs`) | Yes |

`INDEX.md`, `CONTEXT.md`, `DEPENDENCY-GRAPH.md`, `registry.json`, and each
`feature.json`'s `generated` block are committed to the repo (so agents can
read them without running anything first) but are always fully
regenerated, never patched — treat them like a lockfile, not source.

## Commands

All commands are plain Node, no `npm install` required (Node ≥ 18).

```sh
# Find the next free feature ID before creating a new feature directory.
node adf-core/cli.mjs next-id

# Register a new feature (run after the Feature stage has already created
# features/<id>-<slug>/specification.md).
node adf-core/cli.mjs new FEAT-033-some-feature --priority High --owner Engineering

# One-time recovery: create feature.json for legacy feature directories
# that predate ADF Core, inferring name/priority from specification.md.
node adf-core/cli.mjs backfill

# Recompute registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md, and
# every feature.json's generated block from what's currently on disk.
node adf-core/cli.mjs generate

# Run the Validation Engine. Errors exit non-zero (blocking); warnings
# don't. Omit the feature id to validate the whole repository.
node adf-core/cli.mjs validate [feature-id]

# generate + validate in one step — this is the command every ADF stage
# runs as its last action (record this in a consuming project's own
# AGENTS.md -> "Hard rules").
node adf-core/cli.mjs sync [feature-id]
```

## The Validation Engine

`validate` / `sync` run these checks over every `features/**` and
`_archive/**` entry:

- **missing-manifest** — feature directory has no `feature.json`.
- **missing-field** / **invalid-priority** — required `feature.json` fields absent or out of enum range.
- **id-mismatch** / **duplicate-id** — `feature.json`'s `id` doesn't match its directory, or two features share an ID.
- **broken-reference** / **self-reference** — `dependencies`/`related_features` pointing at a nonexistent or self feature ID.
- **circular-dependency** — a dependency cycle, reported with the full cycle path.
- **orphan-file** (warning) — a file in a feature directory that's neither a standard pipeline artifact nor declared in `supplementary_documents`.
- **incomplete-release** — a feature's `code-review-report.md` says `RELEASE_READY` but an earlier stage's gate was never actually satisfied.
- **gate-not-satisfied** (warning) — an artifact's own terminal STATUS line doesn't match the value its stage's gate requires (i.e. the pipeline is stopped there, whether or not later artifacts exist).

Errors are things later tooling and agents cannot safely work around;
warnings are real but non-blocking signals a human should triage.

Running `validate` against this repository's current history surfaces a
small number of pre-existing inconsistencies that predate ADF Core (see
`MIGRATION.md`'s "ADF v3 → v3.1" section) — that's the tool doing its job,
not a regression introduced by adopting it.

## Design choices (and why)

- **Per-feature manifest, not one giant registry file.** A single
  `registry.yaml` for 30+ features would be a permanent merge-conflict
  magnet since every stage of every in-flight feature would write to it.
  `feature.json` lives next to the artifacts it describes; `registry.json`
  is a disposable, regenerable aggregate.
- **JSON over YAML for the manifest.** `JSON.parse` is a language builtin;
  a YAML parser is not, and pulling in a dependency for a ~10-field object
  wasn't worth it. Every other structured file in this framework
  (`agent.yaml`, `workflows/*.yaml`) stays YAML because those are
  hand-authored prose-adjacent documents, not machine-generated data.
- **No new artifact format for stage outputs.** Every template already
  ends every artifact with a `STATUS: VALUE` terminal line — that
  convention already *is* the standardized machine-readable output ADF
  Core needed. Rather than bolt a redundant front-matter block onto ten
  templates, ADF Core made status extraction robust (handles markdown
  bold, trailing blockquote annotations) and left the templates alone.
- **`workflows/feature-development.yaml` stays the single source of truth
  for stage order/gates.** `lib/workflow-stages.mjs` mirrors it in plain JS
  (no YAML parser dependency) — the header comment says so explicitly.
  Update both in the same commit, the same way `.claude/commands/*.md` and
  `.codex/prompts/*.md` are already kept identical in this repo.
- **Generated files are committed, not gitignored.** An agent should never
  have to run a build step just to read "what's the state of the repo" —
  the whole point is removing steps between an agent and an answer.
