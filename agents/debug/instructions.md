# Debug Workflow

Follow these steps in order.

## Step 1 - Capture the Bug Report

Record:

- Description
- Steps to Reproduce
- Expected Behavior
- Actual Behavior
- Severity/impact, if known

If any of Steps to Reproduce, Expected Behavior or Actual Behavior is
missing, ask for it before continuing. Do not guess reproduction steps.

---

## Step 2 - Load Context

Read, if available:

- features/<feature-name>/specification.md
- features/<feature-name>/design.md
- features/<feature-name>/architecture.md
- features/<feature-name>/backend-implementation-report.md
- features/<feature-name>/frontend-implementation-report.md
- context/**
- policies/**

These are read for intended behavior only. None of them are modified by
this agent.

---

## Step 3 - Reproduce

Reproduce the bug against the current codebase.

If it cannot be reproduced, stop. Report "Cannot Reproduce" with what was
tried. Do not mark it Fixed.

---

## Step 4 - Investigate the Root Cause

Trace the defect to its source: the specific function, layer, or
interaction responsible.

Distinguish the root cause from its symptoms.

---

## Step 5 - Classify Complexity

Classify explicitly as Simple or Complex using the criteria in
system.md / agent.yaml. This is a hard gate: do not proceed to Step 6a until
this classification is written down.

The bug is Simple only if ALL of these hold:

- Root cause identified with high confidence, inside one component/layer
- Fix does not change a public API contract or database schema
- Fix does not touch authentication, authorization, payments or PII
- Fix stays within a single feature/bounded context
- No prior fix attempt for this exact bug has already failed

The bug is Complex if ANY of these hold:

- Root cause still unclear after Step 4
- Fix requires an API contract or schema change
- Concurrency/race-condition or data-integrity issue spanning multiple
  transactions or services
- Fix crosses the Backend/Frontend boundary non-trivially, or spans more
  than one feature
- Security-sensitive
- A previous fix for this same bug already failed or regressed

When uncertain, classify Complex.

---

## Step 6a - Simple Path: Fix

Only if classified Simple.

1. Implement the smallest change that removes the root cause.
2. Add a regression test that fails against the pre-fix behavior and passes
   against the fix.
3. Run the full existing test suite for the affected area; it must still
   pass.
4. Update every document that described the pre-fix behavior (implementation
   report's Known Limitations / Files Modified, README, API docs,
   changelog, relevant inline documentation). Do not touch documentation
   unrelated to this fix.
5. Do not refactor unrelated code.

Proceed to Step 7.

---

## Step 6b - Complex Path: Flow Analysis Only

Only if classified Complex.

Do NOT write any fix. Instead produce a Root Cause Flow Analysis covering:

- Affected components/services/layers
- Sequence of events that leads to the defect (a step-by-step flow)
- Root-cause hypotheses, ranked by confidence
- Proposed fix strategies, each with trade-offs and blast radius
- Risks of each strategy (data migration, breaking API consumers,
  performance, security)
- Recommended strategy, clearly marked as a recommendation, not a decision

Skip to Step 7. Source code and documentation remain untouched.

---

## Step 7 - Generate the Report

Create the debug report using templates/debug-report.md.

Place it at:

- features/<feature-name>/debug-reports/<bug-id>-debug-report.md, if the bug
  is tied to a tracked feature
- bugs/<bug-id>/debug-report.md, otherwise

Required sections:

- Summary
- Complexity Classification
- Root Cause (Simple path) or Root Cause Flow Analysis (Complex path)
- Files Changed (Simple path only; empty on Complex path)
- Regression Test (Simple path only; empty on Complex path)
- Documentation Updated (Simple path only; empty on Complex path)
- Known Limitations
- Follow-up Tasks

Finish with exactly one status line:

- `STATUS: FIXED` for the Simple path
- `STATUS: NEEDS_FLOW_REVIEW` for the Complex path

A Complex bug returns to this agent for Steps 6a and 7 only after a human
has reviewed and approved the Flow Analysis and its recommended strategy.
