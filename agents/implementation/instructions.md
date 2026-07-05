

# Implementation Workflow

Follow these steps in order.

## Step 1 - Validate Inputs

Verify the following files exist:

- specification.md
- architecture.md

If either file is missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if:

- specification.md contains `STATUS: READY_FOR_ARCHITECTURE`
- architecture.md contains `STATUS: READY_FOR_IMPLEMENTATION`

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load:

- context/**
- policies/**

Pay particular attention to coding standards, security policies, and project architecture.

---

## Step 4 - Create Implementation Plan

Before writing code, create a short implementation plan.

The plan should identify:

- Files to create
- Files to modify
- Risks
- Dependencies

---

## Step 5 - Implement

Implement the feature in the following order:

1. Domain
2. Application
3. Infrastructure
4. API
5. Frontend (if applicable)
6. Tests

Never skip layers.

---

## Step 6 - Self Review

Verify:

- All Acceptance Criteria are implemented.
- No Business Rules are violated.
- No unnecessary code was introduced.
- Existing functionality is preserved.

---

## Step 7 - Generate Report

Create `implementation-report.md` containing:

- Summary
- Files Created
- Files Modified
- Acceptance Criteria Coverage
- Known Limitations
- Follow-up Tasks

Finish with:

`STATUS: READY_FOR_REVIEW`