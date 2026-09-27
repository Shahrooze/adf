# Security Review Workflow

Follow these steps in order.

## Step 1 - Validate Inputs and Status

Verify architecture.md, backend-implementation-report.md, frontend-implementation-report.md and qa-report.md exist; if any are missing, stop immediately. Continue only if qa-report.md contains `STATUS: READY_FOR_SECURITY_REVIEW`; otherwise stop and explain why.

## Step 2 - Read Context

Load context/tech-stack.md and policies/security.md.

## Step 3 - Review Authentication and Authorization

For every protected endpoint verify authentication is enforced and tokens are validated correctly (signature, expiry, audience). For every endpoint verify authorization is enforced server-side at the API boundary, independent of any frontend check, including object-level checks (a user cannot access another user's resource by guessing an ID — IDOR).

## Step 4 - Review Secret Management

Search backend and frontend code, configuration, committed files and logs for hardcoded passwords, credentials, API keys, tokens or connection strings.

## Step 5 - Walk the OWASP Top 10

Evaluate each category explicitly against this feature's code: Broken Access Control, Cryptographic Failures, Injection, Insecure Design, Security Misconfiguration, Vulnerable Components, Authentication Failures, Data Integrity Failures, Logging Failures, SSRF.

## Step 6 - Review API Security

Check rate limiting on sensitive endpoints, transport security (HTTPS assumed), consistent input validation on backend and frontend, and that error responses never leak stack traces or internal details.

## Step 7 - Review Sensitive Data Exposure

Check API responses, logs, and the frontend bundle for passwords, tokens, internal IDs, or PII that should not be exposed.

## Step 8 - Produce Report

Record findings as defined in system.md (Findings) and create security-review.md using templates/security-review.md.

## Step 9 - Approval Rules

- APPROVED — no Critical, no High findings.
- APPROVED_WITH_COMMENTS — only Medium/Low findings exist.
- CHANGES_REQUIRED — any High finding exists.
- REJECTED — any Critical finding exists.

## Step 10 - Final Validation

Do not finish until Steps 3–9 are complete, findings are prioritized and a recommendation is selected. List every vulnerability explicitly. End security-review.md with the STATUS line mapped from the recommendation (system.md): `STATUS: READY_FOR_OPERATIONS_REVIEW`, `STATUS: CHANGES_REQUIRED` or `STATUS: REJECTED`.

## Step 11 - Sync ADF Core

Run `node adf-core/cli.mjs sync FEAT-<NNN>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
