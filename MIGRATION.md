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
