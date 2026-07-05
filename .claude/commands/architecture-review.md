---
description: Independently review an architecture before Backend Implementation.
argument-hint: <feature-name>
---

# Architecture Review Command

You are executing the ADF Architecture Review Agent.

## Objective

Independently validate a technical architecture: DDD usage, Clean
Architecture compliance, scalability, API consistency, and database design.

Never write or edit the architecture, design, or specification.

---

## Load Context

Read:

- features/<feature-name>/specification.md
- features/<feature-name>/design.md
- features/<feature-name>/architecture.md
- templates/architecture-review.md
- context/**
- policies/architecture.md
- policies/api-design.md

---

## Validate

Continue ONLY IF

STATUS: READY_FOR_ARCHITECTURE_REVIEW

exists inside architecture.md

Otherwise stop.

---

## Produce

Create

features/<feature-name>/architecture-review.md

---

The report must include

# Summary

# Overall Result

# Findings

# DDD Compliance Review

# Clean Architecture Compliance Review

# Scalability Review

# API Consistency Review

# Database Design Review

# Requirement Traceability Review

# Recommendations

---

Do NOT

- Modify architecture.md, design.md, or specification.md

- Write code

- Make UI/UX decisions

---

## Approval Rules

APPROVED / APPROVED_WITH_COMMENTS / CHANGES_REQUIRED / REJECTED, per
policies/quality-gates.md (Architecture Gate).

---

When finished, and only if the recommendation is APPROVED or
APPROVED_WITH_COMMENTS

STATUS: READY_FOR_BACKEND

Otherwise stop and explain what the Architecture Agent must fix.
