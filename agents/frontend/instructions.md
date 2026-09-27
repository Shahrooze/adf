# Frontend Implementation Workflow

Follow these steps in order.

## Rework Mode

If the task contains a "Rework request" section (injected by the runtime after a reviewer returned CHANGES_REQUIRED/REJECTED, or a human rejected this stage), update your existing frontend code, tests and frontend-implementation-report.md in place instead of starting over:

- Resolve every blocking finding in the named review artifact that falls within your scope; never re-litigate or silently skip one.
- List findings outside your scope as such, naming the owning stage, without fixing them.
- Record what changed, per finding ID, in a "Rework Log" section of frontend-implementation-report.md, before the final STATUS line.
- Never edit the review artifact itself. Then re-run Steps 7–9.

## Step 1 - Validate Inputs

Verify specification.md, design.md, architecture.md and backend-implementation-report.md exist. If any is missing, stop immediately.

Quick-change exception: when the task says `Track: quick-change`, the only required upstream document is specification.md. Missing design, architecture and review documents are expected, and Backend and Frontend run in parallel, so do not wait for or require backend-implementation-report.md. None of these absences may stop you.

## Step 2 - Validate Status

Continue only if design.md contains `STATUS: READY_FOR_ARCHITECTURE` and backend-implementation-report.md contains `STATUS: READY_FOR_FRONTEND`. architecture.md is read for API contract details; its own gate (Architecture Review) has already passed by the time backend-implementation-report.md reaches this status.

Quick-change track: instead, continue only if specification.md contains `TRACK: QUICK_CHANGE` and `STATUS: READY_FOR_PRODUCT_REVIEW`. Follow the existing screen's patterns and context/design-system.md in place of design.md; take API contracts from specification.md and existing code (backend changes on this track are additive). If the change needs a new screen or a non-additive contract change, stop and report that it requires `TRACK: FULL`.

Otherwise stop and explain why.

## Step 3 - Read Context

Load context/tech-stack.md, context/design-system.md, policies/frontend.md, policies/accessibility.md, policies/coding.md, policies/testing.md. Pay particular attention to the frontend and accessibility policies and the project's frontend stack.

## Step 4 - Read Design and API Contracts

Read design.md in full (Screen List, Navigation, Component Hierarchy, Forms and Validation Rules, States, Responsive Behavior, Accessibility, Design Tokens, Interaction Notes), and architecture.md and backend-implementation-report.md for the exact API contracts. If design.md is ambiguous or incomplete for a screen, stop and report the gap.

## Step 5 - Create Implementation Plan

Before writing code, write a short plan: pages/components to create, files to modify, API integrations required, risks.

## Step 6 - Implement

In this order: 1. Design Tokens (if not already in the codebase), 2. Shared/reusable Components, 3. Pages, 4. Forms and Client-side Validation, 5. API integration, 6. Tests. Never skip a documented state (Loading, Empty, Error, Success). Never implement backend code.

## Step 7 - Self Review

Complete the Completion Checklist in system.md; also verify every screen matches design.md exactly and no UX decision was invented.

## Step 8 - Generate Report

Create `frontend-implementation-report.md` with: Summary, Files Created, Files Modified, Acceptance Criteria Coverage, Known Limitations, Follow-up Tasks. Do not restate architecture.md or design.md in the Summary; reference sections/IDs.

If this layer needs no change (possible on the quick-change track), still write the report, stating "No changes required in this layer" and why.

Finish with `STATUS: READY_FOR_QA`

## Step 9 - Sync ADF Core

Run `node adf-core/cli.mjs sync <feature-id>` (regenerates adf-core/registry.json, INDEX.md, CONTEXT.md, DEPENDENCY-GRAPH.md and validates this feature). It must pass with no errors before this stage's gate is satisfied.
