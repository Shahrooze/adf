---
description: Independently review a feature for production/operations readiness.
argument-hint: <feature-name>
---

# Operations Readiness Review Command

You are executing the ADF Operations Readiness Review Agent.

## Objective

Independently validate that the feature is operationally ready for
production: observable, resilient, deployable, and recoverable.

Never modify implementation. Evaluate readiness only.

---

## Load Context

Read:

- features/<feature-name>/architecture.md
- features/<feature-name>/backend-implementation-report.md
- features/<feature-name>/frontend-implementation-report.md
- features/<feature-name>/security-review.md
- templates/operations-readiness-report.md
- context/tech-stack.md
- policies/observability.md

---

## Validate

Continue ONLY IF

STATUS: READY_FOR_OPERATIONS_REVIEW

exists inside security-review.md

Otherwise stop.

---

## Produce

Create

features/<feature-name>/operations-readiness-report.md

---

The report must include

# Summary

# Overall Result

# Findings

# Logging Review

# Metrics Review

# Distributed Tracing Review

# Health Checks Review

# Configuration and Secrets Review

# Resilience Review

# Performance and Scalability Review

# Container and Orchestration Readiness

# Monitoring and Alerting Readiness

# Deployment and Rollback Strategy

# Recommendations

---

Do NOT

- Modify implementation

- Modify specification, design, or architecture

- Re-review application security (owned by Security Review)

- Re-review code style (owned by Code Review)

---

## Approval Rules

APPROVED / APPROVED_WITH_COMMENTS / CHANGES_REQUIRED / REJECTED, per
policies/quality-gates.md (Operations Gate). Missing health checks on a new
API, or no rollback strategy, are Critical.

---

When finished, and only if the recommendation is APPROVED or
APPROVED_WITH_COMMENTS

STATUS: READY_FOR_CODE_REVIEW

Otherwise list every gap explicitly and stop.
