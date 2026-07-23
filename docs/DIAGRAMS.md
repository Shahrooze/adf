# Diagrams

Rendered copies of the diagrams embedded in the rest of `docs/` (GitHub and
most Markdown viewers render Mermaid natively — these are collected here
for a one-stop view, and to make it obvious when one drifts from its
source of truth).

## Harness Component Map

Source: `docs/ARCHITECTURE.md`.

```mermaid
flowchart TB
    subgraph Clients
        CLI["adf CLI\n(bin/adf.mjs)"]
        REST["REST API\n(adf serve)"]
        Future["future: MCP server /\nIDE extension / GitHub Action"]
    end

    subgraph Harness["Harness (runtime/src/harness.mjs)"]
        Registries["Registries\nagent · tool · workflow · artifact-type"]
        WFE["Workflow Engine"]
        AR["Agent Runtime"]
        TR["Tool Runtime"]
        CM["Context Manager"]
        MM["Memory Manager"]
        AM["Artifact Manager"]
        VP["Validation Pipeline"]
        GR["Guardrails\n(Policy Engine)"]
        Q["Execution Queue"]
        CS["Checkpoint Store"]
        Log["Logger / Observability"]
        PL["Plugin Loader"]
    end

    CLI --> Harness
    REST --> Harness
    Future -.-> Harness

    WFE --> AR
    WFE --> CS
    WFE --> AM
    AR --> CM
    AR --> AM
    CM --> AM
    CM --> MM
    AR --> Executors["Executors\nmock · cli-adapter · (future: API)"]
    Executors --> TR
    TR --> GR
    TR --> Tools["Tools\nfs · git · github · terminal · http · docker · database · mcp"]
    PL -.->|adds| Registries
    PL -.->|adds| Tools
    PL -.->|adds| VP
    Log -.-> WFE
    Log -.-> AR
    Log -.-> TR
```

## Agent Execution State Machine

Source: `docs/RUNTIME.md`.

```mermaid
stateDiagram-v2
    [*] --> pending
    pending --> running
    pending --> cancelled
    running --> paused
    running --> cancelled
    running --> timeout
    running --> completed
    running --> failed
    paused --> running
    paused --> cancelled
    completed --> [*]
    failed --> [*]
    cancelled --> [*]
    timeout --> [*]
```

## `parallel-development.yaml` Stage Graph

Source: `docs/WORKFLOWS.md`. Every real run of this workflow produces a
version of this diagram with live pass/fail markers — see `adf run
parallel-development --report` or `adf status <run-id> --report`
(rendered by `runtime/src/observability/report.mjs`).

```mermaid
flowchart TD
  product["product"] --> architecture["architecture"]
  architecture --> implementation{{"implementation (parallel)"}}
  implementation --> backend["backend-implementation"]
  implementation --> frontend["frontend-implementation"]
  implementation --> qa["qa"]
  qa --> code-review["code-review (conditional on qa)"]
  code-review --> sre["sre (retries up to 3x)"]
```

## Sequential Feature Development Pipeline

The pre-Harness, still-canonical pipeline (`workflows/feature-development.yaml`,
described in the root `README.md`) — unchanged by any of the above.

```mermaid
flowchart TD
  feature["Feature Agent\nspecification.md"] --> product-review["Product Review\nproduct-review.md"]
  product-review --> design["Design Agent\ndesign.md"]
  design --> architecture["Architecture Agent\narchitecture.md"]
  architecture --> architecture-review["Architecture Review\narchitecture-review.md"]
  architecture-review --> backend["Backend Implementation\nbackend-implementation-report.md"]
  backend --> frontend["Frontend Implementation\nfrontend-implementation-report.md"]
  frontend --> qa["QA Agent\nqa-report.md"]
  qa --> security["Security Review\nsecurity-review.md"]
  security --> ops["Operations Readiness\noperations-readiness-report.md"]
  ops --> code-review["Code Review\ncode-review-report.md"]
  code-review --> release["Release Ready"]
```
