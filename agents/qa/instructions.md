# QA Workflow

Follow these steps in order.

## Step 1 - Validate Inputs

Verify specification.md, design.md, backend-implementation-report.md and frontend-implementation-report.md exist. If any are missing, stop immediately.

Quick-change exception: when the task says `Track: quick-change`, the only required documents are specification.md and the two implementation reports. Missing design, architecture and review documents are expected on this track and must not stop you.

## Step 2 - Validate Status

Continue only if frontend-implementation-report.md contains `STATUS: READY_FOR_QA`. On the quick-change track, also require specification.md to contain `TRACK: QUICK_CHANGE` and `STATUS: READY_FOR_PRODUCT_REVIEW`, and backend-implementation-report.md to contain `STATUS: READY_FOR_FRONTEND` (Backend and Frontend ran in parallel); a report stating "No changes required in this layer" is valid. Otherwise stop and explain why.

## Step 3 - Read Context

Load context/tech-stack.md, policies/testing.md, and existing backend and frontend tests.

## Step 4 - Build the Coverage Matrix

Apply the Coverage Model (system.md) to every Acceptance Criterion, Business Rule and Edge Case: find the test(s) that exercise it and mark it Covered (cite test), Gap, or Not Applicable.

## Step 5 - Generate Missing Test Scenarios

For every Gap, write the missing test scenario description. If instructed to generate the test code, write it as a test file only — never modify production source code.

## Step 6 - Verify Definition of Done

Check the Definition of Done section of specification.md, plus: code compiles (per implementation reports), all generated tests pass, no Acceptance Criterion is a Gap.

## Step 7 - Produce Report

Record findings as defined in system.md (Findings) and create qa-report.md using templates/qa-report.md. Include the full coverage matrix, not just a summary, and update the test plan to reflect current coverage.

## Step 8 - Approval Rules

- APPROVED — no Critical, no High findings, zero Gaps.
- APPROVED_WITH_COMMENTS — only Medium/Low findings, zero Gaps.
- CHANGES_REQUIRED — any Gap or High finding exists.
- REJECTED — Definition of Done cannot be met at all.

## Step 9 - Final Validation

Do not finish until every Acceptance Criterion and Business Rule is classified with evidence, every Edge Case is considered, the Definition of Done is verified, findings are prioritized and a recommendation is selected. List every Gap explicitly. End qa-report.md with the STATUS line mapped from the recommendation (system.md): `STATUS: READY_FOR_SECURITY_REVIEW`, `STATUS: CHANGES_REQUIRED` or `STATUS: REJECTED`.

## Step 10 - Sync ADF Core

Run `node adf-core/cli.mjs sync FEAT-<NNN>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
