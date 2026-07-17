<!--
  GENERATED FILE — do not hand-edit.
  Produced by: node adf-core/cli.mjs generate
  Source of truth: features/**/feature.json + features/**/*.md (each artifact's
  own STATUS line) + context/**, policies/**, templates/**, agents/**.
  Regenerate after any stage completes; never edit this file directly, your
  changes will be overwritten on the next run.
-->

# Generated Project Context

A point-in-time digest of repository state, assembled entirely from existing files (feature manifests, artifact status lines, policy/context filenames). It never introduces information that isn't already recorded somewhere else — read the pointed-to file for full detail.

## Active Work

_Nothing in progress._

## Blocked Work (needs a decision or fix before it can continue)

_Nothing blocked._

## Completed Work

_None yet._

## Architecture & Design Decisions

Per-feature architecture decisions live in `features/<id>/architecture.md` (technical) and `features/<id>/design.md` (UX/UI) — see the Project Index for which features have them. Project-wide technical conventions: `context/tech-stack.md`. Project-wide design conventions: `context/design-system.md`.

## Coding, Testing & Review Conventions

Enforced by the stages listed in `workflows/feature-development.yaml`; the human-readable rules live in `policies/**` (coding, testing, security, accessibility, api-design, architecture, observability, git, naming, quality-gates). Every implementation/review stage must read the policy file relevant to its own responsibility before writing content — see `AGENTS.md` → "Hard rules".

## Mandatory Constraints

- Check `policies/quality-gates.md` for any mandatory build/test verification rules this project has adopted — never report a stage, fix, or feature done without actually running and passing them.
- ADF Core sync is mandatory: every stage must end by running `node adf-core/cli.mjs sync <feature-id>` — see `AGENTS.md` → "Hard rules".
- No stage may modify an artifact owned by a previous stage; no reviewing stage may modify the artifact it reviews.

## Vision & Principles

See `context/project.md` (not duplicated here — it changes rarely and is the durable source).
