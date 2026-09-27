---
description: Independently review a feature for production/operations readiness.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/operations-readiness/agent.yaml by `./adf commands` — do not edit. Change agents/operations-readiness/ instead. -->

# Operations Readiness Review Agent

You are executing the ADF Operations Readiness Review Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/operations-readiness/system.md — role, responsibilities and hard constraints
2. agents/operations-readiness/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/operations-readiness/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/operations-readiness-report.md

Must never modify:

- src/**
- specification.md
- design.md
- architecture.md
