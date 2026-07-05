# Review Workflow

Follow these steps exactly in order.

---

# Step 1 - Validate Inputs

Verify the following files exist.

Required:

- specification.md
- design.md
- architecture.md
- backend-implementation-report.md
- frontend-implementation-report.md

If any required file is missing,

STOP.

Explain what is missing.

---

# Step 2 - Validate Status

Continue only if

frontend-implementation-report.md contains

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
- Accessibility Policy
- Frontend Policy
- Design Policy
- Performance Rules

---

# Step 4 - Review Specification

Verify the specification is internally consistent.

Check for contradictory Business Rules or Acceptance Criteria that only
became visible once Design, Architecture, Backend and Frontend were built.

Record every issue under Stage: Specification.

---

# Step 5 - Review Design

Verify

- Every Functional Requirement maps to a screen in design.md
- Every data-driven screen documents Loading, Empty, Error and Success states
- Accessibility is documented per screen
- Design Tokens are defined or reused consistently

Record every issue under Stage: Design.

---

# Step 6 - Review Architecture

Verify

- Layer boundaries
- Dependency direction
- Naming conventions
- API contracts
- Database design
- Domain model
- Architecture does not encode UI/UX decisions that belong to Design

Record every issue under Stage: Architecture.

---

# Step 7 - Review Backend

Verify

- Every Functional Requirement is implemented
- Every Business Rule is respected
- API contracts cover every screen and form in design.md
- Code quality (readability, complexity, duplication, SOLID, Clean Architecture)
- Error handling

Record every issue under Stage: Backend.

---

# Step 8 - Review Frontend

Verify

- Every screen, component, form and state in design.md is implemented exactly
- Every API call matches the contract documented by the Backend
- Responsive Behavior matches design.md
- No UX decision was invented by the Frontend Agent
- Code quality (component structure, reuse, readability)

Record every issue under Stage: Frontend.

---

# Step 9 - Review Security

Inspect

- Authentication
- Authorization
- Input Validation
- Sensitive Data
- Secret Handling
- Injection Risks
- Frontend exposure of data or logic that belongs server-side

Record every issue with the appropriate Stage (Backend or Frontend).

---

# Step 10 - Review Accessibility

Inspect every screen against policies/accessibility.md

- Keyboard navigability
- Focus order
- Color contrast
- Screen reader labeling

Record every issue under Stage: Frontend.

---

# Step 11 - Review Performance

Inspect

- N+1 Queries
- Inefficient LINQ
- Missing Pagination
- Large Memory Allocations
- Blocking Calls
- Expensive Loops
- Unnecessary client-side re-renders or bundle size regressions

Record findings with the appropriate Stage (Backend or Frontend).

---

# Step 12 - Review Tests

Verify

- Acceptance Criteria Coverage
- Business Rule Coverage
- Backend Unit Tests
- Backend Integration Tests
- Frontend Component Tests
- Frontend API Integration Tests

Record missing tests with the appropriate Stage.

---

# Step 13 - Assign Severity

Each finding must contain

- ID
- Stage
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

# Step 14 - Produce Review Report

Create

review-report.md

using this structure

# Summary

# Overall Result

# Findings

# Specification Review

# Design Review

# Architecture Review

# Backend Review

# Frontend Review

# Security Review

# Accessibility Review

# Performance Review

# Test Coverage Review

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

# Step 15 - Final Validation

Verify

- Specification reviewed
- Design reviewed
- Architecture reviewed
- Backend reviewed
- Frontend reviewed
- Security reviewed
- Accessibility reviewed
- Performance reviewed
- Test coverage reviewed
- Every finding attributed to exactly one Stage

If anything is missing

STOP.

Explain why.

Otherwise finish with

STATUS: REVIEW_COMPLETED
