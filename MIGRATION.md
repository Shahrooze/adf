# ADF Migration Guide

Version history, newest first. Each section is a self-contained migration
plan for that transition.

---

# Migration Plan: ADF Core → ADF Agent Runtime / Harness (v4)

ADF gains a full **Agent Runtime / Harness** (`runtime/`) — a lightweight
operating system for the agents this repository already defined. It is
**additive, not breaking**: the staged-gate methodology, every agent's
prompt, every workflow stage, every `STATUS:` value, and adf-core itself
are unchanged. What changed is that the methodology can now be *executed*
by the Harness instead of only followed by a human copying prompts into an
AI CLI by hand.

## 1. Summary of Changes

| Area | Before | Now |
| --- | --- | --- |
| Executing an agent | A human opens `agents/<id>/system.md` + `instructions.md` and pastes them into an AI CLI | `adf agent run <id>` — the Agent Runtime builds context, invokes a pluggable executor, tracks state (pending/running/paused/cancelled/timeout/completed/failed), records the produced artifact |
| Executing a workflow | A human walks `workflows/feature-development.yaml` stage by stage | `adf run <workflow-id>` — the Workflow Engine executes it: sequential by default, `parallel:` stages fan out concurrently, `condition:` gates a stage, per-stage `retry:`/`rollback:`, checkpointed after every stage |
| Agent metadata | `id`, `name`, `description`, `owner`, `stage`, `status`, `inputs`/`outputs`, `reads`/`writes`, `responsibilities`, `quality_gate`, ... | Same, **plus** an additive `capabilities`/`tools`/`supported_artifacts` block every `agents/*/agent.yaml` now ends with, so the Agent Registry has structured metadata without inference |
| Tool access | Implicit — whatever the AI CLI's own tools allowed | Explicit, permissioned, logged: `fs`, `git`, `github`, `terminal`, `http`, `docker`, `database`, `mcp`, each gated by `config/guardrails.json` |
| Artifact tracking | A file on disk plus its own `STATUS:` line | The same file, **plus** `id`, `type`, `version`, `author`, `dependencies`, `status`, and a full content-hash history via the Artifact Manager |
| Recovering a failed stage | Manually re-run the agent by hand | `adf retry <run-id>` — resumes from the Workflow Engine's own checkpoint |
| Consistency checking | `node adf-core/cli.mjs validate` | Unchanged — plus `adf validate` (a *different*, new command: the Validation Pipeline — lint/tests/security/build/review) and `adf doctor` (Harness environment health) |
| Extending ADF | Add an agent directory / edit a workflow YAML by hand | Same, **plus** a plugin system (`plugins/*/plugin.json`) for adding tools, agents, workflows, artifact types, executors, or validation steps with zero core changes |
| Clients | None — a human runs the AI CLI directly | CLI (`adf`), REST API (`adf serve`) — both reuse one `Harness` instance; an MCP server / IDE extension / GitHub Action would be a third thin wrapper around the same thing |

No stage was added, removed, reordered, or renamed. No `STATUS:` value
changed. `workflows/feature-development.yaml` itself is byte-for-byte
unchanged (still `3.1.0`). `adf-core/cli.mjs` and every `adf-core/lib/*.mjs`
module are untouched.

## 2. Why This Is Not a Breaking Change

Every file the pre-Harness workflow depended on still means exactly what
it meant before. An agent's `system.md`/`instructions.md` still describes
what that agent does and never mentions the Harness. A workflow's
`STATUS:` convention is read by the Harness's gate evaluator via the exact
same `adf-core/lib/fs-utils.mjs` function `adf-core validate` already used
— one convention, not two. A project that ignores the Harness entirely and
keeps pasting agent prompts into an AI CLI by hand loses nothing: every
artifact it produces is exactly as valid as before, and `adf-core
validate`/`sync` keep working unmodified. The Harness is purely additive
tooling on top of files that already existed.

