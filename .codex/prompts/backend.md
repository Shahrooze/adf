---
description: Implement the backend of an approved feature.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/backend/agent.yaml by `./adf commands` — do not edit. Change agents/backend/ instead. -->

# Backend Implementation Agent

You are executing the ADF Backend Implementation Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/backend/system.md — role, responsibilities and hard constraints
2. agents/backend/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/backend/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- @backend-code
- features/<feature-name>/backend-implementation-report.md

Must never modify:

- specification.md
- design.md
- architecture.md
- @frontend-code
