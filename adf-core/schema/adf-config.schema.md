# `adf.config.json` Schema

`adf.config.json` lives at the repository root, next to `context/`. It is
the single structured-metadata file for a *consuming project's* identity
and technology stack — the one place a project records its answers so
`node adf-core/cli.mjs init` (and any future re-run of it) can regenerate
`context/tech-stack.md`, `context/project.md`, and `context/design-system.md`
without those three files drifting out of sync with each other.

Like `feature.json`, it has two parts. Keep them mentally separate:

## Hand-authored fields (written once by `init`, edited rarely)

| Field | Type | Required | Notes |
|---|---|---|---|
| `project.name` | string | yes | Human-readable project name. Rendered into `context/project.md`'s `# Project` section. |
| `project.version` | string | no (default `0.1.0`) | The *project's own* version — unrelated to `generated.adf_version` below, which tracks the ADF framework version instead. Rendered into `context/project.md`'s `Version:` line. |
| `project.description` | string | no (default `""`) | One-line description. May be blank. |
| `stack.backend.language` | string | yes | e.g. `C#`, `Python`, `TypeScript`. Free text — not a closed enum. |
| `stack.backend.framework` | string | yes | e.g. `.NET 10`, `FastAPI`, `Express`. |
| `stack.frontend.framework` | string | yes | e.g. `Next.js 16`, `SvelteKit`, or `none` for an API-only project. |
| `stack.frontend.language` | string | yes | e.g. `TypeScript`. |
| `stack.database` | string | yes | e.g. `PostgreSQL 17`, `MongoDB`, `SQLite`. |
| `stack.testing.unit` | string | yes | Unit test framework, e.g. `xUnit`, `pytest`, `Jest`. |
| `stack.testing.e2e` | string | yes | End-to-end/frontend test framework, e.g. `Playwright`. |
| `stack.auth` | string | yes | Auth approach, e.g. `JWT`, `OAuth2`, `Session cookies`. |
| `stack.api_style` | string | yes | e.g. `REST`, `GraphQL`, `gRPC`. |
| `stack.git_workflow` | string | yes | e.g. `GitHub Flow`, `Git Flow`, `Trunk-based`. |
| `stack.infra` | string | yes | e.g. `Docker`, `Docker/Kubernetes`, `Serverless`. |

All `stack.*` values are free-text strings, not JSON-Schema-enforced
enums — `init`'s interactive wizard offers suggestions drawn from the
previous answers (or ADF's own defaults on first run), but nothing rejects
a stack ADF doesn't already have an opinion about. This mirrors
`feature.json`'s own `priority` field: a documented, not
mechanically-enforced, vocabulary.

## Generated fields (`generated` key — never hand-edit)

Rewritten in full every time `init` runs (interactively, via `--yes`, or
via `--from`). Never edit this block directly — your edit is overwritten
on the next run.

| Field | Meaning |
|---|---|
| `generated.adf_version` | The ADF Core version (from `adf-core/VERSION`) that last scaffolded or re-synced this project. |
| `generated.initialized_at` | Date `init` first created `adf.config.json`. Never changes on subsequent runs. |
| `generated.last_synced` | Date `init` most recently regenerated `context/tech-stack.md` / `context/project.md` / `context/design-system.md` from this file. |

## Why split it this way

`adf.config.json`'s hand-authored block is the only place stack facts are
typed in; `context/tech-stack.md`, `context/project.md`, and
`context/design-system.md` are downstream, fully-derived output —
regenerated from this file, never hand-edited directly. That closes the
duplication hazard that existed before `init`: `context/tech-stack.md` and
`context/project.md` used to each hand-maintain their own copy of the same
stack facts at different levels of precision (e.g. `.NET 10` in one,
`.NET (Latest LTS)` in the other) with no mechanism keeping them in sync.
The `generated` block follows the same rationale as `feature.json`'s: it
records provenance (which ADF version, which date) without ever being
hand-mixed with the authored facts above it.

## Example

```json
{
  "project": {
    "name": "Acme Platform",
    "version": "0.1.0",
    "description": "Internal operations platform for Acme Inc."
  },
  "stack": {
    "backend": { "language": "C#", "framework": ".NET 10" },
    "frontend": { "framework": "Next.js 16", "language": "TypeScript" },
    "database": "PostgreSQL 17",
    "testing": { "unit": "xUnit", "e2e": "Playwright" },
    "auth": "JWT",
    "api_style": "REST",
    "git_workflow": "GitHub Flow",
    "infra": "Docker"
  },
  "generated": {
    "adf_version": "0.3.1",
    "initialized_at": "2026-07-18",
    "last_synced": "2026-07-18"
  }
}
```
