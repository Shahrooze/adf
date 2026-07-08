# Code Review Workflow

Follow these steps exactly in order.

---

# Step 1 - Validate Inputs

Verify the following files exist.

Required:

- backend-implementation-report.md
- frontend-implementation-report.md
- operations-readiness-report.md

If any required file is missing,

STOP.

Explain what is missing.

---

# Step 2 - Validate Status

Continue only if

operations-readiness-report.md contains

STATUS: READY_FOR_CODE_REVIEW

Otherwise STOP.

---

# Step 3 - Load Context

Read

- context/**
- policies/coding.md

---

# Step 4 - Review Maintainability and Readability

Read the backend and frontend source code.

Judge whether another engineer could safely change it without deep
archaeology, and whether intent is obvious without external context.

---

# Step 5 - Review SOLID and Clean Code

Verify

- Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- Small methods and classes
- No magic numbers
- No commented-out or dead code

---

# Step 6 - Review Naming, Duplication and Complexity

Verify

- Naming follows project conventions
- Logic is not needlessly duplicated
- Abstractions exist only where duplication justifies them
- Methods/classes are not doing too much

---

# Step 7 - Review Best Practices

Verify adherence to policies/coding.md and established project patterns.

---

# Step 8 - Stay In Scope

Do NOT re-review

- Correctness or acceptance criteria (owned by QA)
- Security (owned by Security Review)
- Operations readiness (owned by Operations Readiness Review)

If you notice an issue in one of these areas, note it only as a
cross-reference, and do not let it affect this gate's recommendation.

---

# Step 9 - Assign Severity

Each finding must contain

- ID
- Severity
- Category
- Description
- Recommendation

Allowed Severity

- Critical
- High
- Medium
- Low

---

# Step 10 - Produce Code Review Report

Create

code-review-report.md

using this structure

# Summary

# Overall Result

# Findings

# Maintainability Review

# Readability Review

# SOLID Review

# Clean Code Review

# Naming Review

# Duplication Review

# Complexity Review

# Best Practices Review

# Positive Observations

# Recommendations

# Approval

---

# Approval Rules

APPROVED

Only when

- No Critical
- No High

---

APPROVED_WITH_COMMENTS

Allowed when

- Medium
- Low

exist.

---

CHANGES_REQUIRED

If

High

issues exist.

---

REJECTED

If

Critical

issues exist.

---

# Step 11 - Final Validation

Verify

- Maintainability, Readability, SOLID, Clean Code, Naming, Duplication, Complexity and Best Practices all reviewed
- No finding duplicates a concern owned by QA, Security Review, or Operations Readiness Review
- Findings prioritized

If anything is missing

STOP.

Explain why.

Otherwise finish with

STATUS: RELEASE_READY

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS.