The only files modified in-place were the twelve `agents/*/agent.yaml`
manifests, and only by *appending* a new block after their existing
content (`next_agent: ...` stayed the last pre-existing line; the new
`capabilities`/`tools`/`supported_artifacts` keys follow it). Nothing was
reordered, removed, or reinterpreted, and the YAML parser
(`runtime/src/yaml/yaml-lite.mjs`) that reads these files back is tested
against every one of them.

## 3. Adopting the Harness

Nothing is required to keep working exactly as before. To start using the
Harness:

```sh
adf doctor                                    # confirm the environment is sane
adf agent list                                 # see what the Agent Registry discovered
adf workflow list
adf run feature-development --feature-dir features/<existing-or-new-feature>
```

The default `mock` executor produces template-shaped placeholder content
(never a real agent response) — safe to explore the Harness's mechanics
with, but not a substitute for a real agent run. Point
`runtime.config.json`'s `runtime.defaultExecutor` at `"cli-adapter"` (and
configure `runtime.executors["cli-adapter"].command`) to have every agent
execution actually invoke a real AI CLI — see `docs/RUNTIME.md` and
`docs/EXAMPLES.md`.

## 4. Migration Notes for Anyone Extending ADF

- **Adding an agent?** Follow the existing `agents/*/agent.yaml` pattern
  and append the same `capabilities`/`tools`/`supported_artifacts` block
  so the Agent Registry has real metadata instead of falling back to
  `tools: ["fs"]`, `capabilities: []` defaults. See
  `docs/DEVELOPER-GUIDE.md`.
- **Adding a workflow?** Plain YAML, no registration step — see
  `docs/WORKFLOWS.md`. `workflows/parallel-development.yaml` is a
  complete worked example of the parallel/conditional/retry/rollback
  vocabulary.
- **Adding a tool, validation step, or artifact type?** Either a
  `config/*.json` entry, or a plugin (`docs/PLUGINS.md`) if you don't want
  to touch this repo's own config files at all.
- **CI/scripts that call `node adf-core/cli.mjs <cmd>` directly?** Keep
  doing that — nothing requires switching to `adf registry <cmd>`, it's
  offered for convenience, not as a deprecation.

---

# Migration Plan: ADF v3 → v3.1 (ADF Core)

ADF v3.1 adds **ADF Core** (`adf-core/`) — a repository-based Feature
Registry, Project Index, generated context digest, dependency graph, and
Validation Engine. It is **additive, not breaking**: no stage, artifact,
status vocabulary, or gate defined in v3 changed. Every existing
`STATUS:`-line convention stays exactly as-is; ADF Core reads it, it
doesn't replace it.

---

## 1. Summary of Changes

| Area | v3 | v3.1 |
|---|---|---|
| Feature metadata | Implicit — re-derived by reading every artifact's prose | `features/<id>/feature.json` — structured, see `adf-core/schema/feature.schema.md` |
| "What's the state of the repo" | Manual: open every feature's artifacts | `adf-core/INDEX.md` / `adf-core/registry.json` — generated, one lookup |
| Cross-feature dependencies | Not tracked | `adf-core/DEPENDENCY-GRAPH.md`, from each `feature.json`'s `dependencies` |
| Consistency checking | None | `node adf-core/cli.mjs validate` — Validation Engine (missing docs, duplicate IDs, broken references, circular dependencies, orphan files, incomplete releases, gate mismatches) |
| Stage completion | Each stage's own `STATUS:` line only | Same, **plus** every stage now runs `node adf-core/cli.mjs sync <feature-name>` as its last action (mandatory — projects adopting ADF should record this in their own `AGENTS.md` → "Hard rules") |
| New feature ID assignment | Manually count `features/` folders (`policies/naming.md`) | `node adf-core/cli.mjs next-id` (deterministic, same rule, no hand-counting) |

No stage was added, removed, reordered, or renamed. No `STATUS:` value
changed. `workflows/feature-development.yaml` bumped `3.0.0` → `3.1.0`
(minor, per this repo's own convention of reserving a major bump for
stage-list changes).

---

## 2. Why This Is Not a Breaking Change

