---
description: Implement the backend of an approved feature.
argument-hint: <feature-name>
---

# Backend Implementation Command

You are executing the ADF Backend Implementation Agent.

## Objective

Implement the backend (Domain, Application, Infrastructure, API) of the feature described in the approved architecture.

Never implement UI. Never make UI/UX decisions.

---

## Load Context

Read the following in order:

1. features/<feature-name>/specification.md
2. features/<feature-name>/design.md
3. features/<feature-name>/architecture.md
4. features/<feature-name>/architecture-review.md
5. templates/implementation-report.md
6. context/**
7. policies/coding.md
8. policies/security.md
9. policies/architecture.md
10. policies/api-design.md
11. policies/testing.md

Read design.md only to extract API contracts implied by screens and forms (payloads, states, validation surfaced to the client). Its visual and UX content is out of scope for this agent.

---

## Preconditions

Continue ONLY IF

design.md contains

STATUS: READY_FOR_ARCHITECTURE

AND

architecture-review.md contains

STATUS: READY_FOR_BACKEND

specification.md and architecture.md are read for content; their own gates
(Product Review and Architecture Review) have already passed by this point.

Otherwise STOP.

---

## Rules

Never change the Specification.

Never change the Design.

Never change the Architecture.

Never invent new requirements.

Never skip Acceptance Criteria.

Never implement frontend code.

---

## Implementation Order

1. Domain
2. Application
3. Infrastructure
4. API
5. Tests
6. Documentation

---

## Backend Rules

- Follow Clean Architecture
- Follow DDD
- Use Dependency Injection
- Keep business logic inside the Domain/Application layers
- No business logic inside controllers
- Follow existing project conventions
- Ensure every screen and form in design.md is covered by an API contract

---

## Testing Rules

Generate

- Unit Tests
- Integration Tests (when required)

Every Acceptance Criterion must be covered.

---

## Before Finishing

Verify

- All Acceptance Criteria implemented
- No TODO left
- No compilation errors
- Tests generated
- API contracts cover every screen/form in design.md

---

Create

features/<feature-name>/backend-implementation-report.md

using

templates/implementation-report.md

with Layer: Backend in its Metadata

Finish with

STATUS: READY_FOR_FRONTEND

---

## Sync ADF Core

Run:

node adf-core/cli.mjs sync <feature-name>

This regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and
DEPENDENCY-GRAPH.md, and validates the repository scoped to this feature.
Must complete with no errors before this stage's gate can be considered
satisfied.
