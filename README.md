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
Architecture Agent
    │
    ▼
Architecture
    │
    ▼
Implementation Agent
    │
    ▼
Code
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

Architecture Agent

Responsible for:

* Domain model
* API design
* Database design
* Security
* Performance
* Technical architecture

Output:

architecture.md

⸻

Implementation Agent

Responsible for:

* Implementing approved architecture
* Writing production-ready code
* Generating tests
* Producing implementation reports

Output:

Source Code
implementation-report.md

⸻

Review Agent

Responsible for:

* Code review
* Security review
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

⸻

Templates

Every artifact is generated from a template.

Current templates include:

* Specification
* Architecture
* Implementation Report
* Review Report

⸻

Language Policy

Developers may interact with AI in any language.

All generated project artifacts must be written in English.

This includes:

* Specifications
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
* Architecture decisions never leak into product discovery.
* Deterministic outputs whenever possible.
* Reuse existing project context instead of repeating prompts.

⸻

Supported Workflow

Idea
↓
Feature Specification
↓
Architecture Design
↓
Implementation
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