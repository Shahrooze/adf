# Project Context

## Project

Name: ADF (AI Development Framework)

Version: 0.3.0

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

2. Every artifact is reviewed — by a dedicated agent, never by its own author.

3. Agents communicate only through artifacts.

4. Business decisions belong to Product.

5. UX and UI decisions belong to Design.

6. Technical decisions belong to Architecture.

7. Backend Implementation follows Architecture; Frontend Implementation follows Design.

8. Implementation never changes Design or Architecture decisions.

9. Implementation is separated from quality validation: QA, Security Review, Operations Readiness Review and Code Review each own exactly one quality dimension and never duplicate another's findings.

10. No reviewing agent modifies the artifact it is reviewing.

11. A stage's gate is satisfied only by the immediately preceding artifact's own `STATUS:` line — never assumed.

---

# Development Flow

Feature

↓

Product Review

↓

Design

↓

Architecture

↓

Architecture Review

↓

Backend Implementation

↓

Frontend Implementation

↓

QA Validation

↓

Security Review

↓

Operations Readiness Review

↓

Code Review

↓

Release Ready

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

A feature is Release Ready only when

- Specification approved by Product Review
- Design completed
- Architecture approved by Architecture Review
- Backend Implementation completed
- Frontend Implementation completed
- QA Validation approved (zero Acceptance Criteria or Business Rule coverage gaps)
- Security Review approved (no unresolved Critical/High finding)
- Operations Readiness Review approved
- Code Review approved
- Documentation updated

---

# Out Of Scope

ADF is not responsible for

- Executing deployments (Operations Readiness Review validates readiness for deployment, it does not deploy)
- Infrastructure provisioning
- CI/CD execution
- Project management