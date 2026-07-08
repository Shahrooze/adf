# QA Workflow

Follow these steps in order.

---

## Step 1 - Validate Inputs

Verify the following files exist:

- specification.md
- design.md
- backend-implementation-report.md
- frontend-implementation-report.md

If any are missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if frontend-implementation-report.md contains

STATUS: READY_FOR_QA

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load

- context/tech-stack.md
- policies/testing.md
- Existing backend and frontend tests

---

## Step 4 - Build the Coverage Matrix

For every Acceptance Criterion in specification.md, find the test(s) that
exercise it. Mark each: Covered (cite test), Gap, or Not Applicable.

Repeat for every Business Rule and every Edge Case.

---

## Step 5 - Generate Missing Test Scenarios

For every Gap, write the missing test scenario description. If instructed to
generate the actual test code, write it as a test file only — never modify
production source code.

---

## Step 6 - Verify Definition of Done

Check the Definition of Done section of specification.md, plus:

- Code compiles (per implementation reports)
- All generated tests pass
- No Acceptance Criterion is a Gap

---

## Step 7 - Assign Severity

Each finding must contain

- ID
- Severity
- Category
- Description
- Recommendation

Allowed Severity

- Critical
- High
- Medium
- Low

A missing test for an Acceptance Criterion is at minimum High.

---

## Step 8 - Produce QA Report

Create

qa-report.md

using

templates/qa-report.md

Include the full coverage matrix, not just a summary.

---

## Step 9 - Approval Rules

APPROVED — no Critical, no High findings, zero Gaps.

APPROVED_WITH_COMMENTS — only Medium/Low findings, zero Gaps.

CHANGES_REQUIRED — any Gap or High finding exists.

REJECTED — Definition of Done cannot be met at all.

---

## Step 10 - Final Validation

Do not finish until

- Every Acceptance Criterion classified with evidence
- Every Business Rule classified with evidence
- Every Edge Case considered
- Test plan updated
- Definition of Done verified
- Findings prioritized
- Recommendation selected

Finish with

STATUS: READY_FOR_SECURITY_REVIEW

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS. Otherwise
list every Gap explicitly and stop.
