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

---

## Load Context

Read the following files before doing anything:

- agents/feature/agent.yaml
- templates/specification.md

If available also read:

- context/**
- docs/**

No engineering policy in policies/** applies to pure product discovery —
skip that directory for this stage.

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

---

Step 3

Validate.

Do not continue until all required information exists.

---

Step 4

Generate

features/<feature-name>/specification.md

using

templates/specification.md

---

Step 5

Verify the generated specification satisfies every Quality Gate defined in

agents/feature/agent.yaml

---

Output only the completed specification.