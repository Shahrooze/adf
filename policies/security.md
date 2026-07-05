# Security Policy

## Input Validation

Validate every external input.

Never trust client data.

---

# Authentication

Authentication is mandatory for protected endpoints.

---

# Authorization

Always enforce authorization at the API boundary.

Never rely only on frontend checks.

---

# Secrets

Never hardcode

- Passwords
- API Keys
- Tokens
- Connection Strings

Use configuration providers.

---

# Database

Always use parameterized queries.

Never concatenate SQL.

---

# Sensitive Data

Never expose

- Passwords
- Tokens
- Internal IDs
- Stack traces

---

# Logging

Never log secrets.

Mask sensitive information.

---

# File Uploads

Validate

- Size
- Extension
- MIME Type

---

# AI Rules

Agents must never generate insecure sample code.