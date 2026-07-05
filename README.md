ADF (AI Development Framework)

Build software with AI using a structured engineering workflow instead of ad-hoc prompts.

Overview

ADF (AI Development Framework) is an opinionated framework for AI-assisted software development.

Instead of asking an LLM to generate an entire application in a single prompt, ADF breaks software development into well-defined engineering stages. Each stage has a single responsibility, a dedicated AI agent, explicit inputs, and predictable outputs.

The goal is to make AI-generated software more maintainable, reviewable, and production-ready.

⸻

Philosophy

ADF is built around one simple principle:

AI should participate in the software engineering process, not replace it.

Every stage produces an artifact.

Every artifact can be reviewed.

Every decision is traceable.

No agent is allowed to change decisions made in previous stages.

⸻

Workflow

Idea
    │
    ▼
Feature Agent
    │
    ▼
Specification
    │
    ▼
Design Agent
    │
    ▼
Design
    │
    ▼
Architecture Agent
    │
    ▼
Architecture
    │
    ▼
Backend Implementation Agent
    │
    ▼
Backend Code
    │
    ▼
Frontend Implementation Agent
    │
    ▼
Frontend Code
    │
    ▼
Review Agent
    │
    ▼
Production Ready Feature

⸻

Agents

Feature Agent

Responsible for:

* Product discovery
* Functional requirements
* Business rules
* Acceptance criteria
* Non-functional requirements

Output:

specification.md

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

Output:

design.md

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

Output:

architecture.md

⸻

Backend Implementation Agent

Responsible for:

* Implementing the approved architecture on the server side
* Writing production-ready backend code
* Exposing API contracts required by the Frontend Agent
* Generating backend tests
* Producing a backend implementation report

Never implements UI.

Output:

Backend Source Code
backend-implementation-report.md

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

Output:

Frontend Source Code
frontend-implementation-report.md

⸻

Review Agent

Responsible for:

* Independent review of Specification, Design, Architecture, Backend and Frontend
* Security review
* Accessibility review
* Architecture compliance
* Acceptance criteria verification
* Final recommendation

Output:

review-report.md

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
* Git
* Design
* Accessibility
* Frontend

⸻

Templates

Every artifact is generated from a template.

Current templates include:

* Specification
* Design
* Architecture
* Implementation Report (shared by Backend and Frontend)
* Review Report

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
* Deterministic outputs whenever possible.
* Reuse existing project context instead of repeating prompts.

⸻

Supported Workflow

Idea
↓
Feature Specification
↓
Design
↓
Architecture Design
↓
Backend Implementation
↓
Frontend Implementation
↓
Review
↓
Production

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