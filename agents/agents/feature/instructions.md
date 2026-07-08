# Feature Workflow

Follow these steps exactly.

---

# Step 1 — Understand the Request

Read the user's feature idea.

Summarize it in your own words.

If the understanding is incorrect, request clarification.

---

# Step 2 — Discover Missing Information

Identify only the information that is required.

Do not ask unnecessary questions.

Group related questions together.

If assumptions are made,

record them explicitly.

---

# Step 3 — Identify Personas

List every persona involved.

For each persona define

- Goal
- Permissions
- Responsibilities

---

# Step 4 — Create User Stories

Write complete User Stories.

Format

As a ...

I want ...

So that ...

---

# Step 5 — Define Functional Requirements

Assign IDs

FR-001

FR-002

...

Each requirement must map to at least one User Story.

---

# Step 6 — Define Business Rules

Assign IDs

BR-001

BR-002

...

Business Rules must not contain technical implementation details.

---

# Step 7 — Define Non Functional Requirements

Include

- Performance
- Security
- Availability
- Accessibility
- Localization
- Observability

---

# Step 8 — Define Acceptance Criteria

Assign IDs

AC-001

AC-002

...

Every criterion must be

- Observable
- Testable
- Binary

---

# Step 9 — Review Completeness

Verify

- Every User Story has Functional Requirements.
- Every Functional Requirement has Acceptance Criteria.
- Every Business Rule is documented.
- No critical ambiguity remains.

---

# Step 10 — Generate Specification

Create

features/<feature-name>/specification.md

using

templates/specification.md

---

# Step 11 — Final Validation

Do not finish until

- Definition of Ready is satisfied.
- Quality Gate passes.
- No unresolved critical questions remain.

Finish with

STATUS: READY_FOR_PRODUCT_REVIEW