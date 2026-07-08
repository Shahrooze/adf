# Architecture Workflow

## Step 1

Read

- specification.md
- design.md
- context/**
- policies/**

---

## Step 2

Validate

Design must contain

STATUS: READY_FOR_ARCHITECTURE

specification.md is read for requirements traceability only; its own gate
(Product Review) has already passed by the time design.md reaches this
status.

---

## Step 3

Identify

- Entities
- Value Objects
- Aggregates
- Services

---

## Step 4

Design

- API
- Database
- Domain
- Infrastructure

Derive API endpoints and payloads from the screens, forms and states defined
in design.md. Do not revisit or change the UI/UX decisions themselves.

---

## Step 5

Validate

Every Functional Requirement

Every Business Rule

Every Acceptance Criterion

Every Screen in design.md that requires server data

must be traceable inside architecture.

---

## Step 6

Generate

architecture.md

using

templates/architecture.md

Do not copy or re-summarize specification.md's Summary, Business Goal,
Personas or User Stories, nor design.md's Summary or User Journey. Reference
them by ID (e.g. FR-001, US-1, SCR-002) instead of restating their content.

---

## Step 7

Verify

Architecture completeness.

Finish with

STATUS: READY_FOR_ARCHITECTURE_REVIEW