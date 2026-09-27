# Architecture

> Status: Ready for Architecture Review

---

# Metadata

- Feature: FEAT-001-archive-project
- Version: 1.0
- Author: Architecture Agent
- Date: 2026-09-18

---

# Overview

Implements FR-001 to FR-006 as a vertical slice in the existing Taskboard .NET 10 API (Clean Architecture, DDD, CQRS). Archive state is modeled on the `Project` aggregate as an optional `ArchiveInfo` value object. Archive/unarchive is exposed as a singleton sub-resource `/v1/projects/{projectId}/archive` (PUT to archive, DELETE to unarchive), both idempotent (BR-004). Read-only enforcement (FR-005, BR-002) lives in the domain and is applied to every project-scoped write through an application pipeline behavior.

---

# Goals

- Server-side enforcement of BR-001 and BR-002 (NFR-002).
- Idempotent archive/unarchive with stable archive metadata (BR-004).
- Additive, zero-downtime schema change (NFR-003).
- List queries within NFR-001 for 1,000 projects per user.

---

# Constraints

- Minimal API endpoints, FluentValidation, EF Core on PostgreSQL 17 (context/tech-stack.md).
- Existing JWT authentication and existing `project_members.role` (Owner/Editor/Viewer).
- Existing RFC 9457 ProblemDetails error shape with a `code` extension.

---

# Assumptions

- Exactly one Owner row per project in `project_members` (specification Assumptions).
- The existing `audit_log` writer (`IAuditLog`) participates in the request's DbContext transaction.
- No Redis caching exists for project lists today; none is added.

---

# Domain Model

## Entities

| Entity | Description |
|---------|-------------|
| Project | Existing. Gains `Archive` (ArchiveInfo?) plus `Archive(userId, clock)`, `Unarchive()`, `EnsureWritable()` and `IsArchived`. |
| ProjectTask, Comment | Existing. Unchanged; writes go through the write guard. |

---

## Value Objects

| Value Object | Description |
|--------------|-------------|
| ArchiveInfo | Immutable `(ArchivedAt: DateTimeOffset, ArchivedByUserId: Guid?)`. Null user represents a departed member (EC-008). |
| ProjectStatusFilter | Enum `Active`, `Archived` used by the list query (VR-002). |

---

## Aggregates

| Aggregate | Root |
|-----------|------|
| Project (incl. membership) | Project |

`Archive()` is a no-op when already archived (BR-004) and raises `ProjectArchived` only on state change; `Unarchive()` likewise. `EnsureWritable()` throws `ProjectArchivedException` (BR-002).

---

# Application Layer

Commands

- `ArchiveProjectCommand(ProjectId)` / `UnarchiveProjectCommand(ProjectId)` (FR-001, FR-002).

Queries

- `ListProjectsQuery(Status, Page, PageSize)` modified (FR-003, FR-004).
- `GetProjectQuery(ProjectId)` modified to return archive info (FR-006).

Handlers

- `ArchiveProjectHandler`, `UnarchiveProjectHandler`: load project with `FOR UPDATE`, call domain method, save.
- `ProjectWriteGuardBehavior`: pipeline behavior for every command implementing `IProjectScopedCommand`; reads the project row `FOR SHARE` in the command's transaction and calls `EnsureWritable()`. Archive/unarchive commands are excluded (EC-004).

Validators

- `ListProjectsQueryValidator`: `status` in {active, archived}; `page` >= 1; `pageSize` 1..100.

---

# Infrastructure

Repositories

- `ProjectRepository.GetForUpdateAsync(id)` (new), `ProjectReadRepository.ListForMemberAsync(userId, status, paging)` (modified).

External Services

- None.

Storage

- PostgreSQL only.

Caching

- None (see Assumptions).

Messaging

- None; domain events handled in-process.

---

# Database

New Tables

- None.

Modified Tables

- `projects`: add `archived_at timestamptz NULL`, `archived_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL`.

Indexes

- `ix_projects_active_updated_at` on `projects (updated_at DESC) WHERE archived_at IS NULL` (default list).
- `ix_projects_archived_at` on `projects (archived_at DESC) WHERE archived_at IS NOT NULL` (Archived list, sorted newest first).
- Existing `ix_project_members_user_id` covers the membership join.

Migration Strategy

- EF Core migration `AddProjectArchiving`: nullable columns (metadata-only in PostgreSQL 17, no table rewrite); no backfill (null = active).
- Indexes created with `CREATE INDEX CONCURRENTLY` in a separate non-transactional migration step.
- `Down` drops the indexes and columns. Old application versions ignore the new columns, so code can be rolled back independently of the schema.

---

# API

## Endpoints

