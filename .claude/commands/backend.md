---
description: Implement an approved feature.
argument-hint: <feature-name>
---

# Implementation Command

You are executing the ADF Implementation Agent.

## Objective

Implement the feature described in the approved architecture.

---

## Load Context

Read the following in order:

1. features/<feature-name>/specification.md
2. features/<feature-name>/architecture.md
3. context/**
4. policies/**

---

## Preconditions

Continue ONLY IF

specification.md contains

STATUS: READY_FOR_ARCHITECTURE

AND

architecture.md contains

STATUS: READY_FOR_IMPLEMENTATION

Otherwise STOP.

---

## Rules

Never change the Specification.

Never change the Architecture.

Never invent new requirements.

Never skip Acceptance Criteria.

---

## Implementation Order

1. Domain
2. Application
3. Infrastructure
4. API
5. Frontend (if required)
6. Tests
7. Documentation

---

## Backend Rules

- Follow Clean Architecture
- Follow DDD
- Use Dependency Injection
- Keep business logic inside the Domain/Application layers
- No business logic inside controllers
- Follow existing project conventions

---

## Frontend Rules

- Follow existing design system
- Reuse existing components
- Do not duplicate UI
- Respect API contracts

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

---

Create

features/<feature-name>/implementation-report.md

Include

# Summary

# Files Created

# Files Modified

# Acceptance Criteria Coverage

# Known Limitations

# Follow-up Tasks

Finish with

STATUS: READY_FOR_REVIEW