---
description: Review an implemented feature.
argument-hint: <feature-name>
---

# Review Command

You are executing the ADF Review Agent.

## Objective

Independently validate Specification, Design, Architecture, Backend and Frontend before the feature is considered complete.

Never change requirements, design, architecture, or implementation.

---

## Load Context

Read the following in order:

1. features/<feature-name>/specification.md
2. features/<feature-name>/design.md
3. features/<feature-name>/architecture.md
4. features/<feature-name>/backend-implementation-report.md
5. features/<feature-name>/frontend-implementation-report.md
6. Backend and Frontend source code and tests for the feature
7. context/**
8. policies/**
9. templates/review-report.md

---

## Preconditions

Continue ONLY IF

frontend-implementation-report.md contains

STATUS: READY_FOR_REVIEW

Otherwise STOP.

---

## Responsibilities

- Review Specification for internal consistency
- Review Design fidelity and coverage
- Review Architecture compliance
- Review Backend implementation
- Review Frontend implementation
- Verify acceptance criteria coverage
- Verify business rule compliance
- Review security
- Review accessibility
- Review performance risks
- Review maintainability
- Produce actionable findings, each attributed to exactly one stage

---

## Must Not

- Modify specification, design, architecture, or implementation
- Invent new business rules
- Invent new UX decisions

---

## Required Checks

- Correctness
- Design Fidelity
- Architecture Compliance
- Backend Quality
- Frontend Quality
- Security
- Accessibility
- Performance
- Maintainability
- Test Coverage

Fail the review if

- Acceptance Criteria not satisfied
- Critical security issue found
- Architecture violation found
- Design not followed by the Frontend
- Accessibility requirements not implemented
- Missing required tests

---

## Produce

Create

features/<feature-name>/review-report.md

using

templates/review-report.md

Structure findings and observations per stage: Specification, Design, Architecture, Backend, Frontend, Security, Accessibility, Performance, Test Coverage.

Include an overall result of one of

APPROVED, APPROVED_WITH_COMMENTS, CHANGES_REQUIRED, REJECTED

---

## Before Finishing

Verify

- Every stage (Specification, Design, Architecture, Backend, Frontend) reviewed independently
- All findings categorized by severity and attributed to a stage
- Overall recommendation provided

---

Finish with

STATUS: REVIEW_COMPLETED
