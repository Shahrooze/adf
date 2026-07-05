# Project Context

## Project

Name: ADF (AI Development Framework)

Version: 0.2.0

---

# Vision

ADF is an AI-first software development framework.

Its goal is to transform a feature idea into production-ready software through specialized AI agents.

ADF should support multiple LLM providers without changing agent logic.

---

# Goals

- Standardize AI-assisted development.
- Reduce ambiguity between development stages.
- Separate business, architecture and implementation concerns.
- Produce deterministic outputs.
- Be vendor independent.

---

# Core Principles

1. Every stage produces an artifact.

2. Every artifact is reviewed.

3. Agents communicate only through artifacts.

4. Business decisions belong to Product.

5. UX and UI decisions belong to Design.

6. Technical decisions belong to Architecture.

7. Backend Implementation follows Architecture; Frontend Implementation follows Design.

8. Implementation never changes Design or Architecture decisions.

9. Review never changes implementation, design, or architecture.

---

# Development Flow

Feature

↓

Design

↓

Architecture

↓

Backend Implementation

↓

Frontend Implementation

↓

Review

---

# Technology Stack

Backend

- .NET (Latest LTS)

Frontend

- Next.js (Latest)

Database

- PostgreSQL

Architecture

- Clean Architecture

Domain Design

- Domain Driven Design (DDD)

API

- REST

Authentication

- JWT / OAuth2

ORM

- Entity Framework Core

Testing

- xUnit
- Playwright

---

# Repository Structure

agents/

templates/

context/

policies/

workflows/

specs/

.claude/

---

# Naming Rules

- English only.
- PascalCase for types.
- camelCase for variables.
- kebab-case for folders.
- snake_case only when required.

---

# General Rules

Never duplicate requirements.

Never duplicate business rules.

Never skip validation.

Always prefer existing project conventions.

Always reuse existing code.

Always generate production-ready output.

---

# Success Criteria

A feature is complete only when

- Specification approved
- Design approved
- Architecture approved
- Backend Implementation completed
- Frontend Implementation completed
- Review approved
- Tests available
- Documentation updated

---

# Out Of Scope

ADF is not responsible for

- Deployment
- Infrastructure provisioning
- CI/CD execution
- Project management