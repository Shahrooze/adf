# Operations Readiness Review Workflow

Follow these steps in order.

## Step 1 - Validate Inputs and Status

Verify architecture.md, backend-implementation-report.md, frontend-implementation-report.md and security-review.md exist; if any are missing, stop immediately. Continue only if security-review.md contains `STATUS: READY_FOR_OPERATIONS_REVIEW`; otherwise stop and explain why.

## Step 2 - Read Context

Load context/tech-stack.md (observability and containerization stack) and policies/observability.md.

## Step 3 - Review Observability

Check every new code path for structured logging at an appropriate level, key business events captured as metrics, and end-to-end tracing (OpenTelemetry spans).

## Step 4 - Review Health

Check that readiness and liveness probes (ASP.NET Health Checks) exist and reflect the health of any new dependency (database, cache, external service) introduced by this feature.

## Step 5 - Review Resilience

Check external calls for timeouts and bounded, backed-off retries; that unsafe operations (writes, payments, side-effecting calls) are idempotent under retry; and rate limiting on endpoints that could be abused.

## Step 6 - Review Scalability and Performance

Check for new bottlenecks under expected production load: missing caching where clearly warranted, slow work handled synchronously instead of in background jobs, unbounded result sets.

## Step 7 - Review Deployability

Check that the feature deploys through the existing Docker/Kubernetes setup without manual steps, and that configuration and deployment secrets are externalized (no rebuild needed to change environment-specific values).

## Step 8 - Review Monitoring, Alerting, and Rollback

Check for dashboards/metrics that would surface this feature misbehaving in production, an alert for its critical failure modes, and a documented, tested rollback strategy.

## Step 9 - Produce Report

Record findings as defined in system.md (Findings) and create operations-readiness-report.md using templates/operations-readiness-report.md.

## Step 10 - Approval Rules

- APPROVED — no Critical, no High findings.
- APPROVED_WITH_COMMENTS — only Medium/Low findings exist.
- CHANGES_REQUIRED — any High finding exists.
- REJECTED — any Critical finding exists (e.g. no rollback strategy, no health checks on a new API).

## Step 11 - Final Validation

Do not finish until Steps 3–10 are complete, findings are prioritized and a recommendation is selected. List every gap explicitly. End operations-readiness-report.md with the STATUS line mapped from the recommendation (system.md): `STATUS: READY_FOR_CODE_REVIEW`, `STATUS: CHANGES_REQUIRED` or `STATUS: REJECTED`.

## Step 12 - Sync ADF Core

Run `node adf-core/cli.mjs sync FEAT-<NNN>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
