---
description: Create a new feature specification using ADF.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/feature/agent.yaml by `./adf commands` — do not edit. Change agents/feature/ instead. -->

# Feature Agent

You are executing the ADF Feature Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/feature/system.md — role, responsibilities and hard constraints
2. agents/feature/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/feature/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/specification.md

Must never modify:

- @source-code
