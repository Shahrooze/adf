---
description: Implement the frontend of an approved feature.
argument-hint: <feature-name>
---

# Frontend Implementation Command

You are executing the ADF Frontend Implementation Agent.

## Objective

Implement the UI of the feature by following design.md exactly and connecting to the API contracts produced by the Backend Agent.

Never redesign UX. Never change API contracts. Never implement backend code.

---

## Load Context

Read the following in order:

1. features/<feature-name>/specification.md
2. features/<feature-name>/design.md
3. features/<feature-name>/architecture.md
4. features/<feature-name>/backend-implementation-report.md
5. templates/implementation-report.md
6. context/**
7. policies/coding.md
8. policies/frontend.md
9. policies/accessibility.md
10. policies/testing.md

---

## Preconditions

Continue ONLY IF

design.md contains

STATUS: READY_FOR_ARCHITECTURE

AND

backend-implementation-report.md contains

STATUS: READY_FOR_FRONTEND

architecture.md is read for API contract details; its own gate (Architecture
Review) has already passed by the time backend-implementation-report.md
reaches this status.

Otherwise STOP.

---

## Rules

Never change the Specification.

Never change the Design.

Never change the Architecture.

Never change API contracts.

Never invent a screen, component, or flow not present in design.md.

Never implement backend code.

If design.md is ambiguous or incomplete for a screen, STOP and report the gap instead of inventing a decision.

---

## Implementation Order

1. Design Tokens (if not already present in the codebase)
2. Shared/reusable Components
3. Pages
4. Forms and Client-side Validation
5. API integration
6. Tests

---

## Frontend Rules

- Follow design.md exactly — screens, navigation, component hierarchy
- Reuse existing components before creating new ones
- Implement every documented Loading, Empty, Error and Success state
- Implement Responsive Behavior as documented
- Implement Accessibility requirements exactly (policies/accessibility.md)
- Consume APIs exactly as documented; handle every documented error response
- Do not duplicate UI

---

## Testing Rules

Generate

- Component tests
- Form validation tests
- Mocked API integration tests

Every Acceptance Criterion relevant to the UI must be covered.

---

## Before Finishing

Verify

- Every screen in design.md is implemented
- Every API call matches the documented contract
- Accessibility requirements implemented
- No compilation errors
- Tests generated

---

Create

features/<feature-name>/frontend-implementation-report.md

using

templates/implementation-report.md

with Layer: Frontend in its Metadata

Finish with

STATUS: READY_FOR_QA

This hands off to the QA Agent (`/qa`), not directly to Code Review.

---

## Sync ADF Core

Run:

node adf-core/cli.mjs sync <feature-name>

This regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and
DEPENDENCY-GRAPH.md, and validates the repository scoped to this feature.
Must complete with no errors before this stage's gate can be considered
satisfied.
