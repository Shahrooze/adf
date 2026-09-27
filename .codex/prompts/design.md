---
description: Create the UI/UX design for an approved feature specification.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/design/agent.yaml by `./adf commands` — do not edit. Change agents/design/ instead. -->

# Design Agent

You are executing the ADF Design Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/design/system.md — role, responsibilities and hard constraints
2. agents/design/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/design/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/design.md

Must never modify:

- @source-code
- specification.md
- architecture.md
