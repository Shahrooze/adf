# Quality Gates Policy

Every stage in workflows/feature-development.yaml is guarded by a Quality
Gate. A gate blocks the next stage until its Required Artifacts exist and
its Pass Criteria are met. This document is the human-readable reference;
workflows/feature-development.yaml is the machine-readable source of truth.

A gate is enforced by checking the exact `STATUS:` line inside its Required
Artifact — see each agent's `instructions.md` for the precise precondition.

---

# Feature Gate

- Required Artifact: specification.md
- Pass Criteria: specification.md exists and contains `STATUS: READY_FOR_PRODUCT_REVIEW`
- Fail Criteria: missing Business Goal, missing Acceptance Criteria, unresolved critical Open Question, contradictory Business Rules
- Blocking Conditions: any Fail Criterion present

---

# Product Gate

- Required Artifact: product-review.md
- Pass Criteria: recommendation is APPROVED or APPROVED_WITH_COMMENTS; `STATUS: READY_FOR_DESIGN`
- Fail Criteria: unmeasurable Business Goal, untestable Acceptance Criterion, contradictory Business Rules, unresolved Blocking Open Question
- Blocking Conditions: any Critical or High finding

---

# Design Gate

- Required Artifact: design.md
- Pass Criteria: `STATUS: READY_FOR_ARCHITECTURE`; every Functional Requirement maps to a screen; every data-driven screen has all four states; accessibility documented per screen
- Fail Criteria: missing screen, missing state, missing accessibility notes, unresolved Blocking Open UX Question
- Blocking Conditions: any Fail Criterion present

---

# Architecture Gate

- Required Artifact: architecture-review.md
- Pass Criteria: recommendation is APPROVED or APPROVED_WITH_COMMENTS; `STATUS: READY_FOR_BACKEND`
- Fail Criteria: layer boundary violation, unmitigated scalability risk, API inconsistent with policies/api-design.md, missing migration strategy
- Blocking Conditions: any Critical or High finding

---

# Backend Gate

- Required Artifact: backend-implementation-report.md
- Pass Criteria: `STATUS: READY_FOR_FRONTEND`; code compiles; backend tests pass; API contracts documented
- Fail Criteria: unimplemented Functional Requirement, unhonored Business Rule, undocumented API contract
- Blocking Conditions: any Fail Criterion present

---

# Frontend Gate

- Required Artifact: frontend-implementation-report.md
- Pass Criteria: `STATUS: READY_FOR_QA`; code compiles; frontend tests pass; design.md followed exactly
- Fail Criteria: screen/component/state missing versus design.md, API call not matching documented contract
- Blocking Conditions: any Fail Criterion present

---

# QA Gate

- Required Artifact: qa-report.md
- Pass Criteria: recommendation is APPROVED or APPROVED_WITH_COMMENTS; `STATUS: READY_FOR_SECURITY_REVIEW`; zero coverage Gaps
- Fail Criteria: any Acceptance Criterion or Business Rule is a Gap; Definition of Done not met
- Blocking Conditions: any Gap, any Critical or High finding

---

# Security Gate

- Required Artifact: security-review.md
- Pass Criteria: recommendation is APPROVED or APPROVED_WITH_COMMENTS; `STATUS: READY_FOR_OPERATIONS_REVIEW`
- Fail Criteria: missing auth/authz on a protected endpoint, hardcoded secret, injection vector, sensitive data exposure
- Blocking Conditions: any Critical or High finding

---

# Operations Gate

- Required Artifact: operations-readiness-report.md
- Pass Criteria: recommendation is APPROVED or APPROVED_WITH_COMMENTS; `STATUS: READY_FOR_CODE_REVIEW`
- Fail Criteria: new API without health checks, unbounded retry, non-idempotent unsafe operation, no rollback strategy
- Blocking Conditions: any Critical or High finding

---

# Code Quality Gate

- Required Artifact: code-review-report.md
- Pass Criteria: recommendation is APPROVED or APPROVED_WITH_COMMENTS; `STATUS: RELEASE_READY`
- Fail Criteria: critical maintainability issue, systemic duplication, naming inconsistent with project conventions
- Blocking Conditions: any Critical or High finding

---

# Release Gate

- Required Artifacts: product-review.md, design.md, architecture-review.md, backend-implementation-report.md, frontend-implementation-report.md, qa-report.md, security-review.md, operations-readiness-report.md, code-review-report.md — all present and all approved
- Pass Criteria: every prior gate passed; `STATUS: RELEASE_READY` present in code-review-report.md
- Fail Criteria: any prior gate not passed
- Blocking Conditions: any missing artifact or any prior gate in a failed state

---

# AI Rules

No agent may skip its own gate check to save time.

No agent may approve its own predecessor's artifact — every gate is checked
by reading the immediately preceding artifact's `STATUS:` line, never by
assuming success.

A REJECTED or CHANGES_REQUIRED recommendation always stops the pipeline at
that stage until the responsible agent resubmits.
