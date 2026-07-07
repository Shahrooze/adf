# Debug Report

> Status: Draft

> Produced by the Debug Agent. Two possible outcomes: STATUS: FIXED (Simple
> path — code fixed, regression test added, docs updated) or
> STATUS: NEEDS_FLOW_REVIEW (Complex path — no code changed, a Root Cause
> Flow Analysis is proposed for human review instead).

---

# Metadata

- Bug ID:
- Feature:
- Reported By:
- Author:
- Date:

---

# Summary

Brief description of the bug, its impact, and the outcome of this report.

---

# Bug Report

- Steps to Reproduce:
- Expected Behavior:
- Actual Behavior:
- Severity:

---

# Complexity Classification

- Classification: (Simple / Complex)
- Reasoning:

---

# Root Cause

> Simple path only. Leave empty on the Complex path.

Component/layer responsible:

Explanation of the root cause, distinct from its symptoms:

---

# Root Cause Flow Analysis

> Complex path only. Leave empty on the Simple path.

## Affected Components

-

## Sequence of Events

1.

## Root Cause Hypotheses (ranked by confidence)

1.

## Proposed Fix Strategies

| Strategy | Trade-offs | Blast Radius | Risks |
|----------|-----------|---------------|-------|

## Recommended Strategy

> Marked as a recommendation only. Requires human approval before
> implementation.

---

# Files Changed

> Simple path only.

| File | Reason |
|------|--------|

---

# Regression Test

> Simple path only.

- Test name:
- Confirms failure before fix / success after fix:

---

# Documentation Updated

> Simple path only.

| Document | Change |
|----------|--------|

---

# Known Limitations

-

---

# Follow-up Tasks

-

---

# Completion Checklist

- [ ] Bug reproduced
- [ ] Complexity classified before any code was touched
- [ ] (Simple) Root cause documented, not just a symptom
- [ ] (Simple) Regression test added and passing
- [ ] (Simple) Existing tests still pass
- [ ] (Simple) Stale documentation updated
- [ ] (Complex) No source code changed
- [ ] (Complex) Flow Analysis covers components, sequence, hypotheses, strategies, risks

---

STATUS: FIXED

> Use exactly one status line in the generated document: `STATUS: FIXED` for
> the Simple path, or `STATUS: NEEDS_FLOW_REVIEW` for the Complex path.
