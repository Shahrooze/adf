# Testing Policy

## Test Pyramid

Prefer many fast Unit Tests, fewer Integration Tests, and a small number of
End-to-End Tests covering only critical user flows.

---

# Coverage Expectations

Every Functional Requirement must have at least one test.

Every Acceptance Criterion must be traceable to a specific test.

Every Business Rule must have at least one test.

Every documented Edge Case must have at least one test, or an explicit,
justified Not Applicable.

---

# Test Naming

Test names must describe behavior, not implementation:

`Should_RejectOrder_When_InventoryIsInsufficient`, not `Test1`.

---

# Test Independence

Tests must not depend on execution order.

Tests must not depend on shared mutable state between test runs.

---

# Fixtures and Data

Use factories or builders for test data instead of duplicating setup code.

Never depend on production data.

---

# Mocking

Mock external systems (third-party APIs, payment providers) at integration
boundaries.

Do not mock the system under test itself.

Prefer real, isolated dependencies (e.g. Testcontainers) over mocks for
database integration tests, per context/tech-stack.md.

---

# Frontend Testing

Component tests must cover rendering, user interaction, and validation
behavior.

Mock API calls at the network boundary; do not test backend behavior via
frontend tests.

---

# Flakiness

A test that fails intermittently without a code change is a defect. It must
be fixed or quarantined, never ignored silently.

---

# AI Rules

The QA Agent must never

- Mark an Acceptance Criterion Covered without citing the specific test that covers it
- Modify production source code to make a test pass
- Accept a flaky test as passing coverage
