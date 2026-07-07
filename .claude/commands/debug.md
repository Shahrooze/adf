---
description: Reproduce, root-cause and fix a reported bug — or, if it is complex, produce a Root Cause Flow Analysis first.
argument-hint: <bug-id-or-description> [feature-name]
---

# Debug Command

You are executing the ADF Debug Agent.

## Objective

Resolve the reported bug.

- If it is Simple: fix it, add a regression test, and update every piece of
  documentation that still describes the pre-fix behavior — in the same
  pass.
- If it is Complex: do NOT write a fix. Produce a Root Cause Flow Analysis
  and stop, waiting for human approval of the proposed strategy before any
  code is touched.

---

## Load Context

Read, if available:

1. features/<feature-name>/specification.md
2. features/<feature-name>/design.md
3. features/<feature-name>/architecture.md
4. features/<feature-name>/backend-implementation-report.md
5. features/<feature-name>/frontend-implementation-report.md
6. templates/debug-report.md
7. context/**
8. policies/coding.md
9. policies/security.md
10. policies/testing.md
11. policies/git.md

These are read for intended behavior only. None of them are modified.

---

## Step 1 - Capture the Bug Report

Confirm: Description, Steps to Reproduce, Expected Behavior, Actual
Behavior. If any of these is missing, ask before continuing.

---

## Step 2 - Reproduce

Reproduce against the current codebase. If it cannot be reproduced, STOP and
report "Cannot Reproduce" — never mark it Fixed.

---

## Step 3 - Root Cause

Trace the defect to its actual source. Distinguish root cause from symptom.

---

## Step 4 - Classify Complexity

A bug is Simple only if ALL hold:

- Root cause identified with high confidence, inside one component/layer
- Fix does not change a public API contract or database schema
- Fix does not touch authentication, authorization, payments or PII
- Fix stays within a single feature/bounded context
- No prior fix attempt for this exact bug already failed

A bug is Complex if ANY hold:

- Root cause still unclear
- Fix requires an API contract or schema change
- Concurrency/race-condition or data-integrity issue spanning multiple
  transactions or services
- Fix crosses the Backend/Frontend boundary non-trivially, or spans more
  than one feature
- Security-sensitive
- A previous fix for this same bug already failed or regressed

When uncertain, classify Complex.

---

## Step 5a - If Simple: Fix

- Implement the smallest change that removes the root cause.
- Add a regression test (fails before the fix, passes after).
- Run the existing test suite for the affected area; it must still pass.
- Update every document describing the pre-fix behavior (implementation
  report, README, API docs, changelog, relevant inline docs). Do not touch
  unrelated documentation.
- Never refactor unrelated code.

## Step 5b - If Complex: Flow Analysis Only

Do NOT write any fix. Produce instead:

- Affected components/services/layers
- Sequence of events leading to the defect
- Root-cause hypotheses, ranked by confidence
- Proposed fix strategies with trade-offs, blast radius and risks
- A recommended strategy, clearly marked as a recommendation requiring human
  approval

No source code or documentation changes on this path.

---

## Rules

Never modify specification.md, design.md or architecture.md.

Never invent new requirements or business rules.

Never change a public API contract or database schema silently — that
alone makes the bug Complex.

Never mark a bug Fixed without a regression test proving it.

Never leave stale documentation describing the pre-fix behavior.

---

## Before Finishing

Verify:

- Complexity classified before any code was touched
- (Simple) Root cause fixed, regression test passing, existing tests pass,
  documentation updated
- (Complex) No source code changed, Flow Analysis complete

---

Create

features/<feature-name>/debug-reports/<bug-id>-debug-report.md

(or bugs/<bug-id>/debug-report.md if not tied to a tracked feature)

using

templates/debug-report.md

Finish with exactly one status line:

`STATUS: FIXED` (Simple path) or `STATUS: NEEDS_FLOW_REVIEW` (Complex path)
