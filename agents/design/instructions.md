# Design Workflow

Follow these steps in order.

## Rework Mode

If the task contains a "Rework request" section (injected by the runtime after a reviewer returned CHANGES_REQUIRED/REJECTED, or a human rejected this stage), update your existing design.md in place instead of starting over:

- Resolve every blocking finding in the named review artifact that falls within your scope; never re-litigate or silently skip one.
- List findings outside your scope as such, naming the owning stage, without fixing them.
- Record what changed, per finding ID, in a "Rework Log" section of design.md, before the final STATUS line.
- Never edit the review artifact itself. Then re-run Steps 13 and 14.

## Step 1 - Validate Inputs and Status

Verify specification.md and product-review.md exist; if either is missing, stop immediately. Continue only if product-review.md contains `STATUS: READY_FOR_DESIGN`; otherwise stop and explain why.

## Step 2 - Read Context

Load context/project.md, context/design-system.md, policies/design.md, policies/accessibility.md, policies/frontend.md, templates/design.md. Pay particular attention to accessibility policy and existing design tokens.

## Step 3 - Map Requirements to Screens

For every Functional Requirement and User Story, identify which screen(s) satisfy it. No Functional Requirement may be left without a screen.

## Step 4 - Define User Journey and User Flow

Describe the end-to-end journey per persona, and the step-by-step flow through screens for each primary task.

## Step 5 - Define Screens and Navigation

For every screen define Purpose, Entry points, Exit points and Navigation relationships.

## Step 6 - Define Component Hierarchy

Break every screen into components, reusing existing components before introducing new ones.

## Step 7 - Define Forms and Validation Rules

For every form define Fields, Field-level validation and Submission behavior. Validation Rules must not contradict the specification's Validation Rules or Business Rules.

## Step 8 - Define States

For every data-driven screen define Loading, Empty, Error and Success States. No data-driven screen may skip a state.

## Step 9 - Define Responsive Behavior

Describe behavior across at least Mobile, Tablet and Desktop.

## Step 10 - Define Accessibility

Per policies/accessibility.md, document per screen at minimum: keyboard navigability, focus order, color contrast expectations, screen reader labeling for non-text elements.

## Step 11 - Define Design Tokens

Define or reuse color roles, typography, spacing, radius and elevation/shadow scales. Tokens must map cleanly onto the frontend styling system defined in context/tech-stack.md.

## Step 12 - Record Interaction Notes and Open Questions

Document micro-interactions (transitions, animations, feedback). Record any unresolved UX question explicitly and mark blocking questions clearly.

## Step 13 - Generate Design Document

Create features/<feature-name>/design.md using templates/design.md. Do not copy or re-summarize specification.md's Business Goal, Personas or User Stories; reference them by ID (e.g. FR-001, US-1).

Do not finish until every Completion condition in system.md holds and no blocking Open UX Question remains unresolved. Finish with

STATUS: READY_FOR_ARCHITECTURE

## Step 14 - Sync ADF Core

Run `node adf-core/cli.mjs sync <feature-name>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
