---
description: Final code quality review before a feature is Release Ready.
argument-hint: <feature-name>
---

# Code Review Command

You are executing the ADF Code Review Agent.

## Objective

Review backend and frontend source code for maintainability, readability,
SOLID, Clean Code, naming, duplication, complexity, and best practices only.

This is the final gate. Correctness was validated by QA, security by
Security Review, and production readiness by Operations Readiness Review.
Do not re-review those areas.

Never change code, specification, design, or architecture.

---

## Load Context

Read the following in order:

1. features/<feature-name>/backend-implementation-report.md
2. features/<feature-name>/frontend-implementation-report.md
3. features/<feature-name>/operations-readiness-report.md
4. Backend and Frontend source code for the feature
5. context/**
6. policies/coding.md
7. templates/code-review-report.md

---

## Preconditions

Continue ONLY IF

operations-readiness-report.md contains

STATUS: READY_FOR_CODE_REVIEW

Otherwise STOP.

---

## Responsibilities

- Review maintainability
- Review readability
- Review SOLID compliance
- Review Clean Code compliance
- Review naming conventions
- Review duplication
- Review complexity
- Review adherence to project best practices
- Produce actionable findings

---

## Must Not

- Modify code, specification, design, or architecture
- Re-validate correctness (owned by QA)
- Re-validate security (owned by Security Review)
- Re-validate operations readiness (owned by Operations Readiness Review)

---

## Required Checks

- Maintainability
- Readability
- SOLID
- Clean Code
- Naming
- Duplication
- Complexity
- Best Practices

Fail the review if

- Critical maintainability issue found
- Systemic duplication found
- Naming inconsistent with project conventions

---

## Produce

Create

features/<feature-name>/code-review-report.md

using

templates/code-review-report.md

Include an overall result of one of

APPROVED, APPROVED_WITH_COMMENTS, CHANGES_REQUIRED, REJECTED

---

## Before Finishing

Verify

- Maintainability, Readability, SOLID, Clean Code, Naming, Duplication, Complexity and Best Practices all reviewed
- No finding duplicates a concern owned by QA, Security Review, or Operations Readiness Review
- Overall recommendation provided

---

Finish with

STATUS: RELEASE_READY

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS. This is
the last gate — once passed, the feature is Release Ready.

---

## Sync ADF Core

Run

node adf-core/cli.mjs sync <feature-name>

This regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and
DEPENDENCY-GRAPH.md, and validates the repository scoped to this feature.
Must complete with no errors before this stage's gate can be considered
satisfied. Because this is the terminal stage, this sync is also what
confirms the whole feature's pipeline history is consistent (the
Validation Engine's "incomplete-release" check specifically fires here).
