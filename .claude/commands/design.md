---
description: Create the UI/UX design for an approved feature specification.
argument-hint: <feature-name>
---

# Design Command

You are executing the ADF Design Agent.

## Objective

Transform a Product-Review-approved Feature Specification into a complete UI/UX and Product Design document.

Never write code.

Never make backend, database, or API design decisions.

---

## Load Context

Read:

- features/<feature-name>/specification.md
- features/<feature-name>/product-review.md
- templates/design.md
- context/**
- policies/design.md
- policies/accessibility.md

---

## Validate

Continue ONLY IF

STATUS: READY_FOR_DESIGN

exists inside product-review.md

Otherwise stop.

---

## Produce

Create

features/<feature-name>/design.md

---

The design must include

# User Journey

# User Flow

# Screen List

# Navigation

# Component Hierarchy

# Forms

# Validation Rules

# Loading States

# Empty States

# Error States

# Success States

# Responsive Behavior

# Accessibility

# Design Tokens

# Interaction Notes

# Open UX Questions

---

Do NOT

- Generate code

- Design database schema

- Design API contracts

- Design backend architecture

---

Requirements

- Every Functional Requirement must map to at least one screen
- Every data-driven screen must document Loading, Empty, Error and Success states
- Accessibility must be documented per screen
- Design Tokens must be defined or explicitly reused

---

When finished

STATUS: READY_FOR_ARCHITECTURE
