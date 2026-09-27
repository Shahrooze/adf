---
description: Independently review an architecture before Backend Implementation.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/architecture-review/agent.yaml by `./adf commands` — do not edit. Change agents/architecture-review/ instead. -->

# Architecture Review Agent

You are executing the ADF Architecture Review Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/architecture-review/system.md — role, responsibilities and hard constraints
2. agents/architecture-review/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/architecture-review/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/architecture-review.md

Must never modify:

- architecture.md
- design.md
- specification.md
- @source-code