| Method | Route | Description |
|---------|-------|-------------|
| PUT | /v1/projects/{projectId}/archive | Archive (Owner). 204. Idempotent. |
| DELETE | /v1/projects/{projectId}/archive | Unarchive (Owner). 204. Idempotent. |
| GET | /v1/projects?status=active\|archived&page=&pageSize= | Modified. Default `active`. Paginated. |
| GET | /v1/projects/{projectId} | Modified. Adds `status`, `archivedAt`, `archivedBy`. |
| (all existing project/task/comment writes) | /v1/projects/{projectId}/... | Modified. 409 `PROJECT_ARCHIVED` when archived. |

---

## DTOs

Request Models

- No request body for PUT/DELETE archive. Query: `status` (enum), `page`, `pageSize`.

Response Models

- `ProjectSummaryResponse`: adds `status: "active" | "archived"`, `archivedAt: string | null` (ISO 8601 UTC).
- `ProjectResponse`: adds `status`, `archivedAt`, `archivedBy: { id, displayName } | null`.
- `PagedResponse<T>`: existing `{ items, page, pageSize, totalCount }`.

---

# Authorization

Roles

- Owner, Editor, Viewer (existing).

Permissions

- `project:archive` granted to Owner only (BR-001).

Policies

- `ProjectOwner` policy on both archive endpoints, via existing `ProjectMembershipAuthorizationHandler`. Non-members get 404 (VR-001, no enumeration); members without Owner role get 403.

---

# Events

Domain Events

- `ProjectArchived(ProjectId, ArchivedByUserId, ArchivedAt)`, `ProjectUnarchived(ProjectId, UnarchivedByUserId, At)`; handlers write the audit log entry (NFR-007).

Integration Events

- None.

---

# Error Handling

Business Errors

- 409 `PROJECT_ARCHIVED` for any write to an archived project (BR-002).
- 403 `NOT_PROJECT_OWNER` (BR-001); 404 `PROJECT_NOT_FOUND` (VR-001, EC-006).

Validation Errors

- 400 `VALIDATION_FAILED` with field errors (invalid `status`, paging).

System Errors

- 500 ProblemDetails without internals; logged at Error.

---

# Performance

Caching

- None.

Pagination

- Default pageSize 20, max 100 (NFR-004, EC-007).

Expected Load

- About 50 archive operations/day; list reads about 30 req/s at peak.

Potential Bottlenecks

- The `FOR SHARE` read adds one indexed primary-key lookup per project write; negligible at current load.

---

# Security

Authentication

- Existing JWT bearer on all routes.

Authorization

- See Authorization; owner check is server-side (NFR-002).

Input Validation

- Route ids are typed `Guid`; `status` bound to enum; no free-text input.

Sensitive Data

- `archivedBy` exposes display name only, never email.

---

# Logging

Audit Logs

- `project.archived` / `project.unarchived` with actor, project id, timestamp (NFR-007).

Application Logs

- Serilog Information on state change; Warning on 403/409 refusals with project id and user id.

Metrics

- `projects.project.archived`, `projects.project.unarchived`, `projects.write.rejected_archived` counters.

Tracing

- OpenTelemetry spans `ArchiveProject`, `UnarchiveProject`, and a `ProjectWriteGuard` child span.

---

# Testing Strategy

Unit Tests

- `Project` archive/unarchive/idempotency/EnsureWritable; validators.

Integration Tests

- Testcontainers PostgreSQL: endpoints, authorization matrix, 409 on every write route, concurrency (EC-004), migration up/down.

End-to-End Tests

- Playwright flows A, B, C from design.md.

---

# Risks

Technical Risks

- A new write command that forgets `IProjectScopedCommand` bypasses the guard.
- Race between archive and an in-flight write (EC-004).

Mitigation

- Architecture test asserting every command with a `ProjectId` implements `IProjectScopedCommand`.
- `FOR UPDATE` (archive) versus `FOR SHARE` (writes) serializes the two in PostgreSQL.

---

# Implementation Tasks

## Backend

- Domain: `ArchiveInfo`, `Project` methods, events, `ProjectArchivedException`.
- Application: commands, handlers, `ProjectWriteGuardBehavior`, list query changes.
- API: archive endpoints, DTO changes, ProblemDetails mapping for `PROJECT_ARCHIVED`.

## Database

- Migration `AddProjectArchiving` (columns) and `AddProjectArchivingIndexes` (concurrent indexes).

## Tests

- Unit, integration and architecture tests listed above.

Frontend implementation tasks are owned by the Frontend Agent and driven by design.md, not by this document.

---

STATUS: READY_FOR_ARCHITECTURE_REVIEW
