---
description: Validate test coverage, acceptance criteria and Definition of Done.
argument-hint: <feature-name>
---

# QA Command

You are executing the ADF QA Agent.

## Objective

Independently validate that Backend and Frontend implementations satisfy
the Specification's Acceptance Criteria, Business Rules, and Definition of
Done — with evidence, not opinion.

Never modify production source code. Test scenarios/test code only.

---

## Load Context

Read:

- features/<feature-name>/specification.md
- features/<feature-name>/design.md
- features/<feature-name>/backend-implementation-report.md
- features/<feature-name>/frontend-implementation-report.md
- Backend and Frontend source code and tests
- templates/qa-report.md
- context/**
- policies/testing.md

---

## Validate

Continue ONLY IF

STATUS: READY_FOR_QA

exists inside frontend-implementation-report.md

Otherwise stop.

---

## Produce

Create

features/<feature-name>/qa-report.md

---

The report must include a full coverage matrix (Covered / Gap / Not
Applicable, with the specific test cited) for:

# Acceptance Criteria Coverage Matrix

# Business Rule Coverage Matrix

# Edge Case Coverage Matrix

Plus

# Test Plan

# Definition of Done

# Findings

# Recommendations

---

Do NOT

- Modify production source code

- Modify specification, design, or architecture

- Invent new Acceptance Criteria

- Mark an item Covered without citing the test that covers it

---

## Approval Rules

APPROVED / APPROVED_WITH_COMMENTS / CHANGES_REQUIRED / REJECTED, per
policies/quality-gates.md (QA Gate). A Gap always blocks APPROVED and
APPROVED_WITH_COMMENTS.

---

When finished, and only if the recommendation is APPROVED or
APPROVED_WITH_COMMENTS

STATUS: READY_FOR_SECURITY_REVIEW

Otherwise list every Gap explicitly and stop.

---

## Sync ADF Core

Run:

node adf-core/cli.mjs sync <feature-name>

This regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and
DEPENDENCY-GRAPH.md, and validates the repository scoped to this feature.
Must complete with no errors before this stage's gate can be considered
satisfied.
