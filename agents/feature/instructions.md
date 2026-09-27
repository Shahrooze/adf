# Feature Workflow

Follow these steps exactly.

## Ambiguity Rule

This applies at every step below, not only Discovery. If anything is ambiguous, unclear, or could be interpreted more than one way, stop and ask the user. Never assume, guess, or decide on your own. Wait for the user's answer before moving to the next step.

## Rework Mode

If the task contains a "Rework request" section (injected by the runtime after a reviewer returned CHANGES_REQUIRED/REJECTED, or a human rejected this stage), update your existing specification.md (no new feature or ID) in place instead of starting over:

- Resolve every blocking finding in the named review artifact that falls within your scope; never re-litigate or silently skip one. If resolving a finding needs a business decision, ask the user.
- List findings outside your scope as such, naming the owning stage, without fixing them.
- Record what changed, per finding ID, in a "Rework Log" section of specification.md, before the final STATUS line.
- Never edit the review artifact itself. Then re-run Steps 9, 10, 13 and the sync in Step 14.

## Step 1 — Understand the Request

Read the user's feature idea and summarize it in your own words. If the understanding is incorrect, request clarification.

## Step 2 — Discover Missing Information

Identify only the information that is required; do not ask unnecessary questions; group related questions together. Do not proceed to Step 3 until the problem is completely clear — ask and wait, do not assume.

Assumptions are a last resort, only for details the user explicitly leaves to your judgment. When one is made, record it explicitly.

## Step 3 — Identify Personas

List every persona involved, each with Goal, Permissions and Responsibilities.

## Step 4 — Create User Stories

Format: As a ... I want ... So that ...

## Step 5 — Define Functional Requirements

IDs FR-001, FR-002, ... Each requirement must map to at least one User Story.

## Step 6 — Define Business Rules

IDs BR-001, BR-002, ... Business Rules must not contain technical implementation details.

## Step 7 — Define Non Functional Requirements

Include Performance, Security, Availability, Accessibility, Localization, Observability.

## Step 8 — Define Acceptance Criteria

IDs AC-001, AC-002, ... Every criterion must be Observable, Testable and Binary.

## Step 9 — Review Completeness

Verify every User Story has Functional Requirements, every Functional Requirement has Acceptance Criteria, every Business Rule is documented, and no critical ambiguity remains. If any ambiguity is found, stop and ask the user; do not resolve it yourself.

## Step 10 — Classify Change Size / Track

QUICK_CHANGE only if ALL hold:

- No new domain entity and no database migration.
- No new or changed public API contract beyond an additive optional field.
- No authentication, authorization, PII, payment or other security-sensitive change.
- No new screen (a small change to an existing screen is fine).
- No new external integration.
- It fits in a small diff.

Otherwise FULL (and FULL when uncertain). Write a "Delivery Track" section containing a line reading exactly `TRACK: QUICK_CHANGE` or `TRACK: FULL` plus a one-line justification, placed before the final STATUS line (STATUS stays last). If the task says `Track: quick-change` but the change does not qualify, write `TRACK: FULL` and explain why.

On the quick-change track the specification may be concise: sections that do not apply can say "N/A — quick change". Functional Requirements, Business Rules and Acceptance Criteria are still required.

## Step 11 — Assign Feature ID

Run `node adf-core/cli.mjs next-id` to get the next sequential FEAT-<NNN> (see policies/naming.md). Combine it with a kebab-case slug of the feature: features/FEAT-<NNN>-<slug>/

## Step 12 — Generate Specification

Create features/FEAT-<NNN>-<slug>/specification.md using templates/specification.md.

## Step 13 — Final Validation

Do not finish until the Definition of Ready is satisfied, the Quality Gate passes, no unresolved critical questions remain, every ambiguity was resolved by asking the user (not by assumption), and the Delivery Track line is present. Finish with

STATUS: READY_FOR_PRODUCT_REVIEW

## Step 14 — Register in ADF Core

Run, in order:

node adf-core/cli.mjs new FEAT-<NNN>-<slug> --priority <priority> --owner <owner>

node adf-core/cli.mjs sync FEAT-<NNN>

This creates features/FEAT-<NNN>-<slug>/feature.json (the Feature Registry entry — see adf-core/schema/feature.schema.md) and regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and DEPENDENCY-GRAPH.md. The sync must complete with no errors before this stage is done.
