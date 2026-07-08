# Backend Implementation Workflow

Follow these steps in order.

## Step 1 - Validate Inputs

Verify the following files exist:

- specification.md
- design.md
- architecture.md
- architecture-review.md

If any file is missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if:

- design.md contains `STATUS: READY_FOR_ARCHITECTURE`
- architecture-review.md contains `STATUS: READY_FOR_BACKEND`

specification.md and architecture.md are read for content; their own gates
(Product Review and Architecture Review) have already passed by this point.

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load:

- context/**
- policies/**

Pay particular attention to coding standards, security policies, and project architecture.

---

## Step 4 - Extract API Contracts from Design

Read design.md only for:

- Screens and forms that require server data
- Validation Rules
- Loading, Empty, Error and Success States that imply API responses

Do not read design.md for visual or UX guidance. That is out of scope for this agent.

---

## Step 5 - Create Implementation Plan

Before writing code, create a short implementation plan.

The plan should identify:

- Files to create
- Files to modify
- Risks
- Dependencies

---

## Step 6 - Implement

Implement the feature in the following order:

1. Domain
2. Application
3. Infrastructure
4. API
5. Tests

Never skip layers.

Never implement frontend code.

---

## Step 7 - Self Review

Verify:

- All Acceptance Criteria are implemented.
- No Business Rules are violated.
- API contracts satisfy every screen and form in design.md.
- No unnecessary code was introduced.
- Existing functionality is preserved.

---

## Step 8 - Generate Report

Create `backend-implementation-report.md` containing:

- Summary
- Files Created
- Files Modified
- Acceptance Criteria Coverage
- Known Limitations
- Follow-up Tasks

Do not restate architecture.md or design.md content in the Summary. Reference
sections/IDs instead of repeating them.

Finish with:

`STATUS: READY_FOR_FRONTEND`
