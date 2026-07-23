# Configuration

Nothing in the Harness is hardcoded — agents, tools, workflows, artifact
types, validation steps, and guardrail policy are all plain files. This is
the map of every one of them.

| File | Governs | Full reference |
| --- | --- | --- |
| `runtime.config.json` | Runtime engine, queue, retry defaults, logging, memory, validation pipeline order, REST API bind address, plugin directories | `runtime/src/config/runtime.config.schema.md` |
| `config/tools.json` | Tool Runtime registrations: id, module, permissions, timeout, retries | below |
| `config/guardrails.json` | Permission policy (default/per-tool/per-agent), dangerous-command patterns, approval hooks, write sandbox | below |
| `config/artifact-types.json` | Artifact type metadata: template, producedBy, consumedBy | below |
| `config/validation-steps.json` | The shell command (if any) behind each Validation Pipeline step | below |
| `config/mcp-servers.json` | Future MCP server registrations, consumed by the `mcp` tool | below |
| `adf.config.json` | This project's own identity + technology stack — owned by adf-core, unrelated to and untouched by the Harness | `adf-core/schema/adf-config.schema.md` |

## `config/tools.json`

```json
{
  "tools": [
    {
      "id": "terminal",
      "name": "Terminal",
      "description": "...",
      "module": "terminal-tool.mjs",
      "permissions": ["exec"],
      "timeoutMs": 60000,
      "retries": 0
    }
  ]
}
```

`module` resolves relative to `runtime/src/tools/impl/` unless it's an
absolute path (which is how a plugin's own tool module gets loaded). Every
built-in tool module exports `async function execute(args, ctx)`; see
`runtime/src/tools/impl/*.mjs` for the argument shape each one expects.

## `config/guardrails.json`

```json
{
  "defaultPolicy": "allow",
  "toolPermissions": { "terminal": "ask", "github": "ask" },
  "agentOverrides": {
    "qa-agent": { "terminal": "deny" },
    "validation-pipeline": { "terminal": "allow" }
  },
  "dangerousCommandPatterns": ["rm\\s+-rf\\s+/(?!\\S)", "..."],
  "approvalHooks": { "autoApproveInNonInteractive": false },
  "sandbox": { "enabled": false, "allowedWriteRoots": ["features", ".adf"] }
}
```

Resolution order for "can agent X use tool Y": `agentOverrides[X][Y]` →
`toolPermissions[Y]` → `defaultPolicy`. A `dangerousCommandPatterns` match
is refused **regardless** of policy — it is not overridable from this
file (only by removing the pattern itself). `"ask"` resolves through the
approval hook: the CLI prompts interactively when stdin is a TTY,
otherwise (and always for the REST API) it falls back to
`approvalHooks.autoApproveInNonInteractive`.

`sandbox.enabled: true` additionally refuses any tool call whose
`args.writePath` falls outside `allowedWriteRoots`, independent of the
per-tool/per-agent policy above.

## `config/artifact-types.json`

```json
{
  "artifactTypes": [
    {
      "id": "specification",
      "name": "Feature Specification",
      "template": "specification.md",
      "producedBy": ["feature-agent"],
      "consumedBy": ["product-review-agent", "design-agent", "architecture-agent"]
    }
  ]
}
```

`template` is resolved against `templates/` — `null` for non-document
artifact types (`source-code`, `tests`).

## `config/validation-steps.json`

```json
{
  "steps": {
    "unit-tests": { "command": "node --test", "description": "..." },
    "lint": { "command": null, "description": "..." }
  }
}
```

A step with `command: null` is **skipped**, not failed — a fresh project
adopting the Harness doesn't need every step wired up on day one. Step
order comes from `runtime.config.json`'s `validation.pipeline` array (or
`adf validate --stages a,b,c` to run a subset).

## `config/mcp-servers.json`

```json
{ "servers": [{ "id": "my-server", "command": "npx", "args": ["-y", "some-mcp-server"] }] }
```

Empty by default. The `mcp` tool reads this and, once a server is
registered, documents how to wire it to a real MCP client (the Harness
doesn't bundle one, to stay zero-dependency) — see
`runtime/src/tools/impl/mcp-tool.mjs`.

## Environment Variables

| Variable | Effect |
| --- | --- |
| `ADF_DEBUG` | Non-empty: the CLI prints a full stack trace on an uncaught command error instead of just the message. |
| `NO_COLOR` | Respected by adf-core's own color helpers (`adf-core/lib/color.mjs`); the Harness CLI doesn't currently color its own output. |
