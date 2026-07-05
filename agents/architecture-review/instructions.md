# Architecture Review Workflow

Follow these steps in order.

---

## Step 1 - Validate Inputs

Verify the following files exist:

- specification.md
- design.md
- architecture.md

If any are missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if architecture.md contains

STATUS: READY_FOR_ARCHITECTURE_REVIEW

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load

- context/**
- policies/architecture.md
- policies/api-design.md

---

## Step 4 - Review DDD and Clean Architecture

Verify

- Entities, Value Objects and Aggregates are modeled correctly
- Dependencies point inward
- Domain does not depend on Infrastructure
- Presentation contains no business logic

---

## Step 5 - Review Scalability

Identify expected load from specification.md's Non Functional Requirements.

Check for unaddressed bottlenecks: hot partitions, unbounded queries,
synchronous chains, missing caching where clearly warranted.

---

## Step 6 - Review API Consistency

Check the API design against policies/api-design.md:

- Resource naming
- Versioning
- Pagination
- Error format
- Status codes

Verify every screen in design.md that needs server data has a corresponding
endpoint.

---

## Step 7 - Review Database Design

Verify

- New/modified tables are appropriately normalized
- An indexing strategy exists for query patterns implied by the screens
- A migration strategy exists for any change to existing tables

---

## Step 8 - Review Traceability

Verify every Functional Requirement in specification.md is traceable inside
the architecture.

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

## Step 10 - Produce Architecture Review Report

Create

architecture-review.md

using

templates/architecture-review.md

---

## Step 11 - Approval Rules

APPROVED — no Critical, no High findings.

APPROVED_WITH_COMMENTS — only Medium/Low findings exist.

CHANGES_REQUIRED — any High finding exists.

REJECTED — any Critical finding exists.

---

## Step 12 - Final Validation

Do not finish until

- DDD and Clean Architecture reviewed
- Scalability reviewed
- API consistency reviewed
- Database design reviewed
- Traceability reviewed
- Findings prioritized
- Recommendation selected

Finish with

STATUS: READY_FOR_BACKEND

only if the recommendation is APPROVED or APPROVED_WITH_COMMENTS. Otherwise
explain what the Architecture Agent must fix and stop.
