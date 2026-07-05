# Design Policy

## UI Consistency

Always reuse existing components before creating new ones.

Always reuse existing Design Tokens before defining new ones.

Never introduce a one-off color, spacing, or typography value outside the token scale.

---

# Design Tokens

Design Tokens are the single source of truth for

- Color roles
- Typography scale
- Spacing scale
- Radius scale
- Elevation / shadow scale

Tokens must map onto the frontend styling system defined in context/tech-stack.md.

Never hardcode a value that a token already covers.

---

# Screens

Every screen must

- Map to at least one Functional Requirement
- Document Loading, Empty, Error and Success states if it is data-driven
- Document Responsive Behavior across Mobile, Tablet and Desktop

---

# Components

Prefer composition over duplication.

A new component is justified only when no existing component can satisfy the need.

Document new components explicitly in the Component Hierarchy.

---

# Forms

Every form field must have

- A defined type
- A defined validation rule
- A defined error message behavior

Client-side Validation Rules must never contradict the specification's Business Rules.

---

# Consistency Across Features

Before designing a new feature, review design.md files of related existing features.

Reuse established navigation patterns, layouts and interaction patterns whenever possible.

---

# AI Rules

The Design Agent must never

- Invent a screen not traceable to a Functional Requirement
- Skip a state (Loading, Empty, Error, Success) for a data-driven screen
- Define API contracts (this belongs to Architecture)
- Define database structures (this belongs to Architecture)
