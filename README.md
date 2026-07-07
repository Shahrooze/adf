ADF (AI Development Framework)

Build software with AI using a structured engineering workflow instead of ad-hoc prompts.

Overview

ADF (AI Development Framework) is an opinionated framework for AI-assisted software development.

Instead of asking an LLM to generate an entire application in a single prompt, ADF breaks software development into well-defined engineering stages. Each stage has a single responsibility, a dedicated AI agent, explicit inputs, and predictable outputs.

Implementation is strictly separated from quality validation: Backend and Frontend Implementation only build; QA, Security Review, Operations Readiness Review and Code Review each independently validate exactly one quality dimension.

The goal is to make AI-generated software more maintainable, reviewable, and production-ready.

⸻

Philosophy

ADF is built around one simple principle:

AI should participate in the software engineering process, not replace it.

Every stage produces an artifact.

Every artifact is reviewed by a dedicated agent — never by its own author.

Every decision is traceable.

No agent is allowed to change decisions made in previous stages.

⸻

Workflow

Idea
    │
    ▼
Feature Agent → specification.md
    │
    ▼
Product Review Agent → product-review.md
    │
    ▼
Design Agent → design.md
    │
    ▼
Architecture Agent → architecture.md
    │
    ▼
Architecture Review Agent → architecture-review.md
    │
    ▼
Backend Implementation Agent → backend-implementation-report.md
    │
    ▼
Frontend Implementation Agent → frontend-implementation-report.md
    │
    ▼
QA Agent → qa-report.md
    │
    ▼
Security Review Agent → security-review.md
    │
    ▼
Operations Readiness Review Agent → operations-readiness-report.md
    │
    ▼
Code Review Agent → code-review-report.md
    │
    ▼
Release Ready

⸻

Agents

Feature Agent

Responsible for:

* Product discovery
* Functional requirements
* Business rules
* Acceptance criteria
* Non-functional requirements

Output: specification.md

⸻

Product Review Agent

Independently validates the specification before Design begins. Never writes the specification.

Responsible for:

* Business goal clarity
* Requirement completeness
* Acceptance criteria quality
* Business rule consistency
* Ambiguity detection

Output: product-review.md

⸻

Design Agent

Responsible for:

* User journey and user flow
* Screen list and navigation
* Component hierarchy
* Forms and validation rules
* Loading, empty, error and success states
* Responsive behavior
* Accessibility
* Design tokens

Never makes backend, database, or API design decisions.

Output: design.md

⸻

Architecture Agent

Responsible for:

* Domain model
* API design
* Database design
* Security
* Performance
* Technical architecture

Never makes UI or UX decisions — those belong to the Design Agent.

Output: architecture.md

⸻

Architecture Review Agent

Independently validates the architecture before Backend Implementation begins. Never writes the architecture.

Responsible for:

* DDD compliance
* Clean Architecture compliance
* Scalability
* API consistency
* Database design

Output: architecture-review.md

⸻

Backend Implementation Agent

Responsible for:

* Implementing the approved architecture on the server side
* Writing production-ready backend code
* Exposing API contracts required by the Frontend Agent
* Generating backend tests
* Producing a backend implementation report

Never implements UI.

Output: Backend Source Code, backend-implementation-report.md

⸻

Frontend Implementation Agent

Responsible for:

* Implementing UI, pages, components and forms
* Implementing client-side validation
* Connecting to the APIs exposed by the Backend Agent
* Following design.md exactly
* Generating frontend tests
* Producing a frontend implementation report

Never redesigns UX. Never implements backend logic.

Output: Frontend Source Code, frontend-implementation-report.md

⸻

QA Agent

Independently validates test coverage and the Definition of Done. Never modifies production code.

Responsible for:

* Generating test scenarios
* Acceptance criteria coverage
* Business rule coverage
* Missing test case / edge case detection
* Test plan
* Definition of Done verification

Output: qa-report.md

⸻

Security Review Agent

Independently reviews for vulnerabilities. Never modifies code.

Responsible for:

* Authentication and authorization
* Secret management
* OWASP Top 10
* API security
* Input validation
* Sensitive data exposure

