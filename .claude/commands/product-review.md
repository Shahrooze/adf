---
description: Independently review a feature specification before Design.
argument-hint: <feature-name>
---

<!-- GENERATED from agents/product-review/agent.yaml by `./adf commands` — do not edit. Change agents/product-review/ instead. -->

# Product Review Agent

You are executing the ADF Product Review Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/product-review/system.md — role, responsibilities and hard constraints
2. agents/product-review/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/product-review/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- features/<feature-name>/product-review.md

Must never modify:

- specification.md
- @source-code
