# Code Review Workflow

Follow these steps exactly in order.

## Step 1 - Validate Inputs

Verify backend-implementation-report.md, frontend-implementation-report.md and operations-readiness-report.md exist. If any is missing, STOP and explain what is missing.

Quick-change exception: when the task says `Track: quick-change`, the required documents are specification.md, the two implementation reports and qa-report.md. Missing operations-readiness, security, design, architecture and other review documents are expected on this track and must not stop you.

## Step 2 - Validate Status

Continue only if operations-readiness-report.md contains `STATUS: READY_FOR_CODE_REVIEW`. On the quick-change track, instead require specification.md to contain `TRACK: QUICK_CHANGE` and `STATUS: READY_FOR_PRODUCT_REVIEW`, and qa-report.md to contain `STATUS: READY_FOR_SECURITY_REVIEW` (QA's pass status). Otherwise STOP.

## Step 3 - Load Context

Read context/tech-stack.md and policies/coding.md.

## Step 4 - Review Maintainability and Readability

Read the backend and frontend source code. Judge whether another engineer could safely change it without deep archaeology, and whether intent is obvious without external context.

## Step 5 - Review SOLID and Clean Code

Verify Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion; small methods and classes; no magic numbers; no commented-out or dead code.

## Step 6 - Review Naming, Duplication and Complexity

Verify naming follows project conventions and communicates purpose; logic is not needlessly duplicated; abstractions exist only where duplication justifies them; methods/classes are not doing too much and cyclomatic complexity is reasonable.

## Step 7 - Review Best Practices

Verify adherence to policies/coding.md and established project patterns.

## Step 8 - Stay In Scope

Do NOT re-review correctness or acceptance criteria (QA), security (Security Review) or operations readiness (Operations Readiness Review). Note any such issue only as a cross-reference; it must not affect this gate's recommendation.

Quick-change exception: also review basic security hygiene in the changed code — no hardcoded secrets or credentials, server-side validation of new or changed input, authorization checks unchanged (not weakened or bypassed). These findings do affect the recommendation.

## Step 9 - Produce Report

Record findings as defined in system.md (Findings) and create code-review-report.md with these sections:

# Summary
# Overall Result
# Findings
# Maintainability Review
# Readability Review
# SOLID Review
# Clean Code Review
# Naming Review
# Duplication Review
# Complexity Review
# Best Practices Review
# Security Hygiene Review (quick-change track only)
# Positive Observations
# Recommendations
# Approval

## Step 10 - Approval Rules

- APPROVED — no Critical, no High findings.
- APPROVED_WITH_COMMENTS — only Medium/Low findings exist.
- CHANGES_REQUIRED — any High finding exists.
- REJECTED — any Critical finding exists.

## Step 11 - Final Validation

Verify every review area in Steps 4–8 was covered, no finding duplicates a concern owned by QA, Security Review, or Operations Readiness Review, findings are prioritized and a recommendation is selected. If anything is missing, STOP and explain why. Otherwise end code-review-report.md with the STATUS line mapped from the recommendation (system.md): `STATUS: RELEASE_READY`, `STATUS: CHANGES_REQUIRED` or `STATUS: REJECTED`.

## Step 12 - Sync ADF Core

Run `node adf-core/cli.mjs sync FEAT-<NNN>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied. As the terminal stage, this sync also confirms the whole feature's pipeline history is consistent (the Validation Engine's "incomplete-release" check fires here).
