# Design Workflow

Follow these steps in order.

---

## Step 1 - Validate Inputs

Verify specification.md and product-review.md exist.

If either is missing, stop immediately.

---

## Step 2 - Validate Status

Continue only if product-review.md contains

STATUS: READY_FOR_DESIGN

Otherwise stop and explain why.

---

## Step 3 - Read Context

Load

- context/project.md
- context/design-system.md
- policies/design.md
- policies/accessibility.md
- policies/frontend.md
- templates/design.md

Pay particular attention to accessibility policy and existing design tokens.

---

## Step 4 - Map Requirements to Screens

For every Functional Requirement and User Story, identify which screen(s) satisfy it.

No Functional Requirement may be left without a screen.

---

## Step 5 - Define User Journey and User Flow

Describe the end-to-end journey per persona.

Describe the step-by-step flow through screens for each primary task.

---

## Step 6 - Define Screens and Navigation

For every screen define

- Purpose
- Entry points
- Exit points
- Navigation relationships

---

## Step 7 - Define Component Hierarchy

Break every screen into components.

Reuse existing components before introducing new ones.

---

## Step 8 - Define Forms and Validation Rules

For every form define

- Fields
- Field-level validation
- Submission behavior

Validation Rules must not contradict the specification's Validation Rules or Business Rules.

---

## Step 9 - Define States

For every data-driven screen define

- Loading State
- Empty State
- Error State
- Success State

No data-driven screen may skip a state.

---

## Step 10 - Define Responsive Behavior

Describe behavior across at least

- Mobile
- Tablet
- Desktop

---

## Step 11 - Define Accessibility

Follow policies/accessibility.md.

Document, per screen

- Keyboard navigability
- Focus order
- Color contrast
- Screen reader labeling

---

## Step 12 - Define Design Tokens

Define or reuse

- Color roles
- Typography scale
- Spacing scale
- Radius scale
- Elevation/shadow scale

---

## Step 13 - Record Interaction Notes and Open Questions

Document micro-interactions (transitions, animations, feedback).

Record any unresolved UX question explicitly. Mark blocking questions clearly.

---

## Step 14 - Generate Design Document

Create

features/<feature-name>/design.md

using

templates/design.md

Do not copy or re-summarize specification.md's Business Goal, Personas or
User Stories. Reference them by ID (e.g. FR-001, US-1) instead of restating
their content.

---

## Step 15 - Final Validation

Do not finish until

- Every Functional Requirement maps to a screen.
- Every data-driven screen has all four states.
- Accessibility is documented for every screen.
- Design Tokens are defined or reused.
- No blocking Open UX Question remains unresolved.

Finish with

STATUS: READY_FOR_ARCHITECTURE

---

## Step 16 - Sync ADF Core

Run

node adf-core/cli.mjs sync <feature-name>

This regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, and
DEPENDENCY-GRAPH.md, and validates the repository scoped to this feature.
Must complete with no errors before this stage's gate can be considered
satisfied.
