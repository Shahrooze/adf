# Architecture Review Workflow

Follow these steps in order.

## Step 1 - Validate Inputs and Status

Verify specification.md, design.md and architecture.md exist; if any are missing, stop immediately. Continue only if architecture.md contains `STATUS: READY_FOR_ARCHITECTURE_REVIEW`; otherwise stop and explain why.

## Step 2 - Read Context

Load context/project.md, context/tech-stack.md, policies/architecture.md, policies/api-design.md.

## Step 3 - Review DDD and Clean Architecture

Verify Entities, Value Objects and Aggregates are modeled correctly with reasonable aggregate boundaries; dependencies point inward; Domain does not depend on Infrastructure; Presentation contains no business logic.

## Step 4 - Review Scalability

Identify expected (peak) load from specification.md's Non Functional Requirements. Check for unaddressed bottlenecks: hot partitions, unbounded queries, synchronous chains, missing caching where clearly warranted.

## Step 5 - Review API Consistency

Check the API against policies/api-design.md: resource naming, versioning, pagination, error format, status codes. Verify every screen in design.md that needs server data has a corresponding endpoint.

## Step 6 - Review Database Design

Verify new/modified tables are appropriately normalized, an indexing strategy exists for the query patterns implied by the screens, and a safe migration strategy exists for any change to existing tables/data.

## Step 7 - Review Traceability

Verify every Functional Requirement in specification.md is traceable inside the architecture.

## Step 8 - Produce Report

Record findings as defined in system.md (Findings) and create architecture-review.md using templates/architecture-review.md.

## Step 9 - Approval Rules

- APPROVED — no Critical, no High findings.
- APPROVED_WITH_COMMENTS — only Medium/Low findings exist.
- CHANGES_REQUIRED — any High finding exists.
- REJECTED — any Critical finding exists.

## Step 10 - Final Validation

Do not finish until Steps 3–9 are complete, findings are prioritized and a recommendation is selected. End architecture-review.md with the STATUS line mapped from the recommendation (system.md): `STATUS: READY_FOR_BACKEND`, `STATUS: CHANGES_REQUIRED` or `STATUS: REJECTED`.

## Step 11 - Sync ADF Core

Run `node adf-core/cli.mjs sync <feature-name>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
