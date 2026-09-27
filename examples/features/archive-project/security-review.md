# Security Review Report

> Status: Complete

---

# Metadata

- Feature: FEAT-001-archive-project
- Reviewer: Security Review Agent
- Date: 2026-09-24

---

# Summary

The feature adds two authenticated, owner-only endpoints and a read-only rule enforced server-side on every project write. Authorization is object-level (per project membership), non-members cannot enumerate projects, no secrets are introduced, and inputs are strongly typed. One Medium and one Low finding; neither blocks the Security Gate.

---

# Overall Result

APPROVED_WITH_COMMENTS

---

# Findings

| ID | Severity | Category | Description | Recommendation |
|----|----------|----------|-------------|----------------|
| SEC-001 | Medium | API Security | PUT/DELETE archive are not covered by the existing per-user write rate limit policy (`writes-per-user`), so a scripted client could toggle archive state rapidly and flood the audit log. | Apply the existing `writes-per-user` rate-limit policy to both archive endpoints. |
| SEC-002 | Low | Security Logging | Warning logs on 403/409 include `userId` and `projectId` (acceptable), but the log template also includes the project `name`, which may contain customer-confidential text. | Drop `name` from the refusal log template; ids are sufficient for investigation. |

---

# Authentication Review

Observations

- Both new endpoints and the modified list/detail endpoints sit in the existing `RequireAuthorization()` route group; JWT bearer validation (issuer, audience, lifetime, signing key) is unchanged.
- Unauthenticated requests return 401 (verified by `ProjectArchiveEndpointTests`).

---

# Authorization Review

Observations (include object-level / IDOR checks)

- Object-level: the `ProjectOwner` policy resolves the caller's role for the specific `projectId` from `project_members`; ownership of another project grants nothing (IDOR test present).
- Non-members receive 404, Editors/Viewers 403 (BR-001); the project state is verified unchanged in both cases.
- Read-only rule (BR-002) is enforced in the application pipeline for all task, comment and project write commands; the architecture test prevents new commands from bypassing it.
- The Archived list is scoped by membership in the query itself; `status` cannot widen the result set.
- Frontend hiding of controls is cosmetic only; the server is authoritative.

---

# Secret Management Review

Observations

- No new secrets, keys or connection strings. No configuration changes. No secrets in the client bundle.

---

# OWASP Top 10 Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Broken Access Control | Pass | Object-level owner check; 404 for non-members; server-side read-only guard. |
| Cryptographic Failures | N/A | No new sensitive data stored or transmitted. |
| Injection | Pass | EF Core parameterized queries; `status` bound to enum; ids typed `Guid`. |
| Insecure Design | Pass | Idempotent state changes; concurrency handled with row locks. |
| Security Misconfiguration | Pass | ProblemDetails without stack traces; no new CORS or headers. |
| Vulnerable and Outdated Components | Pass | No new packages added (backend or frontend). |
| Identification and Authentication Failures | Pass | Existing JWT pipeline unchanged. |
| Software and Data Integrity Failures | Pass | Audit log written in the same transaction as the state change. |
| Security Logging and Monitoring Failures | Pass with comment | Audit entries present; see SEC-002. |
| Server-Side Request Forgery (SSRF) | N/A | No outbound calls. |

---

# API Security Review

Observations (rate limiting, transport security, error responses)

- Rate limiting: see SEC-001.
- Transport: HTTPS-only via existing ingress; HSTS unchanged.
- Error responses use the shared ProblemDetails shape with codes `NOT_PROJECT_OWNER`, `PROJECT_ARCHIVED`, `PROJECT_NOT_FOUND`; no internals leak.

---

# Input Validation Review

Observations (backend and frontend)

- Backend: route `projectId` is `Guid`-constrained; `status` validated by `ListProjectsQueryValidator`; `pageSize` capped at 100.
- Frontend: invalid `?status=` values fall back to Active (DV-001); the value is never interpolated into HTML.

---

# Sensitive Data Exposure Review

Observations (responses, logs, client bundle)

- `archivedBy` exposes `id` and `displayName` only, both already visible to project members; no email.
- Logs: see SEC-002. Audit entries contain ids and timestamps only.
- Client bundle: no new environment variables or tokens.

---

# Positive Observations

- 404-for-non-members consistently prevents project enumeration.
- Server-side enforcement is tested route-by-route, not assumed.

---

# Recommendations

- Apply SEC-001 and SEC-002 before release or as an immediate follow-up; both are one-line changes.

---

# Final Checklist

- [x] Authentication Reviewed
- [x] Authorization Reviewed
- [x] Secret Management Reviewed
- [x] OWASP Top 10 Reviewed
- [x] API Security Reviewed
- [x] Input Validation Reviewed
- [x] Sensitive Data Exposure Reviewed
- [x] Findings Prioritized

---

STATUS: READY_FOR_OPERATIONS_REVIEW
