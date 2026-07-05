# Frontend Policy

## General Principles

Follow design.md exactly. Never redesign UX during implementation.

Prefer existing components, hooks, and utilities over new ones.

Keep components small and focused on a single responsibility.

---

# Structure

Organize by feature/route, colocating components, hooks and tests for that feature.

Keep shared/reusable components separate from feature-specific ones.

---

# State Management

Prefer server state tools (e.g. TanStack Query) for data fetched from APIs.

Prefer local component state for UI-only state (open/closed, active tab).

Avoid global state unless the state is genuinely cross-cutting.

---

# Forms and Validation

Implement client-side validation exactly as documented in design.md.

Client-side validation never replaces server-side validation — treat it as a UX improvement only.

Always surface server validation errors returned by the API.

---

# API Consumption

Consume APIs exactly as documented in architecture.md and backend-implementation-report.md.

Never invent an endpoint, field, or response shape that is not documented.

Handle every documented error response explicitly.

If a required contract is missing or ambiguous, stop and report the gap instead of guessing.

---

# Styling

Use the project's styling system and Design Tokens exclusively.

Never hardcode colors, spacing, or typography values that a token already covers.

---

# Performance

Avoid

- Unnecessary re-renders
- Unbounded client-side lists without virtualization or pagination
- Large unoptimized assets
- Blocking the main thread with heavy synchronous work

---

# Accessibility

Follow policies/accessibility.md for every component and screen.

---

# Testing

Generate tests for

- Component rendering
- Form validation
- Mocked API integration
- Acceptance Criteria relevant to the UI

---

# AI Rules

The Frontend Agent must never

- Modify backend source code
- Change an API contract
- Invent a screen, component, or flow not present in design.md
- Skip a documented Loading, Empty, Error or Success state
