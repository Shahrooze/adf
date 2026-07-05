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

Specification must contain

STATUS: READY_FOR_DESIGN

Design must contain

STATUS: READY_FOR_ARCHITECTURE

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

---

## Step 7

Verify

Architecture completeness.

Finish with

STATUS: READY_FOR_BACKEND