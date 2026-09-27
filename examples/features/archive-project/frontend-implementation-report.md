# Implementation Report

> Status: Complete

---

# Metadata

- Feature: FEAT-001-archive-project
- Layer: Frontend
- Version: 1.0
- Author: Frontend Agent
- Date: 2026-09-22

---

# Summary

Implements SCR-001 to SCR-004 from design.md in the Next.js 16 App Router frontend, using shadcn/ui primitives, TanStack Query and the API contracts in backend-implementation-report.md (Technical Notes). No UX decision was added beyond design.md.

---

# Scope

Implemented

- SCR-001 Active/Archived filter (FORM-001, DV-001) with URL state and ArchivedBadge.
- SCR-002 ArchivedBanner, read-only mode for header, tasks and comments, 409 handling.
- SCR-003 ArchiveProjectSection (Owner only).
- SCR-004 ArchiveProjectDialog (FORM-002, DV-002).
- All Loading, Empty, Error and Success states, responsive behavior and accessibility from design.md.

Not Implemented

- Archived count badge (Non-Blocking Open UX Question, deferred by Design).

---

# Files Created

| File | Description |
|------|-------------|
| src/frontend/components/projects/ProjectStatusFilter.tsx | shadcn Tabs bound to `?status=` (DV-001). |
| src/frontend/components/projects/ArchivedBadge.tsx | "Archived" Badge (secondary). |
| src/frontend/components/projects/ArchivedBanner.tsx | Alert with archive info and Owner-only Unarchive. |
| src/frontend/components/projects/ArchiveProjectSection.tsx | Settings card with Archive/Unarchive button. |
| src/frontend/components/projects/ArchiveProjectDialog.tsx | AlertDialog, initial focus Cancel. |
| src/frontend/components/projects/ArchivedProjectsEmptyState.tsx | EC-001 empty state. |
| src/frontend/hooks/useArchiveProject.ts | TanStack mutations for PUT/DELETE archive + cache invalidation. |
| src/frontend/lib/format/formatArchivedDate.ts | Date-only, viewer locale and time zone (Intl.DateTimeFormat). |
| tests/frontend/components/archive-project.ct.spec.tsx | Playwright component tests. |
| tests/frontend/e2e/archive-project.spec.ts | Playwright end-to-end tests (Flows A, B, C). |

---

# Files Modified

| File | Reason |
|------|--------|
| src/frontend/app/(app)/projects/page.tsx | Read `status` search param; render filter, badge, empty state. |
| src/frontend/app/(app)/projects/[projectId]/page.tsx | Banner and `readOnly` propagation. |
| src/frontend/app/(app)/projects/[projectId]/settings/page.tsx | Add ArchiveProjectSection; settings fields read-only when archived. |
| src/frontend/components/projects/ProjectHeader.tsx | Hide edit controls when `readOnly`. |
| src/frontend/components/tasks/TaskList.tsx | `readOnly` prop hides add/edit/delete. |
| src/frontend/components/comments/CommentThread.tsx | Hide composer when `readOnly`. |
| src/frontend/lib/api/projects.ts | `archiveProject`, `unarchiveProject`, `listProjects({ status })`, new response fields. |
| src/frontend/hooks/useProjectPermissions.ts | Derive `readOnly` from `status` and `canArchive` from `role`. |
| src/frontend/lib/api/errors.ts | Map `PROJECT_ARCHIVED`, `NOT_PROJECT_OWNER` to design.md copy. |
| src/frontend/messages/en.json | New translatable strings (NFR-006). |

---

# Acceptance Criteria Coverage

| ID | Status | Notes |
|----|--------|-------|
| AC-001 | Covered | Confirm → navigate to SCR-002 with banner; project absent from Active list. |
| AC-002 | Covered | Cancel closes dialog; no request sent. |
| AC-003 | Covered | Unarchive from banner and from SCR-003; controls return. |
| AC-004 | Covered | Default tab Active renders `status=active` results. |
| AC-005 | Covered | Archived tab lists archived projects with ArchivedBadge. |
| AC-006 | Covered (UI) | Archive section and banner button rendered only when `role === "owner"`. Server refusal: Backend. |
| AC-007 | Covered (UI) | No edit/create/delete controls when archived; 409 shows toast and switches to read-only. |
| AC-008 | Covered | Banner "Archived by {displayName} on {date}"; null user → "a former member". |
| AC-009 | N/A (Frontend) | Data preservation is backend (see backend report). |
| AC-010 | Covered (UI) | Button disabled while pending (DV-002); repeat success shows unchanged banner. |
| AC-011 | Covered | Archived project opens read-only with tasks and comments visible. |

---

# Business Rules Coverage

| Rule | Status | Notes |
|------|--------|-------|
| BR-001 | Covered (UI) | Controls hidden for non-owners; server is authoritative. |
| BR-002 | Covered (UI) | `readOnly` mode everywhere on SCR-002/SCR-003. |
| BR-003 | N/A (Frontend) | Backend responsibility. |
| BR-004 | Covered (UI) | Double-submit prevented; repeat response handled as success. |
| BR-005 | Covered | Archived projects remain openable by all members. |

---

# Tests

## Unit Tests

- `formatArchivedDate`: 4 cases (en-US, de-DE, time zone boundary, null user).

## Integration Tests

- Playwright component tests (`archive-project.ct.spec.tsx`): 11 tests covering filter URL sync and fallback, badge, empty/loading/error states, dialog focus trap and Escape, banner variants, owner vs. member rendering.
- Playwright e2e (`archive-project.spec.ts`): Flow A, Flow B, Flow C, EC-004 (409 while editing), EC-005 deep link; runs against the API with a seeded PostgreSQL container.

## Manual Verification

- Checked mobile (375 px), tablet (768 px) and desktop (1280 px) layouts against Responsive Behavior.
- Keyboard-only and NVDA pass on all four screens; axe reports 0 violations.

---

# Technical Notes

- All calls use the contracts in backend-implementation-report.md Technical Notes; no other endpoints or fields are used.
- After archive/unarchive, the `["projects"]` and `["project", id]` query keys are invalidated so the list and detail stay consistent.
- `readOnly` is derived from `project.status === "archived"` in one place (`useProjectPermissions`) and passed down as a prop.

---

# Known Limitations

- If another user archives a project while it is open, the page switches to read-only only on the next refetch or refused write (EC-004 behavior per design.md).

---

# Future Improvements

- Archived count badge on the filter tab (deferred Open UX Question).

---

# Risks

- Low: new write controls added later must respect `readOnly`; server-side 409 remains the backstop.

---

# Completion Checklist

- [x] Code Compiles
- [x] Tests Pass
- [x] Acceptance Criteria Covered
- [x] Business Rules Covered
- [x] Documentation Updated

---

STATUS: READY_FOR_QA
