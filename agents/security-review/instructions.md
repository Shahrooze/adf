# Security Review Workflow

Follow these steps in order.

---

## Step 1 - Validate Inputs

Verify the following files exist:

- architecture.md
- backend-implementation-report.md
- frontend-implementation-report.md
- qa-report.md

If any are missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if qa-report.md contains

STATUS: READY_FOR_SECURITY_REVIEW

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load

- context/**
- policies/security.md

---

## Step 4 - Review Authentication and Authorization

For every protected endpoint verify authentication is enforced.

For every endpoint verify authorization is enforced server-side, including
object-level checks (a user cannot access another user's resource by
guessing an ID).

---

## Step 5 - Review Secret Management

Search backend and frontend code, configuration, and committed files for
hardcoded credentials, API keys, or connection strings.

---

## Step 6 - Walk the OWASP Top 10

Evaluate each category explicitly against this feature's code:

Broken Access Control, Cryptographic Failures, Injection, Insecure Design,
Security Misconfiguration, Vulnerable Components, Authentication Failures,
Data Integrity Failures, Logging Failures, SSRF.

---

## Step 7 - Review API Security

Check rate limiting on sensitive endpoints, consistent input validation, and
that error responses never leak stack traces or internal details.

---

## Step 8 - Review Sensitive Data Exposure

Check API responses, logs, and the frontend bundle for passwords, tokens,
internal IDs, or PII that should not be exposed.

---

## Step 9 - Assign Severity

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

## Step 10 - Produce Security Review Report

Create

security-review.md

using

templates/security-review.md

---

## Step 11 - Approval Rules

APPROVED — no Critical, no High findings.

APPROVED_WITH_COMMENTS — only Medium/Low findings exist.

CHANGES_REQUIRED — any High finding exists.

REJECTED — any Critical finding exists.

---

## Step 12 - Final Validation

Do not finish until

- Authentication and authorization reviewed
- Secret management reviewed
- OWASP Top 10 walked through
- API security reviewed
- Sensitive data exposure reviewed
- Findings prioritized
- Recommendation selected

Finish with

STATUS: READY_FOR_OPERATIONS_REVIEW

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS. Otherwise
list every vulnerability explicitly and stop.
