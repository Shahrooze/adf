---
description: Final code quality review before a feature is Release Ready.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/code-review/agent.yaml by `./adf commands` — do not edit. Change agents/code-review/ instead. -->

# Code Review Agent

You are executing the ADF Code Review Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/code-review/system.md — role, responsibilities and hard constraints
2. agents/code-review/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/code-review/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/code-review-report.md

Must never modify:

- @source-code
- specification.md
- design.md
- architecture.md
