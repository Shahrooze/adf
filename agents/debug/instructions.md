# Debug Workflow

Follow these steps in order.

## Step 1 - Capture the Bug Report

Confirm: Description, Steps to Reproduce, Expected Behavior, Actual Behavior. If any is missing, ask before continuing.

## Step 2 - Load Context

Read, if available: features/<feature-name>/{specification.md, design.md, architecture.md, backend-implementation-report.md, frontend-implementation-report.md}, templates/debug-report.md, context/**, policies/coding.md, policies/security.md, policies/testing.md, policies/git.md. These are read for intended behavior only; none are modified in this step.

## Step 3 - Reproduce

Reproduce against the current codebase. If it cannot be reproduced, stop and report "Cannot Reproduce". Never mark a bug Fixed without reproducing it first.

## Step 4 - Root Cause

Trace the defect to its actual source. Distinguish root cause from symptom.

## Step 5 - Classify Complexity

Apply the Complexity Classification in system.md before touching any code or documentation. When uncertain, classify Complex.

## Step 6a - If Simple: Update Documentation, Then Fix

Work in this exact order; do not reorder these sub-steps.

1. Update documentation first: before touching any source code, update every document that describes the affected behavior — implementation report, README, API docs, changelog, relevant inline docs — to state the CORRECT/expected behavior. Do not touch unrelated documentation. This is the target the fix must satisfy; if the code does not end up matching it, the fix is incomplete.
2. Fix: implement the smallest change that removes the root cause and makes the code match the documentation written in sub-step 1.
3. Regression test: add one that fails before the fix and passes after.
4. Verify: run the existing test suite for the affected area; it must still pass.

Never refactor unrelated code.

## Step 6b - If Complex: Flow Analysis Only

Do NOT write any fix and do NOT change any documentation. Produce instead:

- Affected components/services/layers
- Sequence of events leading to the defect
- Root-cause hypotheses, ranked by confidence
- Proposed fix strategies with trade-offs, blast radius and risks
- A recommended strategy, clearly marked as a recommendation requiring human approval

## Step 7 - Generate Report

Create features/<feature-name>/debug-reports/<bug-id>-debug-report.md (or bugs/<bug-id>/debug-report.md if not tied to a tracked feature) using templates/debug-report.md.

Finish with exactly one status line: `STATUS: FIXED` (Simple path) or `STATUS: NEEDS_FLOW_REVIEW` (Complex path)

## Sync ADF Core

If the bug is tied to a tracked feature, run `node adf-core/cli.mjs sync <feature-id>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates the repository scoped to this feature).
