# Developer Guide

## Folder Structure

```
adf.config.json           this project's identity/stack (adf-core, unchanged)
runtime.config.json        Harness engine configuration
adf                        convenience shell wrapper: ./adf <cmd> == node bin/adf.mjs <cmd>
bin/adf.mjs                CLI entrypoint

agents/<id>/                agent.yaml + system.md + instructions.md   (unchanged structure, additive registry metadata)
workflows/*.yaml             declarative workflows
policies/*.md                 shared engineering rules every agent follows
templates/*.md                artifact templates
context/*.md                  project context (rendered by adf-core init)
features/<id>/                 per-feature artifacts (created as features are worked)

adf-core/                     pre-Harness feature registry/validation CLI — untouched

config/
  tools.json                  Tool Runtime registrations
  guardrails.json              permission policy
  artifact-types.json           artifact type metadata
  validation-steps.json          Validation Pipeline step commands
  mcp-servers.json                future MCP server registrations

plugins/                        drop-in plugins (see docs/PLUGINS.md)

runtime/
  src/
    config/                     paths, runtime.config.json loader
    yaml/                        zero-dependency YAML-subset parser
    registry/                     agent/tool/workflow/artifact-type registries
    context/                      Context Manager
    memory/                        Memory Manager (short-term/session/shared/long-term/vector)
    artifacts/                      Artifact Manager
    guardrails/                      Policy Engine, dangerous-command guard, approval hook
    tools/
      tool-runtime.mjs                unified tool execution path
      impl/*.mjs                       built-in tool implementations
    executors/                          AgentExecutor interface + mock/cli-adapter implementations
    runtime/                             Agent Runtime + execution state machine
    workflow/                             workflow parser, gate evaluator, Workflow Engine
    retry/                                 RetryPolicy, CheckpointStore
    queue/                                  ExecutionQueue
    validation/                              Validation Pipeline
    logging/                                  structured JSONL Logger
    observability/                             metrics, timeline, Markdown+Mermaid report
    plugins/                                     PluginLoader, PluginContext
    cli/                                          CLI dispatcher + per-command modules
    api/                                           REST server
    harness.mjs                                     assembles every subsystem into one Harness
  tests/*.test.mjs                                    node:test suite (node --test)
  examples/plugins/hello-tool-plugin/                  reference plugin

docs/                          this documentation set
.adf/                            runtime state (gitignored): logs, checkpoints, artifacts index/history, memory, queue, reports
```

## Conventions

- **Zero dependencies.** Plain Node ESM (`.mjs`), `node:*` built-ins only.
  No `package.json`, no `npm install`, no `node_modules`. If a task seems
  to need a library, it almost always doesn't — see how `yaml-lite.mjs`,
  the REST router, and every tool implementation get by without one.
- **`node:test` + `node:assert/strict`.** No test framework dependency.
  Run the whole suite (Harness + adf-core) with `node --test` from the
  repo root — it auto-discovers every `*.test.mjs`.
- **Comment the why, not the what.** Every module here opens with a short
  comment explaining why it exists or what constraint shaped it — not a
  restatement of its function signatures.
- **Real tests over mocks where practical.** The test suite runs real
  subprocesses for the git tool, real temp files for the artifact/memory
  managers, a real `WorkflowEngine` end to end against
  `parallel-development.yaml`, and real `adf` subprocess invocations for
  the e2e suite (`runtime/tests/e2e.test.mjs`) — not just unit tests
  against mocked collaborators.

## Adding a New Tool

1. Write `runtime/src/tools/impl/my-tool.mjs` exporting
   `async function execute(args, ctx)`.
2. Add an entry to `config/tools.json` (id, module, permissions, timeout,
   retries) — or, from a plugin, call `ctx.registerTool(...)`.
3. Add a `config/guardrails.json` `toolPermissions` entry if it shouldn't
   default to `defaultPolicy`.
4. Write `runtime/tests/*.test.mjs` coverage exercising it through
   `ToolRuntime.execute`, not just calling `execute()` directly — that's
   what proves guardrails/timeout/retry actually wrap it.

## Adding a New Agent

1. `mkdir agents/my-agent && touch agents/my-agent/{agent.yaml,system.md,instructions.md}`.
2. `agent.yaml` needs at minimum `id`, `name`; add `capabilities`, `tools`,
   `supported_artifacts` so the registry has real metadata (see any
   existing `agents/*/agent.yaml` for the pattern — these three fields
   live in an additive block near the end of the file).
3. `adf agent list` to confirm discovery; `adf agent run my-agent
   --produces some-output.md` to dry-run it with the mock executor.
4. Reference it from a workflow stage's `agent:` field to wire it into a
   pipeline.

## Adding a New Workflow

See `docs/WORKFLOWS.md` — no code, just a new `workflows/*.yaml` file.

## Adding a New Validation Step

Add an entry to `config/validation-steps.json` with a `command`, then
list its id in `runtime.config.json`'s `validation.pipeline` (or pass
`adf validate --stages your-step`). From a plugin:
`ctx.registerValidationStep(id, {command, description})`.

## Running the Test Suite

```sh
node --test                           # everything (Harness + adf-core)
node --test runtime/tests/*.test.mjs  # Harness only
node --test runtime/tests/cli.test.mjs   # one file
```

## Debugging

- `ADF_DEBUG=1 adf <command>` prints a full stack trace on error.
- `adf doctor` checks the environment (Node version, config files parse,
  registries load with zero errors, `.adf/` writable, optional CLI deps).
- `adf logs <run-id>` / `adf status <run-id> --report` for a specific
  run's timeline and full Markdown+Mermaid execution report.
