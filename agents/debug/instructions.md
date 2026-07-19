# Debug Workflow

Follow these steps in order.

## Step 1 - Capture the Bug Report

Confirm: Description, Steps to Reproduce, Expected Behavior, Actual
Behavior. If any of these is missing, ask before continuing.

---

## Step 2 - Load Context

Read, if available:

- features/<feature-name>/specification.md
- features/<feature-name>/design.md
- features/<feature-name>/architecture.md
- features/<feature-name>/backend-implementation-report.md
- features/<feature-name>/frontend-implementation-report.md
- templates/debug-report.md
- context/**
- policies/coding.md
- policies/security.md
- policies/testing.md
- policies/git.md

These are read for intended behavior only. None of them are modified in
this step.

---

## Step 3 - Reproduce

Reproduce against the current codebase. If it cannot be reproduced, stop
and report "Cannot Reproduce". Never mark a bug Fixed without reproducing
it first.

---

## Step 4 - Root Cause

Trace the defect to its actual source. Distinguish root cause from
symptom.

---

## Step 5 - Classify Complexity

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

## Step 6a - If Simple: Update Documentation, Then Fix

Work in this exact order. Do not reorder these sub-steps.

### 6a.1 - Update Documentation First

Before touching any source code, update every document that describes the
affected behavior — implementation report, README, API docs, changelog,
relevant inline docs — to state the CORRECT/expected behavior: the
behavior the code is about to be changed to have, not the buggy behavior
it currently has. Do not touch unrelated documentation.

This documentation update is the target the fix must satisfy. If the code
does not end up matching what was just written, the fix is incomplete.

### 6a.2 - Fix

Implement the smallest change that removes the root cause and makes the
code match the documentation written in 6a.1.

### 6a.3 - Regression Test

Add a regression test (fails before the fix, passes after).

### 6a.4 - Verify

Run the existing test suite for the affected area; it must still pass.

Never refactor unrelated code.

---

## Step 6b - If Complex: Flow Analysis Only

Do NOT write any fix and do NOT change any documentation. Produce instead:

- Affected components/services/layers
- Sequence of events leading to the defect
- Root-cause hypotheses, ranked by confidence
- Proposed fix strategies with trade-offs, blast radius and risks
- A recommended strategy, clearly marked as a recommendation requiring
  human approval

---

## Step 7 - Generate Report

Create

- features/<feature-name>/debug-reports/<bug-id>-debug-report.md
- (or bugs/<bug-id>/debug-report.md if not tied to a tracked feature)

using templates/debug-report.md.

Finish with exactly one status line:

`STATUS: FIXED` (Simple path) or `STATUS: NEEDS_FLOW_REVIEW` (Complex path)

---

## Rules

Never modify specification.md, design.md or architecture.md.

Never invent new requirements or business rules.

Never change a public API contract or database schema silently — that
alone makes the bug Complex.

Never mark a bug Fixed without a regression test proving it.

Never leave stale documentation describing the pre-fix behavior.

Never write or change source code before the documentation it must match
has been updated.

---

## Sync ADF Core

If the bug is tied to a tracked feature, run

node adf-core/cli.mjs sync <feature-id>

This regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and
DEPENDENCY-GRAPH.md, and validates the repository scoped to this feature.
