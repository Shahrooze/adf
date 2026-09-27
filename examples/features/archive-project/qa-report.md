# QA Report

> Status: Complete

---

# Metadata

- Feature: FEAT-001-archive-project
- Reviewer: QA Agent
- Date: 2026-09-23

---

# Summary

Every Acceptance Criterion (AC-001 to AC-011) and every Business Rule (BR-001 to BR-005) is covered by at least one passing automated test, with server-side rules covered at the API level and UI behavior covered by Playwright. All eight Edge Cases are covered. Both implementation reports state that code compiles and tests pass; the full suite was re-run in CI (41 backend tests, 4 frontend unit tests and 16 Playwright tests, all green). Two Low findings remain.

---

# Overall Result

APPROVED_WITH_COMMENTS

---

# Findings

| ID | Severity | Category | Description | Recommendation |
|----|----------|----------|-------------|----------------|
| QA-001 | Low | Test Coverage | AC-010 is verified at the API level and the double-submit guard is verified in a component test, but no e2e test performs archive from two browser tabs (EC-002). | Add a two-context Playwright test; not blocking because both halves are covered. |
| QA-002 | Low | Test Coverage | NFR-001 latency targets are not asserted by any automated test. | Add a k6 smoke scenario for the list endpoint with 1,000 projects in the performance suite. |

---

# Acceptance Criteria Coverage Matrix

| ID | Covered / Gap / N-A | Test(s) | Notes |
|----|------------------------|---------|-------|
| AC-001 | Covered | e2e `Flow A: owner archives project`; `ProjectArchiveEndpointTests.Owner_archive_returns_204_and_hides_from_default_list` | |
| AC-002 | Covered | ct `dialog cancel sends no request`; e2e `Flow A: cancel keeps project active` | |
| AC-003 | Covered | e2e `Flow B: owner unarchives from banner`; `ProjectArchiveEndpointTests.Owner_unarchive_returns_204_and_allows_writes` | |
| AC-004 | Covered | `ProjectArchiveEndpointTests.List_defaults_to_active`; ct `filter defaults to Active` | |
| AC-005 | Covered | `ProjectArchiveEndpointTests.List_archived_returns_only_member_archived_projects`; e2e `Flow C` | |
| AC-006 | Covered | `ProjectArchiveEndpointTests.Editor_and_viewer_get_403_state_unchanged`; ct `member sees no archive controls` | UI and API. |
| AC-007 | Covered | `ArchivedProjectWriteGuardTests` (12 write routes → 409); ct `archived project renders read-only`; e2e `EC-004 refused edit` | UI and API. |
| AC-008 | Covered | ct `banner shows name and localized date`; `formatArchivedDate` unit tests | |
| AC-009 | Covered | `ArchivedProjectWriteGuardTests.Archive_unarchive_round_trip_preserves_content` | |
| AC-010 | Covered | `ProjectArchiveEndpointTests.Repeat_archive_is_204_and_metadata_unchanged`; ct `archive button disabled while pending` | See QA-001. |
| AC-011 | Covered | e2e `Flow C: member views archived project`; `ProjectArchiveEndpointTests.Member_can_read_archived_project` | |

---

# Business Rule Coverage Matrix

| Rule | Covered / Gap / N-A | Test(s) | Notes |
|------|------------------------|---------|-------|
| BR-001 | Covered | `ProjectArchiveEndpointTests.Editor_and_viewer_get_403_state_unchanged`; ct `member sees no archive controls` | |
| BR-002 | Covered | `ArchivedProjectWriteGuardTests`; `ProjectArchiveTests.EnsureWritable_throws_when_archived`; `ProjectScopedCommandTests` | Architecture test prevents future bypass. |
| BR-003 | Covered | `ArchivedProjectWriteGuardTests.Archive_unarchive_round_trip_preserves_content` | |
| BR-004 | Covered | `ProjectArchiveTests.Archive_twice_is_noop_and_raises_one_event`; `ProjectArchiveEndpointTests.Repeat_archive_is_204_and_metadata_unchanged` | |
| BR-005 | Covered | `ProjectArchiveEndpointTests.Member_can_read_archived_project`; e2e `Flow C` | |

---

# Edge Case Coverage Matrix

| Edge Case | Covered / Gap / N-A | Test(s) | Notes |
|-----------|------------------------|---------|-------|
| EC-001 | Covered | ct `archived filter empty state` | |
| EC-002 | Covered | ct `archive button disabled while pending`; API repeat test | QA-001. |
| EC-003 | Covered | `ProjectArchiveEndpointTests.Editor_and_viewer_get_403_state_unchanged` | |
| EC-004 | Covered | `ArchivedProjectWriteGuardTests.Concurrent_archive_and_task_update_serialize`; e2e `EC-004 refused edit` | |
| EC-005 | Covered | e2e `EC-005 deep link opens read-only` | |
| EC-006 | Covered | `ProjectArchiveEndpointTests.Deleted_project_returns_404` | |
| EC-007 | Covered | `ProjectArchiveEndpointTests.List_archived_is_paginated` | 250 seeded archived projects. |
| EC-008 | Covered | `ProjectArchiveEndpointTests.Archived_by_deleted_user_returns_null`; ct `banner former member` | |

---

# Test Plan

## Unit Tests

- `ProjectArchiveTests` (9), `ListProjectsQueryValidatorTests` (5), `formatArchivedDate` (4).

## Integration Tests

- `ProjectArchiveEndpointTests` (12), `ArchivedProjectWriteGuardTests` (14), `ProjectScopedCommandTests` (1), migration up/down against Testcontainers PostgreSQL 17.

## Component Tests (Frontend)

- `archive-project.ct.spec.tsx` (11): filter, badge, states, dialog focus, banner variants, owner vs. member.

## End-to-End Tests

- `archive-project.spec.ts` (5): Flow A, Flow B, Flow C, EC-004, EC-005.
- Proposed (QA-001): two-tab archive. Proposed (QA-002): k6 list latency smoke.

---

# Definition of Done

- [x] Code Compiles (Backend and Frontend)
- [x] All Tests Pass
- [x] Every Acceptance Criterion Covered or explicitly Not Applicable
- [x] Every Business Rule Covered or explicitly Not Applicable
- [x] No unresolved Gap

---

# Positive Observations

- Write-guard tests enumerate every write route rather than sampling one.
- Concurrency (EC-004) is tested against a real database, not mocked.

---

# Recommendations

- Address QA-001 and QA-002 in the next test-hardening pass.

---

# Final Checklist

- [x] Acceptance Criteria Coverage Reviewed
- [x] Business Rule Coverage Reviewed
- [x] Edge Case Coverage Reviewed
- [x] Test Plan Updated
- [x] Definition of Done Verified
- [x] Findings Prioritized

---

STATUS: READY_FOR_SECURITY_REVIEW
