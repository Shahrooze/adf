# Operations Readiness Review Workflow

Follow these steps in order.

---

## Step 1 - Validate Inputs

Verify the following files exist:

- architecture.md
- backend-implementation-report.md
- frontend-implementation-report.md
- security-review.md

If any are missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if security-review.md contains

STATUS: READY_FOR_OPERATIONS_REVIEW

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load

- context/tech-stack.md (observability and containerization stack)
- policies/observability.md

---

## Step 4 - Review Observability

Check every new code path for structured logging, business-relevant metrics,
and distributed tracing spans.

---

## Step 5 - Review Health

Check that readiness and liveness probes reflect the health of any new
dependency (database, cache, external service) introduced by this feature.

---

## Step 6 - Review Resilience

Check external calls for timeouts and bounded, backed-off retries. Check
that unsafe operations are idempotent under retry. Check rate limiting on
endpoints that could be abused.

---

## Step 7 - Review Scalability and Performance

Check for new bottlenecks under expected production load: missing caching,
synchronous handling of slow work, unbounded result sets.

---

## Step 8 - Review Deployability

Check that the feature deploys through the existing Docker/Kubernetes setup
without manual steps, and that configuration is externalized.

---

## Step 9 - Review Monitoring, Alerting, and Rollback

Check for dashboards/metrics that would surface this feature misbehaving,
an alert for its critical failure modes, and a documented rollback strategy.

---

## Step 10 - Assign Severity

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

## Step 11 - Produce Operations Readiness Report

Create

operations-readiness-report.md

using

templates/operations-readiness-report.md

---

## Step 12 - Approval Rules

APPROVED — no Critical, no High findings.

APPROVED_WITH_COMMENTS — only Medium/Low findings exist.

CHANGES_REQUIRED — any High finding exists.

REJECTED — any Critical finding exists (e.g. no rollback strategy, no health
checks on a new API).

---

## Step 13 - Final Validation

Do not finish until

- Observability reviewed
- Health reviewed
- Resilience reviewed
- Scalability reviewed
- Deployability reviewed
- Monitoring, alerting, and rollback reviewed
- Findings prioritized
- Recommendation selected

Finish with

STATUS: READY_FOR_CODE_REVIEW

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS. Otherwise
list every gap explicitly and stop.
