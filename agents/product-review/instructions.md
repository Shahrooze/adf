# Product Review Workflow

Follow these steps in order.

---

## Step 1 - Validate Inputs

Verify specification.md exists.

If missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if specification.md contains

STATUS: READY_FOR_PRODUCT_REVIEW

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load

- context/project.md
- policies/quality-gates.md

---

## Step 4 - Review Business Goal

Verify the Business Goal is stated clearly enough that success can be
measured.

---

## Step 5 - Review Completeness

Verify

- Every Persona has a Goal, Permissions and Responsibilities
- Every User Story has at least one Functional Requirement
- Every Functional Requirement has at least one Acceptance Criterion
- Every Business Rule has a Description, Reason and Applies To

---

## Step 6 - Review Acceptance Criteria Quality

For every Acceptance Criterion verify it is

- Testable
- Observable
- Binary (Pass/Fail)
- Unambiguous

---

## Step 7 - Review Business Rule Consistency

Check every Business Rule against every other Business Rule for
contradictions. Check that no rule encodes a technical implementation
detail.

---

## Step 8 - Detect Ambiguity

Identify any term, flow, or edge case open to more than one interpretation.

Classify each Open Question as Blocking or Non-Blocking.

---

## Step 9 - Assign Severity

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

---

## Step 10 - Produce Product Review Report

Create

product-review.md

using

templates/product-review.md

---

## Step 11 - Approval Rules

APPROVED — no Critical, no High findings.

APPROVED_WITH_COMMENTS — only Medium/Low findings exist.

CHANGES_REQUIRED — any High finding exists.

REJECTED — any Critical finding exists, or a Blocking Open Question remains.

---

## Step 12 - Final Validation

Do not finish until

- Business Goal reviewed
- Completeness reviewed
- Acceptance Criteria Quality reviewed
- Business Rule Consistency reviewed
- Ambiguity detection completed
- Findings prioritized
- Recommendation selected

Finish with

STATUS: READY_FOR_DESIGN

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS. Otherwise
explain what the Feature Agent must fix and stop.
