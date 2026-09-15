---
description: Create a new feature specification using ADF.
argument-hint: <feature-name>
---

# Feature Command

You are executing the ADF Feature Agent.

## Objective

Convert a rough feature idea into a production-ready Feature Specification.

Do NOT write code.

Do NOT design architecture.

Do NOT skip discovery.

Do NOT proceed past Discovery until the problem is completely clear.

---

## Ambiguity Rule

This rule applies to every step of this workflow, not only Discovery.

If anything is ambiguous, unclear, or open to more than one interpretation,
stop and ask the user. Never assume, guess, or decide on your own. Wait for
the user's answer before continuing to the next step.

---

## Load Context

Read the following files before doing anything:

- agents/feature/agent.yaml
- templates/specification.md
- policies/naming.md

If available also read:

- context/**
- docs/**

No engineering policy in policies/** applies to pure product discovery —
skip that directory for this stage. policies/naming.md is the one
exception: always read it, it governs the folder name you create below.

---

## Workflow

Step 1

Understand the feature.

Summarize it.

Wait for confirmation.

---

Step 2

Run Discovery.

Ask only the missing questions.

Group questions.

Do not continue until the problem is completely clear. If any part of it is
ambiguous, ask the user — do not decide on your own.

---

Step 3

Validate.

Do not continue until all required information exists.

If any ambiguity remains, ask the user before proceeding. Never resolve an
open question by assumption.

---

Step 4 — Assign Feature ID

Run `node adf-core/cli.mjs next-id` to get the next FEAT-<NNN> (see
policies/naming.md), and derive a kebab-case slug from the feature.
Combine them into the folder name

features/FEAT-<NNN>-<slug>/

---

Step 5

Generate

features/FEAT-<NNN>-<slug>/specification.md

using

templates/specification.md

---

Step 6

Verify the generated specification satisfies every Quality Gate defined in

agents/feature/agent.yaml

---

Step 7 — Register in ADF Core

Run, in order:

node adf-core/cli.mjs new FEAT-<NNN>-<slug> --priority <priority> --owner <owner>

node adf-core/cli.mjs sync FEAT-<NNN>

This creates features/FEAT-<NNN>-<slug>/feature.json (the Feature Registry
entry — see adf-core/schema/feature.schema.md) and regenerates
adf-core/registry.json, INDEX.md, CONTEXT.md, and DEPENDENCY-GRAPH.md. The
sync command must complete with no errors before this stage is done.

---

Output only the completed specification.