v1→v2 and v2→v3 changed the stage list and the status vocabulary every
downstream agent gates on — that's what made them breaking. v3.1 changes
neither. It adds a layer that *reads* the same artifacts and the same
`STATUS:` lines every stage already produces, plus one new file per feature
(`feature.json`) that no existing stage reads as an input or writes as an
owned artifact. An agent that ignores ADF Core entirely can still complete
every v3 gate exactly as before — it just won't get the sync/validation
safety net, and the registry will silently go stale for that feature until
someone runs `node adf-core/cli.mjs generate`.

---

## 3. Migrating In-Flight and Completed Features

Every feature under `features/**` and `_archive/**` needs a `feature.json`.
For a project adopting v3.1 with existing feature history:

```sh
node adf-core/cli.mjs backfill   # idempotent — skips features that already have feature.json
node adf-core/cli.mjs generate
```

`backfill` infers `name` and `priority` from each feature's
`specification.md` Metadata block, defaults `owner` to `Engineering`, and
auto-declares any file that isn't one of the eleven standard pipeline
artifacts as a `supplementary_document` (so pre-existing extras like a
product-discovery brief aren't flagged as orphans). Review the generated
`feature.json` files and correct `owner`/`priority`/`dependencies` by hand
where the inferred defaults aren't right — this is the only manual step.

For any **new** feature going forward, `node adf-core/cli.mjs new` (run by
the Feature stage, see `agents/feature/instructions.md`) creates
`feature.json` directly — no backfill needed.

Running `node adf-core/cli.mjs validate` against a repository's existing
history can surface inconsistencies that predate ADF Core — a feature's
terminal status claiming a gate that an earlier stage's own artifact never
actually satisfied, or a `STATUS:` value left over from a pre-v3 vocabulary
that never got updated. These are real historical data issues the tool
surfaces, not tooling bugs; treat them as a backlog item for whoever owns
each affected feature, not as a blocker to adopting ADF Core.

---

## 4. External Tooling / Automation

If anything outside a project's repo (scripts, CI, other agents) references
stage prompts or artifacts, no change is required — every v3 file path,
command name, and status string is unchanged. Anything that wants the new
machine-readable feature state should read `adf-core/registry.json`.

---

## 5. Version Bumps

- Framework version: `context/project.md` `0.3.0` → `0.3.1`.
- `feature-development.yaml`: `3.0.0` → `3.1.0`.
- No agent's own version changed — none of their inputs, outputs, or gate
  logic changed. Only their `instructions.md` / slash-command files gained
  a final "Sync ADF Core" step.

---

## 6. Rollback

ADF Core is additive and self-contained under `adf-core/` plus one new file
per feature directory (`feature.json`) plus the "Sync ADF Core" step
appended to each stage's `instructions.md` / command file. To roll back:

1. `git revert` the commit(s) that introduced `adf-core/` and the
   "Sync ADF Core" steps.
2. `feature.json` files can be deleted safely — nothing outside `adf-core/`
   reads them.

Rollback does not affect any `STATUS:` line or artifact — those are
unchanged by this migration.

---

# Migration Plan: ADF v2 → v3

ADF v3 decomposes the single monolithic Review stage into five independent
quality gates — **Product Review**, **Architecture Review**, **QA**,
**Security Review**, and **Operations Readiness Review** — plus a narrowed
**Code Review** as the final gate. The principle: implementation agents
(Feature, Design, Architecture, Backend, Frontend) only produce; every
producing stage that materially affects downstream risk now has an
independent reviewer that never touches the artifact it reviews.

This is a breaking change to the workflow's stage list, status gates, and
agent set. It does not change anything introduced in v1→v2 (Design,
Backend/Frontend split) beyond renaming a few gate values.

---

## 1. Summary of Changes

| Area | v2 | v3 |
|---|---|---|
| Stages | Feature → Design → Architecture → Backend → Frontend → Review | Feature → Product Review → Design → Architecture → Architecture Review → Backend → Frontend → QA → Security Review → Operations Readiness Review → Code Review |
| Agents | + `review-agent` | `review-agent` replaced by `code-review-agent` (narrowed) + new `product-review-agent`, `architecture-review-agent`, `qa-agent`, `security-review-agent`, `operations-readiness-agent` |
| Agent folder | `agents/review/` | `agents/code-review/` (renamed + narrowed) + `agents/product-review/`, `agents/architecture-review/`, `agents/qa/`, `agents/security-review/`, `agents/operations-readiness/` (all new) |
| Slash commands | `/review` | `/code-review` (renamed + narrowed) + `/product-review`, `/architecture-review`, `/qa`, `/security-review`, `/operations-readiness` (all new) |
| Artifacts | `review-report.md` | `product-review.md`, `architecture-review.md`, `qa-report.md`, `security-review.md`, `operations-readiness-report.md`, `code-review-report.md` (replaces `review-report.md`) |
| Templates | `templates/review-report.md` | `templates/code-review-report.md` (renamed + narrowed) + 5 new templates, one per new gate |
| Policies | `design.md`, `accessibility.md`, `frontend.md` | + `api-design.md`, `testing.md`, `observability.md`, `quality-gates.md` |
| Review scope | One agent reviewed Specification, Design, Architecture, Backend, Frontend, Security, Accessibility, Performance, Maintainability, Tests all at once | Split across 6 single-responsibility gates; Code Review is explicitly forbidden from re-reviewing what QA/Security/Operations already covered |

### Status gate renames

| Artifact | v2 status | v3 status |
|---|---|---|
| specification.md | `STATUS: READY_FOR_DESIGN` | `STATUS: READY_FOR_PRODUCT_REVIEW` |
| product-review.md | *(did not exist)* | `STATUS: READY_FOR_DESIGN` |
| design.md | `STATUS: READY_FOR_ARCHITECTURE` | `STATUS: READY_FOR_ARCHITECTURE` (unchanged — still self-gated, no Design Review stage was introduced) |
| architecture.md | `STATUS: READY_FOR_BACKEND` | `STATUS: READY_FOR_ARCHITECTURE_REVIEW` |
| architecture-review.md | *(did not exist)* | `STATUS: READY_FOR_BACKEND` |
| backend-implementation-report.md | `STATUS: READY_FOR_FRONTEND` | `STATUS: READY_FOR_FRONTEND` (unchanged) |
| frontend-implementation-report.md | `STATUS: READY_FOR_REVIEW` | `STATUS: READY_FOR_QA` |
| qa-report.md | *(did not exist)* | `STATUS: READY_FOR_SECURITY_REVIEW` |
| security-review.md | *(did not exist)* | `STATUS: READY_FOR_OPERATIONS_REVIEW` |
| operations-readiness-report.md | *(did not exist)* | `STATUS: READY_FOR_CODE_REVIEW` |
| review-report.md / code-review-report.md | `STATUS: REVIEW_COMPLETED` | `STATUS: RELEASE_READY` |

### Gate ownership change

In v2, an agent's own artifact self-certified readiness for the next stage
(e.g. architecture.md said `READY_FOR_BACKEND` itself). In v3, for stages
with an independent reviewer, **the reviewer's artifact carries the gate**,
not the producer's:

- Design's readiness gate for Architecture is still self-declared in
  design.md (no Design Review stage exists in v3).
- Architecture's readiness gate for Backend is now declared in
  **architecture-review.md**, not architecture.md. architecture.md itself
  now only says `READY_FOR_ARCHITECTURE_REVIEW`.
- Backend's readiness gate for Frontend remains self-declared in
  backend-implementation-report.md (no independent review sits between
  Backend and Frontend).
- Specification's readiness gate for Design is now declared in
  **product-review.md**, not specification.md. specification.md itself now
  only says `READY_FOR_PRODUCT_REVIEW`.

This means Backend Agent's precondition changed from checking
`architecture.md` for `READY_FOR_BACKEND` to checking `architecture-review.md`
for the same value. Design Agent's precondition changed from checking
`specification.md` for `READY_FOR_DESIGN` to checking `product-review.md`
for the same value. See each agent's `instructions.md` for the exact check.

---

## 2. Why This Is a Breaking Change

Every downstream agent gates on an exact `STATUS:` string in a specific
upstream artifact. Splitting Review into six single-responsibility gates
required (a) renaming the terminal statuses so each artifact names the
*next* gate rather than a generic "review", and (b) moving two gate
declarations (Design→Architecture readiness, Architecture→Backend
readiness) from the producer's own artifact to the new reviewer's artifact,
since the whole point of v3 is that a stage no longer certifies its own
readiness once a dedicated reviewer exists for it.

---

## 3. Migrating In-Flight Features

For any feature under `features/<feature-name>/` that was started under v2:

### Feature has only `specification.md`, ends with `READY_FOR_DESIGN`
1. Edit the file's final line to `STATUS: READY_FOR_PRODUCT_REVIEW`.
2. Run `/product-review <feature-name>` before `/design`.

### Feature has `specification.md` + `design.md`, design ends with `READY_FOR_ARCHITECTURE`
1. Run `/product-review <feature-name>` retroactively so the record exists,
   even though Design already happened without it. Flag it as a
   retroactive/backfilled review in the report's Summary.
2. Continue with `/architecture <feature-name>` as normal — no other change
   needed since design.md's own gate format is unchanged.

### Feature has `architecture.md`, ends with `READY_FOR_BACKEND`
1. Change architecture.md's final line to `STATUS: READY_FOR_ARCHITECTURE_REVIEW`.
2. Run `/architecture-review <feature-name>`.
3. Only proceed to `/backend` once architecture-review.md says
   `STATUS: READY_FOR_BACKEND`.

### Feature has `backend-implementation-report.md`, ends with `READY_FOR_FRONTEND`
No change needed — this gate is unchanged between v2 and v3. Continue with
`/frontend <feature-name>`.

### Feature has `frontend-implementation-report.md`, ends with `READY_FOR_REVIEW` (v2 terminal state)
1. Change its final line to `STATUS: READY_FOR_QA`.
2. Run, in order: `/qa`, `/security-review`, `/operations-readiness`,
   `/code-review`.
3. Backfill `architecture-review.md` and `product-review.md` retroactively
   (Section above) so Code Review's dependency chain resolves; mark them as
   backfilled.

### Feature has `review-report.md`, ends with `STATUS: REVIEW_COMPLETED`
1. Treat this as equivalent to `code-review-report.md` with
   `STATUS: RELEASE_READY` — the feature is done. Optionally rename the file
   for consistency with new tooling, but no further gates need to run.

---

## 4. External Tooling / Automation

If anything outside this repo (scripts, CI, other agents) references:

- The command `/review` → update to `/code-review` (narrower scope — see
  Section 1), and add calls to `/product-review`, `/architecture-review`,
  `/qa`, `/security-review`, `/operations-readiness` at their respective
  points in the pipeline.
- The file `review-report.md` → update to `code-review-report.md`, and add
  handling for the five new report files.
- The agent id `review-agent` → update to `code-review-agent`.
- The status string `READY_FOR_DESIGN` in specification.md → update to
  `READY_FOR_PRODUCT_REVIEW`.
- The status string `READY_FOR_BACKEND` in architecture.md → update to
  `READY_FOR_ARCHITECTURE_REVIEW` (the actual Backend-unlocking value now
  lives in architecture-review.md).
- The status string `READY_FOR_REVIEW` in frontend-implementation-report.md
  → update to `READY_FOR_QA`.
- The status string `REVIEW_COMPLETED` → update to `RELEASE_READY`.

No compatibility shim is provided for `/review` — consistent with the v1→v2
precedent below, this document is the canonical upgrade note instead.

---

## 5. Version Bumps

- Framework version: `context/project.md` `0.2.0` → `0.3.0`.
- `feature-agent`: `2.0.0` → `3.0.0` (status gate renamed, next_agent changed).
- `architecture-agent`: `2.0.0` → `2.1.0` (status gate renamed, next_agent changed).
- `backend-agent`: `2.0.0` → `2.1.0` (new required input `architecture-review.md`, precondition changed).
- `frontend-agent`: `1.0.0` → `1.1.0` (status gate renamed, next_agent changed).
- `design-agent`: `1.0.0` → `1.1.0` (new required input `product-review.md`, precondition changed).
- `code-review-agent` (formerly `review-agent`): `3.0.0` (renamed id, drastically narrowed scope, status gate renamed).
- `product-review-agent`: `1.0.0` (new).
- `architecture-review-agent`: `1.0.0` (new).
- `qa-agent`: `1.0.0` (new).
- `security-review-agent`: `1.0.0` (new).
- `operations-readiness-agent`: `1.0.0` (new).
- `feature-development.yaml`: `2.0.0` → `3.0.0`.

---

## 6. Rollback

If v3 needs to be rolled back:

1. `git revert` the commit(s) that introduced this migration.
2. Any feature whose artifacts were already renamed/edited per Section 3
   must be manually reverted (git history for `features/**` is the source of
   truth, not this document).

Rollback is safe only for features that have not yet passed through
`/product-review`, `/architecture-review`, `/qa`, `/security-review`, or
`/operations-readiness` under v3, since those stages have no v2 equivalent
to revert to.

---
---

# Migration Plan: ADF v1 → v2

ADF v2 inserts a dedicated **Design** stage between Feature and Architecture,
and splits the single Implementation stage into independent **Backend** and
**Frontend** stages. This is a breaking change to the workflow's file names,
status gates, and agent set. This document describes exactly what changed and
how to migrate in-flight features and any external tooling.

---

## 1. Summary of Changes

| Area | v1 | v2 |
|---|---|---|
| Stages | Feature → Architecture → Implementation → Review | Feature → Design → Architecture → Backend Implementation → Frontend Implementation → Review |
| Agents | `feature-agent`, `architecture-agent`, `implementation-agent`, `review-agent` | `feature-agent`, `design-agent`, `architecture-agent`, `backend-agent`, `frontend-agent`, `review-agent` |
| Agent folder | `agents/implementation/` | `agents/backend/` (renamed) + `agents/frontend/` (new) + `agents/design/` (new) |
| Slash commands | `/feature`, `/architecture`, `/implement`, `/review` | `/feature`, `/design` (new), `/architecture`, `/backend` (renamed from `/implement`), `/frontend` (new), `/review` |
| Artifacts | `specification.md`, `architecture.md`, `implementation-report.md`, `review-report.md` | `specification.md`, `design.md` (new), `architecture.md`, `backend-implementation-report.md` (renamed), `frontend-implementation-report.md` (new), `review-report.md` |
| Templates | `templates/implementation-report.md` used once | `templates/design.md` (new); `templates/implementation-report.md` reused twice (Backend Layer, Frontend Layer) |
| Policies | `coding.md`, `security.md`, `architecture.md`, `git.md` | + `design.md`, `accessibility.md`, `frontend.md` |
| Status gates | See table below | See table below |

### Status gate renames

| Artifact | v1 status | v2 status |
|---|---|---|
| specification.md | `STATUS: READY_FOR_ARCHITECTURE` | `STATUS: READY_FOR_DESIGN` |
| design.md | *(did not exist)* | `STATUS: READY_FOR_ARCHITECTURE` |
| architecture.md | `STATUS: READY_FOR_IMPLEMENTATION` | `STATUS: READY_FOR_BACKEND` |
| backend-implementation-report.md | *(was implementation-report.md, `STATUS: READY_FOR_REVIEW`)* | `STATUS: READY_FOR_FRONTEND` |
| frontend-implementation-report.md | *(did not exist)* | `STATUS: READY_FOR_REVIEW` |
| review-report.md | `STATUS: REVIEW_COMPLETED` | `STATUS: REVIEW_COMPLETED` (unchanged) |

---

## 2. Why This Is a Breaking Change

Every downstream agent gates on an exact `STATUS:` string in an upstream
artifact (see each agent's `instructions.md`). Inserting Design as a real gate
between Feature and Architecture — and separating Backend from Frontend —
required renaming the status vocabulary so each gate unambiguously identifies
the *next* stage. Reusing `READY_FOR_ARCHITECTURE` for both "ready to leave
Feature" and "ready to leave Design" would make the Architecture Agent unable
to tell whether Design had actually run.

---

## 3. Migrating In-Flight Features

For any feature under `features/<feature-name>/` that was started under v1,
apply the rule matching its current position in the old pipeline:

### Feature has only `specification.md`, ends with `READY_FOR_ARCHITECTURE`
1. Edit the file's final line to `STATUS: READY_FOR_DESIGN`.
2. Run `/design <feature-name>` before `/architecture`.

### Feature has `specification.md` + `architecture.md`, ends with `READY_FOR_IMPLEMENTATION`
1. Run `/design <feature-name>` retroactively (design was skipped). Review its
   output against the existing architecture.md for conflicts — the
   Architecture Agent in v1 may have made UI decisions that now belong to
   Design; reconcile manually.
2. Change architecture.md's final line to `STATUS: READY_FOR_BACKEND`.
3. Continue with `/backend <feature-name>`.

### Feature has `implementation-report.md`, ends with `READY_FOR_REVIEW` (v1 implementation already done, full-stack)
1. Rename the file to `backend-implementation-report.md`.
2. Change its final line to `STATUS: READY_FOR_FRONTEND`.
3. Because v1's Implementation Agent may have already written frontend code,
   run `/frontend <feature-name>` in **audit mode**: ask the Frontend Agent to
   verify the existing frontend against design.md rather than rewrite it from
   scratch, then produce `frontend-implementation-report.md` ending with
   `STATUS: READY_FOR_REVIEW`.
4. Backfill `design.md` retroactively so the Review Agent has something to
   check Frontend fidelity against; mark it clearly as reconstructed
   documentation, not a stage that ran before implementation.

### Feature has `review-report.md`, `STATUS: REVIEW_COMPLETED`
No action needed. Completed features are not retroactively migrated.

---

## 4. External Tooling / Automation

If anything outside this repo (scripts, CI, other agents) references:

- The command `/implement` → update to `/backend`.
- The file `implementation-report.md` → update to `backend-implementation-report.md`.
- The agent id `implementation-agent` → update to `backend-agent`.
- The status string `READY_FOR_ARCHITECTURE` in specification.md → update to `READY_FOR_DESIGN`.
- The status string `READY_FOR_IMPLEMENTATION` → update to `READY_FOR_BACKEND`.

No compatibility shim is provided for `/implement` — it was judged unnecessary
complexity for an internal framework command; this document is the
canonical upgrade note instead.

---

## 5. Version Bumps

- Framework version: `context/project.md` `0.1.0` → `0.2.0`.
- `feature-agent`: `1.0.0` → `2.0.0` (status gate renamed).
- `architecture-agent`: `1.0.0` → `2.0.0` (new required input, status gate renamed).
- `review-agent`: `1.0.0` → `2.0.0` (new inputs, per-stage review model).
- `backend-agent` (formerly `implementation-agent`): `2.0.0` (renamed id, narrowed scope, status gate renamed).
- `design-agent`: `1.0.0` (new).
- `frontend-agent`: `1.0.0` (new).
- `feature-development.yaml`: `1.0.0` → `2.0.0`.

---

## 6. Rollback

If v2 needs to be rolled back:

1. `git revert` the commit(s) that introduced this migration.
2. Any feature whose artifacts were already renamed/edited per Section 3 must
   be manually reverted (git history for `features/**` is the source of
   truth, not this document).

Rollback is safe only for features that have not yet passed through `/design`
or `/frontend` under v2, since those stages have no v1 equivalent to revert to.
