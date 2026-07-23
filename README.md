ADF (AI Development Framework)

Build software with AI using a structured engineering workflow instead of ad-hoc prompts.

Overview

ADF (AI Development Framework) is an opinionated framework for AI-assisted software development.

Instead of asking an LLM to generate an entire application in a single prompt, ADF breaks software development into well-defined engineering stages. Each stage has a single responsibility, a dedicated AI agent, explicit inputs, and predictable outputs.

Implementation is strictly separated from quality validation: Backend and Frontend Implementation only build; QA, Security Review, Operations Readiness Review and Code Review each independently validate exactly one quality dimension.

The goal is to make AI-generated software more maintainable, reviewable, and production-ready.

⸻

The Agent Runtime / Harness

Everything below this point describes ADF's staged-gate *methodology* — which hasn't changed. What executes it has: ADF now ships a full Agent Runtime / Harness (runtime/) that turns the agents, workflows, and policies described in this document into something the machine actually runs, not just a set of prompts a human pastes into an AI CLI by hand.

The Harness owns agent lifecycle, workflow orchestration (sequential, parallel, and conditional stages), tool execution, context assembly, memory, artifact tracking, a validation pipeline, retries with rollback, permission guardrails, structured logging, observability, and a plugin system — all driven by plain config files, zero npm dependencies. Agents stay exactly what they are on this page: a single-responsibility prompt with declared inputs and outputs. The Harness is what coordinates them.

    ./adf run feature-development --feature-dir features/my-feature --report
    ./adf run parallel-development --feature-dir features/my-feature   # Backend + Frontend in parallel
    ./adf serve                                                        # REST API over the same runtime
    ./adf --help

See docs/ARCHITECTURE.md for the full component map, docs/WORKFLOWS.md for the declarative workflow format (including the parallel/conditional example above), docs/RUNTIME.md for the Agent Runtime's execution model, docs/CONFIGURATION.md for every config file, docs/PLUGINS.md for extending it without touching core, docs/DEVELOPER-GUIDE.md for the folder structure and contribution conventions, docs/EXAMPLES.md for more worked examples, and MIGRATION.md for what changed and why it's backward-compatible.

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
* Simple: updating every stale document to describe the correct/expected behavior first, then fixing the code to match it, then adding a regression test — documentation is the target the fix must satisfy, never written after the fact
* Complex (unclear root cause, API/schema/security impact, or cross-feature blast radius): stopping after a Root Cause Flow Analysis and waiting for human approval before writing any fix or documentation change

Never modifies specification.md, design.md or architecture.md.

Output: Source Code Fix (Simple path only), debug-report.md

⸻

Quality Gates

Every stage is guarded by a Quality Gate: the next stage cannot start until the required artifact exists and reaches its passing status. See policies/quality-gates.md for Pass Criteria, Fail Criteria, Required Artifacts and Blocking Conditions for every gate, and workflows/feature-development.yaml for the machine-readable definitions.

Feature Gate → Product Gate → Design Gate → Architecture Gate → Backend Gate → Frontend Gate → QA Gate → Security Gate → Operations Gate → Code Quality Gate → Release Gate

⸻

ADF Core

ADF Core (adf-core/) is a zero-dependency Node CLI layered on top of the staged-gate workflow above. It turns "what's the state of this repo" from a manual read of every feature's artifacts into a single generated lookup.

Adopting ADF in a new project starts with node adf-core/cli.mjs init: an interactive wizard (or --yes/--from/--set for scripted, non-interactive setup) that records the project's own technology stack in adf.config.json and renders context/tech-stack.md, context/project.md and context/design-system.md from it — instead of hand-editing those files' hardcoded defaults. See adf-core/README.md's Commands section for the full flag reference.

It maintains, per project that adopts ADF:

* A Feature Registry (features/<id>/feature.json, aggregated into adf-core/registry.json)
* A Project Index (adf-core/INDEX.md)
* A generated context digest (adf-core/CONTEXT.md)
* A dependency graph (adf-core/DEPENDENCY-GRAPH.md)
* A Validation Engine (node adf-core/cli.mjs validate) that catches missing manifests, duplicate or broken Feature IDs, circular dependencies, orphan files, incomplete releases, and gate/status mismatches

Every stage ends by running node adf-core/cli.mjs sync <feature-id>, which regenerates all of the above and validates the repository scoped to that feature — must pass with zero errors before the stage's gate is satisfied. This is additive tooling: it does not add, remove, or reorder any stage, and does not change any STATUS: vocabulary. See adf-core/README.md for the full command reference and adf-core/schema/feature.schema.md for the feature.json format.

Every adf-core command is also reachable through the unified Harness CLI as adf registry <command> (e.g. adf registry validate) — a passthrough, not a reimplementation; node adf-core/cli.mjs <command> keeps working exactly as it always has.

⸻

Project Structure

.claude/
.codex/
adf-core/ — pre-Harness feature registry, project index, and validation CLI (unchanged, still fully supported)
adf.config.json — this project's identity + technology stack, written by node adf-core/cli.mjs init
runtime.config.json — Harness engine configuration (see docs/CONFIGURATION.md)
adf, bin/adf.mjs — the unified CLI entrypoint
agents/
context/
policies/
templates/
workflows/ — including workflows/parallel-development.yaml, the parallel/conditional example
config/ — tools.json, guardrails.json, artifact-types.json, validation-steps.json, mcp-servers.json
plugins/ — drop-in Harness plugins (see docs/PLUGINS.md)
runtime/ — the Agent Runtime / Harness implementation and its own test suite (see docs/ARCHITECTURE.md)
docs/ — Harness architecture, runtime, workflows, configuration, plugins, developer guide, examples
features/ — created per project as features are started
_archive/ — created per project as features are archived

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

The Harness's cli-adapter executor (runtime/src/executors/cli-adapter-executor.mjs) already spawns whatever AI CLI is configured in runtime.config.json — Claude Code today, and Gemini CLI, OpenAI Codex, or any other CLI that accepts a prompt on stdin tomorrow, with no Harness code change, just a config change. The default mock executor requires no AI CLI at all, for tests and dry runs.

The core framework — both the methodology and the Harness — is designed to remain vendor-independent.

⸻

Goals

* Improve AI-generated software quality.
* Reduce ambiguity.
* Increase consistency.
* Separate engineering concerns.
* Enable reproducible AI-assisted development.

⸻

Roadmap

* A bundled MCP client so the mcp tool can call real MCP servers directly, not just document how to wire one up
* A direct-API executor (no AI CLI subprocess) alongside the existing mock and cli-adapter executors
* IDE extension and GitHub Action clients for the same Harness the CLI and REST API already share
* Project scaffolding
* Agent examples and best practices

⸻

License

This project is licensed under the MIT License.
