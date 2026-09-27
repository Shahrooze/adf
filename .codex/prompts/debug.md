---
description: Reproduce, root-cause and fix a reported bug — or, if it is complex, produce a Root Cause Flow Analysis first.
argument-hint: <bug-id-or-description> [feature-name]
---

<!-- GENERATED from agents/debug/agent.yaml by `./adf commands` — do not edit. Change agents/debug/ instead. -->

# Debug Agent

You are executing the ADF Debug Agent for: $ARGUMENTS

Read these two files in full and follow them exactly — they are the whole
definition of this agent:

1. agents/debug/system.md — role, responsibilities and hard constraints
2. agents/debug/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS

`<feature-name>` in those files is the feature named above; its artifacts
live under `features/<feature-name>/`.

## Write scope

When this agent runs under the ADF Harness, every file it changes is
checked against agents/debug/agent.yaml `permissions` (`@alias` entries are
defined in config/guardrails.json `writeScope.pathAliases`).

May write:

- @source-code
- README.md
- docs/**
- features/<feature-name>/*-implementation-report.md
- features/<feature-name>/debug-reports/<bug-id>-debug-report.md
- bugs/<bug-id>/debug-report.md

Must never modify:

- specification.md
- design.md
- architecture.md
