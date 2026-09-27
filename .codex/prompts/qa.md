---
description: Validate test coverage, acceptance criteria and Definition of Done.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/qa/agent.yaml by `./adf commands` — do not edit. Change agents/qa/ instead. -->

# QA Agent

You are executing the ADF QA Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/qa/system.md — role, responsibilities and hard constraints
2. agents/qa/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/qa/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/qa-report.md
- tests/**

Must never modify:

- specification.md
- design.md
- architecture.md
- src/**
