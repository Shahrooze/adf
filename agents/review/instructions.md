# Review Workflow

Follow these steps exactly in order.

---

# Step 1 - Validate Inputs

Verify the following files exist.

Required:

- specification.md
- architecture.md
- implementation-report.md

If any required file is missing,

STOP.

Explain what is missing.

---

# Step 2 - Validate Status

Continue only if

implementation-report.md contains

STATUS: READY_FOR_REVIEW

Otherwise STOP.

---

# Step 3 - Load Context

Read

- context/**
- policies/**

Pay special attention to

- Coding Standards
- Security Policies
- Architecture Rules
- Performance Rules

---

# Step 4 - Review Specification Compliance

Verify every

Functional Requirement

has been implemented.

Verify every

Business Rule

has been respected.

Verify every

Acceptance Criterion

is satisfied.

Record every missing item.

---

# Step 5 - Review Architecture Compliance

Verify

- Layer boundaries
- Dependency direction
- Naming conventions
- API contracts
- Database design
- Domain model

Record every violation.

---

# Step 6 - Review Code Quality

Inspect

- Readability
- Complexity
- Duplication
- SOLID
- Clean Architecture
- Error Handling

Record improvements.

---

# Step 7 - Review Security

Inspect

- Authentication
- Authorization
- Input Validation
- Sensitive Data
- Secret Handling
- Injection Risks

Record every issue.

---

# Step 8 - Review Performance

Inspect

- N+1 Queries
- Inefficient LINQ
- Missing Pagination
- Large Memory Allocations
- Blocking Calls
- Expensive Loops

Record findings.

---

# Step 9 - Review Tests

Verify

- Acceptance Criteria Coverage
- Business Rule Coverage
- Unit Tests
- Integration Tests

Record missing tests.

---

# Step 10 - Assign Severity

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

# Step 11 - Produce Review Report

Create

review-report.md

using this structure

# Summary

# Overall Result

# Findings

# Positive Observations

# Risks

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

# Step 12 - Final Validation

Verify

- Every Acceptance Criterion reviewed
- Every Business Rule reviewed
- Architecture reviewed
- Security reviewed
- Performance reviewed
- Test coverage reviewed

If anything is missing

STOP.

Explain why.

Otherwise finish with

STATUS: REVIEW_COMPLETED