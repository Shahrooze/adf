---
description: Implement the frontend of an approved feature.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/frontend/agent.yaml by `./adf commands` — do not edit. Change agents/frontend/ instead. -->

# Frontend Implementation Agent

You are executing the ADF Frontend Implementation Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/frontend/system.md — role, responsibilities and hard constraints
2. agents/frontend/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/frontend/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- @frontend-code
- features/<feature-name>/frontend-implementation-report.md

Must never modify:

- specification.md
- design.md
- architecture.md
- @backend-code
