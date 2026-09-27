# Architecture Review Report

> Status: Complete

---

# Metadata

- Feature: FEAT-001-archive-project
- Reviewer: Architecture Review Agent
- Date: 2026-09-19

---

# Summary

The architecture is sound and proportionate to a Small feature. Archive state is correctly modeled on the `Project` aggregate, dependencies point inward, the API follows policies/api-design.md, and the schema change is additive with a documented rollback. Every Functional Requirement is traced. Findings are Medium/Low only and can be addressed during Backend Implementation.

---

# Overall Result

APPROVED_WITH_COMMENTS

---

# Findings

| ID | Severity | Category | Description | Recommendation |
|----|----------|----------|-------------|----------------|
| AR-001 | Medium | Clean Architecture | The write guard depends on each write command opting in via `IProjectScopedCommand`. The proposed architecture test detects omissions only for commands that carry a `ProjectId` property directly; commands keyed by `TaskId` or `CommentId` would be missed. | Make task- and comment-keyed commands resolve and expose `ProjectId`, and extend the architecture test to all commands in the `Projects`, `Tasks` and `Comments` slices. |
| AR-002 | Low | API Consistency | The `status` query parameter is described as an enum but its OpenAPI representation is not specified. | Emit it as a lowercase string enum (`active`, `archived`) in the OpenAPI document. |
| AR-003 | Low | Database | `ix_projects_active_updated_at` duplicates the leading column of the existing `ix_projects_updated_at`. | Keep the partial index (it is smaller and matches the default query) and plan to drop `ix_projects_updated_at` after verifying no other query needs it. |

---

# DDD Compliance Review

Observations

- `ArchiveInfo` is a proper immutable value object; archive state is invariant-protected inside the `Project` aggregate root.
- Idempotency (BR-004) is expressed as domain behavior, not as controller logic.
- Domain events are raised only on actual state change, which keeps the audit log truthful.

---

# Clean Architecture Compliance Review

Observations

- Domain has no dependency on EF Core or ASP.NET Core; `ProjectArchivedException` is a domain exception mapped to 409 in the API layer.
- Row locking (`FOR SHARE` / `FOR UPDATE`) is encapsulated in Infrastructure repositories behind application interfaces.
- The pipeline behavior keeps the read-only rule out of endpoint code (see AR-001 for completeness).

---

# Scalability Review

| Expected Load | Bottleneck Identified | Mitigation |
|-----------------|-------------------------|------------|
| ~50 archive ops/day | None | n/a |
| ~30 list req/s at peak, up to 1,000 projects/user | Membership join plus status filter | Partial indexes on `archived_at`; paginated (max 100). |
| All project writes | Extra `FOR SHARE` primary-key read | One indexed lookup; acceptable. |
| Up to 5,000 archived projects/user | Archived list sort | `ix_projects_archived_at` supports the sort; pagination. |

---

# API Consistency Review

| Endpoint | Follows policies/api-design.md | Notes |
|----------|----------------------------------|-------|
| PUT /v1/projects/{projectId}/archive | Yes | Resource-oriented singleton sub-resource; 204; idempotent by definition. |
| DELETE /v1/projects/{projectId}/archive | Yes | 204; idempotent. |
| GET /v1/projects | Yes | Versioned, paginated with `page`/`pageSize`/`totalCount`, allow-listed filter (AR-002). |
| GET /v1/projects/{projectId} | Yes | Additive fields only; no breaking change. |
| Existing write routes | Yes | New 409 `PROJECT_ARCHIVED` uses the shared ProblemDetails shape. |

---

# Database Design Review

Observations

- Two nullable columns on `projects`; normalized; FK with `ON DELETE SET NULL` supports EC-008.
- Indexing strategy matches both list query patterns implied by SCR-001 (see AR-003).
- Concurrent index creation avoids write locks during deployment.

Migration Strategy Reviewed: Yes

---

# Requirement Traceability Review

| Functional Requirement | Traced in Architecture | Notes |
|--------------------------|---------------------------|-------|
| FR-001 | Yes | `ArchiveProjectCommand`, PUT archive. |
| FR-002 | Yes | `UnarchiveProjectCommand`, DELETE archive. |
| FR-003 | Yes | `ListProjectsQuery` default `active`. |
| FR-004 | Yes | `ListProjectsQuery` `status=archived`, membership-scoped. |
| FR-005 | Yes | `EnsureWritable()` + `ProjectWriteGuardBehavior`, 409. |
| FR-006 | Yes | `archivedAt`, `archivedBy` on `ProjectResponse`. |

---

# Positive Observations

- Rollback is independent of schema thanks to additive nullable columns.
- 404 for non-members avoids project enumeration.
- Concurrency (EC-004) is explicitly designed rather than left to chance.

---

# Risks

- AR-001 is the main residual risk: a future write command could bypass read-only mode.

---

# Recommendations

- Backend: implement AR-001 and AR-002 as part of this feature; track AR-003 as a follow-up.

---

# Final Checklist

- [x] DDD Compliance Reviewed
- [x] Clean Architecture Compliance Reviewed
- [x] Scalability Reviewed
- [x] API Consistency Reviewed
- [x] Database Design Reviewed
- [x] Requirement Traceability Reviewed
- [x] Findings Prioritized

---

STATUS: READY_FOR_BACKEND
