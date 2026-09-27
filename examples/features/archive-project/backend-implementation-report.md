# Implementation Report

> Status: Complete

---

# Metadata

- Feature: FEAT-001-archive-project
- Layer: Backend
- Version: 1.0
- Author: Backend Agent
- Date: 2026-09-21

---

# Summary

Implements the backend for FR-001 to FR-006 as specified in architecture.md (Domain Model, Application Layer, API, Database). Also resolves architecture-review AR-001 (task- and comment-keyed commands now expose `ProjectId`; architecture test covers all three slices) and AR-002 (lowercase string enum in OpenAPI). API contracts for every screen in design.md are listed under Technical Notes.

---

# Scope

Implemented

- Domain archive state, idempotent archive/unarchive, read-only guard.
- PUT/DELETE `/v1/projects/{projectId}/archive`, list `status` filter, archive fields on project responses.
- 409 `PROJECT_ARCHIVED` on every project, task and comment write.
- Migrations, audit log entries, logs, metrics, tracing spans.

Not Implemented

- AR-003 (dropping `ix_projects_updated_at`): deferred follow-up, see Future Improvements.
- All UI (owned by Frontend).

---

# Files Created

| File | Description |
|------|-------------|
| src/backend/Taskboard.Domain/Projects/ArchiveInfo.cs | Value object (ArchivedAt, ArchivedByUserId). |
| src/backend/Taskboard.Domain/Projects/ProjectArchivedException.cs | Domain exception for BR-002. |
| src/backend/Taskboard.Domain/Projects/Events/ProjectArchived.cs | Domain event. |
| src/backend/Taskboard.Domain/Projects/Events/ProjectUnarchived.cs | Domain event. |
| src/backend/Taskboard.Application/Projects/ArchiveProject/ArchiveProjectCommand.cs | Command + handler. |
| src/backend/Taskboard.Application/Projects/UnarchiveProject/UnarchiveProjectCommand.cs | Command + handler. |
| src/backend/Taskboard.Application/Projects/Events/ProjectArchiveAuditHandler.cs | Writes audit entries (NFR-007). |
| src/backend/Taskboard.Application/Common/IProjectScopedCommand.cs | Marker interface exposing `ProjectId`. |
| src/backend/Taskboard.Application/Common/Behaviors/ProjectWriteGuardBehavior.cs | Pipeline behavior enforcing FR-005. |
| src/backend/Taskboard.Api/Endpoints/Projects/ProjectArchiveEndpoints.cs | PUT/DELETE archive endpoints. |
| src/backend/Taskboard.Infrastructure/Persistence/Migrations/20260921093000_AddProjectArchiving.cs | Columns + FK. |
| src/backend/Taskboard.Infrastructure/Persistence/Migrations/20260921093100_AddProjectArchivingIndexes.cs | Concurrent partial indexes. |
| tests/backend/Taskboard.Domain.Tests/Projects/ProjectArchiveTests.cs | Domain unit tests. |
| tests/backend/Taskboard.Application.Tests/Projects/ListProjectsQueryValidatorTests.cs | Validator tests. |
| tests/backend/Taskboard.Api.IntegrationTests/Projects/ProjectArchiveEndpointTests.cs | Endpoint + authorization tests. |
| tests/backend/Taskboard.Api.IntegrationTests/Projects/ArchivedProjectWriteGuardTests.cs | 409 on every write route, concurrency. |
| tests/backend/Taskboard.Architecture.Tests/ProjectScopedCommandTests.cs | AR-001 architecture test. |

---

# Files Modified

| File | Reason |
|------|--------|
| src/backend/Taskboard.Domain/Projects/Project.cs | `Archive`, `Unarchive`, `EnsureWritable`, `IsArchived`. |
| src/backend/Taskboard.Application/Projects/ListProjects/ListProjectsQuery.cs | `Status` filter (default active). |
| src/backend/Taskboard.Application/Projects/ListProjects/ListProjectsQueryValidator.cs | VR-002, paging bounds. |
| src/backend/Taskboard.Application/Projects/GetProject/ProjectResponse.cs | `status`, `archivedAt`, `archivedBy`. |
| src/backend/Taskboard.Application/Tasks/*/*Command.cs, Comments/*/*Command.cs | Implement `IProjectScopedCommand` (AR-001). |
| src/backend/Taskboard.Infrastructure/Persistence/Configurations/ProjectConfiguration.cs | Map `ArchiveInfo` as owned type. |
| src/backend/Taskboard.Infrastructure/Projects/ProjectRepository.cs | `GetForUpdateAsync`, `LockForShareAsync`. |
| src/backend/Taskboard.Api/Errors/ProblemDetailsMapper.cs | Map `ProjectArchivedException` to 409 `PROJECT_ARCHIVED`. |
| src/backend/Taskboard.Api/Telemetry/ProjectMetrics.cs | Three new counters. |

