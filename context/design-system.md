# Design System

This document is the single source of truth for this project's design
tokens — the values the Design Agent must express decisions in terms of,
and the values the Frontend Agent must not introduce anything outside of
(see `context/tech-stack.md` → Design, and `policies/design.md`).

Fill in each scale below as the project's visual language is established.
Until then, treat every section as `TBD` and default to the host UI
framework's own defaults (see `context/tech-stack.md` → Frontend) rather
than inventing ad hoc values.

---

# Color Roles

- Primary
- Secondary
- Accent
- Background
- Surface
- Border
- Destructive / Error
- Success
- Warning
- Muted / Foreground-muted

TBD — define the concrete value (hex/HSL or theme-config reference) for
each role above.

---

# Typography Scale

- Display
- Heading (H1–H6)
- Body
- Caption / Small

TBD — define font family, weight, size, and line-height for each step.

---

# Spacing Scale

TBD — define the spacing steps (e.g. a 4px/8px base scale) new UI must use
instead of arbitrary pixel values.

---

# Radius Scale

TBD — define the corner-radius steps (e.g. none / sm / md / lg / full).

---

# Elevation / Shadow Scale

TBD — define the shadow/elevation steps used to express layering.

---

# Governance

- Design Tokens map onto the styling system declared in
  `context/tech-stack.md` → Design.
- The Design Agent must express every token in terms that translate
  directly into that configuration.
- The Frontend Agent must not introduce values outside the scales defined
  above.
