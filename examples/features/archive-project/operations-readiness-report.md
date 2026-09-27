# Operations Readiness Report

> Status: Complete

---

# Metadata

- Feature: FEAT-001-archive-project
- Reviewer: Operations Readiness Review Agent
- Date: 2026-09-25

---

# Summary

The feature introduces no new service, dependency or external call. It reuses the existing API's PostgreSQL connection, health checks and deployment pipeline. Observability is in place (structured logs, business metrics, spans, audit entries), both unsafe operations are idempotent by design, and the rollback path requires no manual data fix. One Medium finding on alerting and one Low finding on migration timing.

---

# Overall Result

APPROVED_WITH_COMMENTS

---

# Findings

| ID | Severity | Category | Description | Recommendation |
|----|----------|----------|-------------|----------------|
| OPS-001 | Medium | Alerting | A spike in `projects.write.rejected_archived` would indicate a client not honoring read-only mode (or a regression), but no alert exists. | Add an alert when the 15-minute rate exceeds 5x its 7-day baseline, linking to the runbook section "Archived project write rejections". |
| OPS-002 | Low | Deployment | `CREATE INDEX CONCURRENTLY` on `projects` (~1.2M rows) takes several minutes and must not run inside the startup migration transaction. | Run `AddProjectArchivingIndexes` as a separate migration job before rolling out pods; already non-transactional, just sequence it in the pipeline. |

---

# Logging Review

Observations

- Serilog structured templates: `Project {ProjectId} archived by {UserId}` (Information); refusals at Warning with `ProjectId`, `UserId`, `ErrorCode`.
- Unexpected exceptions fall through to the existing global handler (Error).
- No request bodies or tokens logged (see also security-review SEC-002).

---

# Metrics Review

Observations

- New counters follow `{domain}.{entity}.{event}`: `projects.project.archived`, `projects.project.unarchived`, `projects.write.rejected_archived`.
- Existing HTTP server duration histograms cover the new routes for NFR-001 latency tracking.

---

# Distributed Tracing Review

Observations (OpenTelemetry spans)

- Spans `ArchiveProject`, `UnarchiveProject` and child `ProjectWriteGuard` are created under the existing ASP.NET Core request span; EF Core instrumentation shows the `FOR UPDATE` / `FOR SHARE` queries.
- Trace context is propagated from the Next.js server via the existing `traceparent` header forwarding.

---

# Health Checks Review

| Dependency | Readiness Probe | Liveness Probe | Notes |
|------------|-------------------|-------------------|-------|
| PostgreSQL | Yes (existing `npgsql` check) | N/A | No new dependency; existing check covers the new endpoints. |
| API process | N/A | Yes (existing `/health/live`) | Unchanged. |

---

# Configuration and Secrets Review

Observations (deployment-time configuration, not source code)

- No new configuration keys, feature flags or secrets.

---

# Resilience Review

| Concern | Present | Notes |
|---------|---------|-------|
| Retry Policy | Yes | Existing EF Core `EnableRetryOnFailure` (3 attempts, exponential backoff); safe because operations are idempotent. |
| Timeout Policy | Yes | Existing 30 s command timeout; no external calls introduced. |
| Idempotency (unsafe operations) | Yes | PUT/DELETE archive are idempotent (BR-004); verified by tests. |
| Rate Limiting | Yes | `writes-per-user` policy applied per security-review SEC-001. |

---

# Performance and Scalability Review

Observations (expected production load, bottlenecks, caching)

- ~50 archive ops/day and ~30 list req/s at peak; well within current capacity.
- Partial indexes support both list filters; staging measured list p95 of 140 ms for a 1,000-project user (NFR-001 target 800 ms).
- No caching needed.

---

# Container and Orchestration Readiness

| Concern | Ready | Notes |
|---------|-------|-------|
| Docker | Yes | Existing API and web images; no Dockerfile changes. |
| Kubernetes | Yes | No manifest changes; migration job sequencing per OPS-002. |

---

# Monitoring and Alerting Readiness

Observations

- Existing API 5xx-rate and latency alerts cover the new routes.
- Dashboard "Projects" gains panels for the three new counters.
- See OPS-001 for the missing rejection-spike alert.

---

# Deployment and Rollback Strategy

Deployment Steps

1. Run migration `AddProjectArchiving` (metadata-only column add).
2. Run migration job `AddProjectArchivingIndexes` (concurrent, OPS-002).
3. Roll out API image, then web image, via the standard pipeline.

Rollback Strategy

- Roll back web and API images to the previous version; old code ignores the new nullable columns, so no schema rollback is needed.
- Projects archived before rollback reappear as active in the old version (no data loss, BR-003); on redeploy they are archived again because the columns were retained.
- Schema rollback (`Down` migrations) is only needed to fully remove the feature and requires no manual data fix.

---

# Positive Observations

- Additive schema lets code and schema roll back independently.
- Idempotent endpoints make client and EF retries safe.

---

# Recommendations

- Add the OPS-001 alert and runbook entry; sequence OPS-002 in the pipeline.

---

# Final Checklist

- [x] Logging Reviewed
- [x] Metrics Reviewed
- [x] Tracing Reviewed
- [x] Health Checks Reviewed
- [x] Configuration and Secrets Reviewed
- [x] Resilience Reviewed
- [x] Performance and Scalability Reviewed
- [x] Container/Orchestration Readiness Reviewed
- [x] Monitoring and Alerting Reviewed
- [x] Deployment and Rollback Strategy Reviewed
- [x] Findings Prioritized

---

STATUS: READY_FOR_CODE_REVIEW
