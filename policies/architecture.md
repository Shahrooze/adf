# Architecture Policy

## Architecture

Default architecture is

- Clean Architecture

---

# Layers

Domain

Application

Infrastructure

Presentation

---

# Rules

Dependencies always point inward.

Domain must not depend on Infrastructure.

Presentation must not contain business logic.

---

# Domain

Business rules belong only in the Domain/Application layer.

---

# API

Prefer REST.

Keep endpoints resource-oriented.

---

# Database

Database is an implementation detail.

Never expose EF entities directly.

---

# Dependency Injection

Always use constructor injection.

---

# Events

Prefer Domain Events for business workflows.

---

# AI Rules

Never violate layer boundaries.

Never place business logic in controllers.