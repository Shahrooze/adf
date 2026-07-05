# Accessibility Policy

## Standard

Target WCAG 2.1 Level AA for every screen unless explicitly stated otherwise.

---

# Keyboard

Every interactive element must be reachable and operable by keyboard alone.

Focus order must follow a logical reading order.

Focus must never be trapped unintentionally.

Focus must be visible at all times.

---

# Screen Readers

Every non-text element (icon, image, chart) must have a text alternative.

Every form field must have a programmatically associated label.

Every dynamic update (toast, error, loading) must be announced.

---

# Color and Contrast

Text contrast ratio must meet or exceed 4.5:1 for normal text and 3:1 for large text.

Color must never be the only way to convey information (e.g. errors, status).

---

# Forms

Every validation error must be

- Announced to assistive technology
- Associated with its field
- Described in text, not only by color or icon

---

# Motion

Respect reduced-motion preferences.

Never rely on animation alone to convey required information.

---

# Structure

Use semantic HTML/structure before relying on ARIA attributes.

Use ARIA only to fill gaps that semantic elements cannot cover.

Heading levels must be sequential and reflect content hierarchy.

---

# Responsibilities

The Design Agent must document accessibility requirements per screen.

The Frontend Agent must implement every documented accessibility requirement exactly.

The Review Agent must verify accessibility compliance independently of visual review.

---

# AI Rules

Agents must never

- Ship a screen without a keyboard-accessible path
- Ship an icon-only control without an accessible name
- Rely solely on placeholder text as a field label
- Suppress focus outlines without providing an equivalent visible focus state