---

# Acceptance Criteria Coverage

| ID | Status | Notes |
|----|--------|-------|
| AC-001 | Covered (API) | PUT archive → 204; default list excludes it. UI part: Frontend. |
| AC-002 | N/A (Backend) | Cancel is client-only; no request sent. |
| AC-003 | Covered (API) | DELETE archive → 204; writes accepted again. |
| AC-004 | Covered | `GET /v1/projects` defaults to `status=active`. |
| AC-005 | Covered | `status=archived` returns only archived projects of which the caller is a member. |
| AC-006 | Covered (API) | Editor/Viewer → 403 `NOT_PROJECT_OWNER`; state unchanged. Control hiding: Frontend. |
| AC-007 | Covered (API) | Every write route → 409 `PROJECT_ARCHIVED`; data unchanged. Control hiding: Frontend. |
| AC-008 | Covered (API) | `archivedBy.displayName` and `archivedAt` returned. Banner: Frontend. |
| AC-009 | Covered | Archive/unarchive round-trip leaves tasks and comments byte-identical. |
| AC-010 | Covered | Second PUT → 204, `archivedAt`/`archivedBy` unchanged, no second audit entry. |
| AC-011 | Covered | Members can GET archived project, tasks and comments. |

---

# Business Rules Coverage

| Rule | Status | Notes |
|------|--------|-------|
| BR-001 | Covered | `ProjectOwner` policy on both endpoints. |
| BR-002 | Covered | `ProjectWriteGuardBehavior` + `EnsureWritable()`; only DELETE archive bypasses. |
| BR-003 | Covered | Archive touches only `archived_at`/`archived_by_user_id`. |
| BR-004 | Covered | Domain no-op on repeat; events raised only on change. |
| BR-005 | Covered | Membership untouched; read queries do not filter archived projects out of detail routes. |

---

# Tests

## Unit Tests

- `ProjectArchiveTests`: 9 tests (archive, unarchive, repeat no-op, EnsureWritable, events).
- `ListProjectsQueryValidatorTests`: 5 tests (status allow-list, paging bounds).

## Integration Tests

- `ProjectArchiveEndpointTests`: 12 tests (Owner 204, Editor/Viewer 403, non-member 404, deleted project 404, idempotency, list filters, pagination, archived-by deleted user returns null).
- `ArchivedProjectWriteGuardTests`: 14 tests (409 on each of 12 write routes; concurrent archive vs. task update serializes; archive then unarchive round-trip).
- `ProjectScopedCommandTests`: 1 architecture test across Projects/Tasks/Comments.
- Migration up/down verified against Testcontainers PostgreSQL 17.

## Manual Verification

- Exercised all endpoints via Scalar; confirmed OpenAPI enum `active`/`archived` (AR-002).

---

# Technical Notes

API contracts (consumed by frontend; all require `Authorization: Bearer <JWT>`; errors are ProblemDetails with `code`):

- `PUT /v1/projects/{projectId}/archive` → 204. Errors: 403 `NOT_PROJECT_OWNER`, 404 `PROJECT_NOT_FOUND`. Used by SCR-004.
- `DELETE /v1/projects/{projectId}/archive` → 204. Same errors. Used by SCR-002 banner and SCR-003.
- `GET /v1/projects?status=active|archived&page=1&pageSize=20` → 200 `{ items: [{ id, name, status, archivedAt, updatedAt, role }], page, pageSize, totalCount }`. Error: 400 `VALIDATION_FAILED`. Used by SCR-001.
- `GET /v1/projects/{projectId}` → 200 `{ id, name, description, status, archivedAt, archivedBy: { id, displayName } | null, role, ... }`. Used by SCR-002, SCR-003.
- Any existing write under `/v1/projects/{projectId}/...` → 409 `PROJECT_ARCHIVED` when archived. Used by SCR-002 error state.

Decisions: archived-by user deleted → `archivedBy: null` (EC-008). Archive handler takes `FOR UPDATE`; guard takes `FOR SHARE` (EC-004).

---

# Known Limitations

- `archivedAt` is returned in UTC; locale/time zone formatting is the client's responsibility (NFR-006).

---

# Future Improvements

- AR-003: drop `ix_projects_updated_at` after query analysis.
- Product analytics event for archive (product-review PR-003).

---

# Risks

- Low: new write routes added later must implement `IProjectScopedCommand`; the architecture test fails the build otherwise.

---

# Completion Checklist

- [x] Code Compiles
- [x] Tests Pass
- [x] Acceptance Criteria Covered
- [x] Business Rules Covered
- [x] Documentation Updated

---

STATUS: READY_FOR_FRONTEND
