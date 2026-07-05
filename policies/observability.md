# Observability Policy

## Logging

Use structured logging (Serilog, per context/tech-stack.md), never string
concatenation.

Every error path must log at an appropriate level (Warning for expected
failures, Error for unexpected ones).

Never log secrets, tokens, or full request/response bodies containing
sensitive data.

---

# Metrics

Emit metrics for business-relevant events (e.g. orders created, payments
failed), not just infrastructure metrics.

Use consistent naming: `{domain}.{entity}.{event}` (e.g. `orders.created`).

---

# Tracing

Instrument new operations with OpenTelemetry spans, per context/tech-stack.md.

Propagate trace context across service and process boundaries.

---

# Health Checks

Every service that exposes an API must expose

- A liveness probe (is the process alive?)
- A readiness probe (can it currently serve traffic — are its dependencies healthy?)

Readiness probes must reflect the actual health of dependencies introduced
by the feature (database, cache, external service).

---

# Resilience

External calls must have an explicit timeout.

Retries must be bounded and use backoff; never retry indefinitely.

Unsafe operations (writes, payments) invoked with retries must be
idempotent.

Apply rate limiting to endpoints that could be abused or that call
expensive downstream systems.

---

# Alerting

Every new critical failure mode introduced by a feature should have a
corresponding alert or be covered by an existing one.

Alerts must be actionable — tied to a specific runbook or clear remediation
step, not just a raw metric threshold.

---

# Deployment and Rollback

Every feature must be deployable through the existing Docker/Kubernetes
pipeline without manual steps.

Every feature must have a documented rollback path that does not require a
manual data fix.

---

# AI Rules

The Operations Readiness Review Agent must never

- Approve a feature exposing a new API without health check coverage
- Approve a feature with an unbounded retry loop
- Approve a feature with no rollback strategy
