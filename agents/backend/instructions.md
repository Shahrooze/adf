# Backend Implementation Workflow

Follow these steps in order.

## Rework Mode

If the task contains a "Rework request" section (injected by the runtime after a reviewer returned CHANGES_REQUIRED/REJECTED, or a human rejected this stage), update your existing backend code, tests and backend-implementation-report.md in place instead of starting over:

- Resolve every blocking finding in the named review artifact that falls within your scope; never re-litigate or silently skip one.
- List findings outside your scope as such, naming the owning stage, without fixing them.
- Record what changed, per finding ID, in a "Rework Log" section of backend-implementation-report.md, before the final STATUS line.
- Never edit the review artifact itself. Then re-run Steps 7–9.

## Step 1 - Validate Inputs

Verify specification.md, design.md, architecture.md and architecture-review.md exist. If any is missing, stop immediately.

Quick-change exception: when the task says `Track: quick-change`, the only required upstream document is specification.md. Missing design, architecture and review documents are expected on this track and must not stop you.

## Step 2 - Validate Status

Continue only if design.md contains `STATUS: READY_FOR_ARCHITECTURE` and architecture-review.md contains `STATUS: READY_FOR_BACKEND`. specification.md and architecture.md are read for content; their own gates (Product Review and Architecture Review) have already passed by this point.

Quick-change track: instead, continue only if specification.md contains `TRACK: QUICK_CHANGE` and `STATUS: READY_FOR_PRODUCT_REVIEW`. Derive contracts from specification.md and existing code, keeping any contract change additive (optional fields only). If the change needs a migration, new entity, non-additive contract change or security-sensitive change, stop and report that it requires `TRACK: FULL`.

Otherwise stop and explain why.

## Step 3 - Read Context

Load context/project.md, context/tech-stack.md, policies/coding.md, policies/security.md, policies/api-design.md, policies/testing.md, policies/quality-gates.md. Pay particular attention to coding standards, security policies, and project architecture.

## Step 4 - Extract API Contracts from Design

Read design.md only for screens and forms that require server data, Validation Rules, and Loading/Empty/Error/Success States that imply API responses — never for visual or UX guidance. (Skipped on the quick-change track.)

## Step 5 - Create Implementation Plan

Before writing code, write a short plan: files to create, files to modify, risks, dependencies.

## Step 6 - Implement

In this order, never skipping a layer: 1. Domain, 2. Application, 3. Infrastructure, 4. API, 5. Tests, 6. Documentation. Never implement frontend code.

## Step 7 - Self Review

Complete the Completion Checklist in system.md; also verify no unnecessary code was introduced and existing functionality is preserved.

## Step 8 - Generate Report

Create `backend-implementation-report.md` with: Summary, Files Created, Files Modified, Acceptance Criteria Coverage, Known Limitations, Follow-up Tasks. Do not restate architecture.md or design.md in the Summary; reference sections/IDs.

If this layer needs no change (possible on the quick-change track), still write the report, stating "No changes required in this layer" and why.

Finish with `STATUS: READY_FOR_FRONTEND`

## Step 9 - Sync ADF Core

Run `node adf-core/cli.mjs sync <feature-id>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
