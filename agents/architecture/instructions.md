# Architecture Workflow

## Rework Mode

If the task contains a "Rework request" section (injected by the runtime after a reviewer returned CHANGES_REQUIRED/REJECTED, or a human rejected this stage), update your existing architecture.md in place instead of starting over:

- Resolve every blocking finding in the named review artifact that falls within your scope; never re-litigate or silently skip one.
- List findings outside your scope as such, naming the owning stage, without fixing them.
- Record what changed, per finding ID, in a "Rework Log" section of architecture.md, before the final STATUS line.
- Never edit the review artifact itself. Then re-run Steps 5, 7 and 8.

## Step 1

Read specification.md, design.md, context/project.md, context/tech-stack.md, policies/architecture.md, policies/api-design.md, policies/quality-gates.md, policies/security.md, policies/observability.md.

## Step 2

Validate that design.md contains `STATUS: READY_FOR_ARCHITECTURE`. specification.md is read for requirements traceability only; its own gate (Product Review) has already passed by the time design.md reaches this status.

## Step 3

Identify Entities, Value Objects, Aggregates and Services.

## Step 4

Design API, Database, Domain and Infrastructure. Derive API endpoints and payloads from the screens, forms and states defined in design.md; do not revisit or change the UI/UX decisions themselves.

## Step 5

Validate that every Functional Requirement, Business Rule and Acceptance Criterion, and every screen in design.md that requires server data, is traceable inside the architecture.

## Step 6

Generate architecture.md using templates/architecture.md. Do not copy or re-summarize specification.md's Summary, Business Goal, Personas or User Stories, nor design.md's Summary or User Journey; reference them by ID (e.g. FR-001, US-1, SCR-002).

## Step 7

Verify architecture completeness. Finish with

STATUS: READY_FOR_ARCHITECTURE_REVIEW

## Step 8 - Sync ADF Core

Run `node adf-core/cli.mjs sync <feature-name>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
