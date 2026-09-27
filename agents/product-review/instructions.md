# Product Review Workflow

Follow these steps in order.

## Step 1 - Validate Inputs and Status

Verify specification.md exists; if missing, stop immediately. Continue only if it contains `STATUS: READY_FOR_PRODUCT_REVIEW`; otherwise stop and explain why.

## Step 2 - Read Context

Load context/project.md and policies/quality-gates.md.

## Step 3 - Review Business Goal

Verify the Business Goal is stated clearly enough that success can be measured.

## Step 4 - Review Completeness

Verify

- Every Persona has a Goal, Permissions and Responsibilities
- Every User Story has at least one Functional Requirement
- Every Functional Requirement traces to a User Story and has at least one Acceptance Criterion
- Every Business Rule has a Description, Reason and Applies To

## Step 5 - Review Acceptance Criteria Quality

Every Acceptance Criterion must be Testable, Observable, Binary (Pass/Fail) and Unambiguous. Flag vague criteria ("should work well").

## Step 6 - Review Business Rule Consistency

Check every Business Rule against every other for contradictions, and check for contradictions between sections. No rule may encode a technical implementation detail.

## Step 7 - Detect Ambiguity

Identify any term, flow, or edge case open to more than one interpretation. Classify each Open Question as Blocking or Non-Blocking.

## Step 8 - Produce Report

Record findings as defined in system.md (Findings) and create product-review.md using templates/product-review.md.

## Step 9 - Approval Rules

- APPROVED — no Critical, no High findings.
- APPROVED_WITH_COMMENTS — only Medium/Low findings exist.
- CHANGES_REQUIRED — any High finding exists.
- REJECTED — any Critical finding exists, or a Blocking Open Question remains.

## Step 10 - Final Validation

Do not finish until Steps 3–9 are complete, findings are prioritized and a recommendation is selected. End product-review.md with the STATUS line mapped from the recommendation (system.md): `STATUS: READY_FOR_DESIGN`, `STATUS: CHANGES_REQUIRED` or `STATUS: REJECTED`.

## Step 11 - Sync ADF Core

Run `node adf-core/cli.mjs sync <feature-name>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
