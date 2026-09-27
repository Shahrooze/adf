---
description: Generate architecture for an approved feature.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/architecture/agent.yaml by `./adf commands` — do not edit. Change agents/architecture/ instead. -->

# Architecture Agent

You are executing the ADF Architecture Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/architecture/system.md — role, responsibilities and hard constraints
2. agents/architecture/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/architecture/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/architecture.md

Must never modify:

- @source-code
