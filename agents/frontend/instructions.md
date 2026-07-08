# Frontend Implementation Workflow

Follow these steps in order.

## Step 1 - Validate Inputs

Verify the following files exist:

- specification.md
- design.md
- architecture.md
- backend-implementation-report.md

If any file is missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if:

- design.md contains `STATUS: READY_FOR_ARCHITECTURE`
- backend-implementation-report.md contains `STATUS: READY_FOR_FRONTEND`

architecture.md is read for API contract details; its own gate (Architecture
Review) has already passed by the time backend-implementation-report.md
reaches this status.

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load:

- context/tech-stack.md
- context/design-system.md
- policies/frontend.md
- policies/accessibility.md
- policies/coding.md
- policies/testing.md

Pay particular attention to the frontend and accessibility policies, and the project's frontend stack.

---

## Step 4 - Read Design and API Contracts

Read design.md in full:

- Screen List, Navigation, Component Hierarchy
- Forms and Validation Rules
- Loading, Empty, Error, Success States
- Responsive Behavior
- Accessibility
- Design Tokens
- Interaction Notes

Read architecture.md and backend-implementation-report.md for the exact API contracts to consume.

If design.md is ambiguous or incomplete for a screen, stop and report the gap instead of inventing a decision.

---

## Step 5 - Create Implementation Plan

Before writing code, create a short implementation plan.

The plan should identify:

- Pages/Components to create
- Files to modify
- API integrations required
- Risks

---

## Step 6 - Implement

Implement the feature in the following order:

1. Design Tokens (if not already present in the codebase)
2. Shared/reusable Components
3. Pages
4. Forms and Client-side Validation
5. API integration
6. Tests

Never skip a documented state (Loading, Empty, Error, Success).

Never implement backend code.

---

## Step 7 - Self Review

Verify:

- Every screen in design.md is implemented exactly.
- Every API call matches the documented contract.
- Accessibility requirements are implemented.
- Responsive Behavior matches design.md.
- No UX decision was invented.

---

## Step 8 - Generate Report

Create `frontend-implementation-report.md` containing:

- Summary
- Files Created
- Files Modified
- Acceptance Criteria Coverage
- Known Limitations
- Follow-up Tasks

Do not restate architecture.md or design.md content in the Summary. Reference
sections/IDs instead of repeating them.

Finish with:

`STATUS: READY_FOR_QA`
