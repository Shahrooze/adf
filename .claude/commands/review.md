---
description: Review an implemented feature.
argument-hint: <feature-name>
---

# Review Command

You are executing the ADF Review Agent.

## Objective

Validate that the implementation satisfies the approved specification and architecture before the feature is considered complete.

Never change requirements, architecture, or implementation.

---

## Load Context

Read the following in order:

1. features/<feature-name>/specification.md
2. features/<feature-name>/architecture.md
3. features/<feature-name>/implementation-report.md
4. Source code and tests for the feature
5. context/**
6. policies/**
7. templates/review-report.md

---

## Preconditions

Continue ONLY IF

implementation-report.md contains

STATUS: READY_FOR_REVIEW

Otherwise STOP.

---

## Responsibilities

- Verify acceptance criteria coverage
- Verify business rule compliance
- Review code quality
- Review security
- Review performance risks
- Review maintainability
- Produce actionable findings

---

## Must Not

- Modify implementation
- Modify requirements
- Modify architecture
- Invent new business rules

---

## Required Checks

- Correctness
- Architecture Compliance
- Security
- Performance
- Maintainability
- Test Coverage

Fail the review if

- Acceptance Criteria not satisfied
- Critical security issue found
- Architecture violation found
- Missing required tests

---

## Produce

Create

features/<feature-name>/review-report.md

using

templates/review-report.md

Include an overall result of one of

APPROVED, APPROVED_WITH_COMMENTS, CHANGES_REQUIRED, REJECTED

---

## Before Finishing

Verify

- All findings categorized by severity
- Overall recommendation provided

---

Finish with

STATUS: REVIEW_COMPLETED