Output: security-review.md

⸻

Operations Readiness Review Agent

Independently validates production readiness. Never modifies implementation.

Responsible for:

* Logging, metrics, distributed tracing
* Health checks (readiness/liveness probes)
* Configuration and secrets management
* Retry, timeout and idempotency policies
* Rate limiting
* Performance and scalability
* Docker/Kubernetes readiness
* Monitoring and alerting readiness
* Deployment and rollback strategy

Output: operations-readiness-report.md

⸻

Code Review Agent

The final gate. Reviews only code quality — never re-validates correctness (QA), security (Security Review), or production readiness (Operations Readiness Review).

Responsible for:

* Maintainability
* Readability
* SOLID
* Clean Code
* Naming
* Duplication
* Complexity
* Best practices

Output: code-review-report.md

⸻

Debug Agent

A utility agent, used any time after Backend/Frontend Implementation to resolve a reported bug — not part of the linear feature pipeline above.

Responsible for:

* Reproducing the reported bug
* Root-causing it
* Classifying it as Simple or Complex
* Simple: fixing it, adding a regression test, and updating any documentation left stale by the fix, in the same pass
* Complex (unclear root cause, API/schema/security impact, or cross-feature blast radius): stopping after a Root Cause Flow Analysis and waiting for human approval before writing any fix

Never modifies specification.md, design.md or architecture.md.

Output: Source Code Fix (Simple path only), debug-report.md

⸻

Quality Gates

Every stage is guarded by a Quality Gate: the next stage cannot start until the required artifact exists and reaches its passing status. See policies/quality-gates.md for Pass Criteria, Fail Criteria, Required Artifacts and Blocking Conditions for every gate, and workflows/feature-development.yaml for the machine-readable definitions.

Feature Gate → Product Gate → Design Gate → Architecture Gate → Backend Gate → Frontend Gate → QA Gate → Security Gate → Operations Gate → Code Quality Gate → Release Gate

⸻

Project Structure

.claude/
agents/
context/
policies/
templates/
workflows/

⸻

Context

ADF uses shared project context to improve consistency.

Examples:

* Project Vision
* Technology Stack
* Coding Standards
* Naming Rules

⸻

Policies

Policies define engineering rules shared by every agent.

Examples:

* Coding
* Security
* Architecture
* API Design
* Testing
* Observability
* Git
* Design
* Accessibility
* Frontend
* Quality Gates

⸻

Templates

Every artifact is generated from a template.

Current templates include:

* Specification
* Product Review
* Design
* Architecture
* Architecture Review
* Implementation Report (shared by Backend and Frontend)
* QA Report
* Security Review
* Operations Readiness Report
* Code Review Report
* Debug Report

⸻

Language Policy

Developers may interact with AI in any language.

All generated project artifacts must be written in English.

This includes:

* Specifications
* Design documents
* Architecture documents
* Code comments
* API documentation
* Commit messages
* Markdown documentation

⸻

Principles

* One responsibility per agent.
* One artifact per stage.
* Human review before progressing.
* Business decisions never leak into implementation.
* UX/UI decisions never leak into backend architecture.
* Architecture decisions never leak into product discovery.
* Implementation is separated from quality validation — QA, Security Review, Operations Readiness Review and Code Review each own exactly one quality dimension and never duplicate another's findings.
* No reviewing agent modifies the artifact it reviews.
* Deterministic outputs whenever possible.
* Reuse existing project context instead of repeating prompts.

⸻

Supported Workflow

Idea
↓
Feature Specification
↓
Product Review
↓
UX / Design
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

⸻

Current Status

ADF is currently focused on:

* Claude Code

Future support:

* Gemini CLI
* OpenAI Codex
* Additional AI coding assistants

The core framework is designed to remain vendor-independent.

⸻

Goals

* Improve AI-generated software quality.
* Reduce ambiguity.
* Increase consistency.
* Separate engineering concerns.
* Enable reproducible AI-assisted development.

⸻

Roadmap

* Multiple AI runtime adapters
* CLI (adf)
* Project scaffolding
* Automated framework validation
* Agent examples and best practices

⸻

License

This project is licensed under the MIT License.
