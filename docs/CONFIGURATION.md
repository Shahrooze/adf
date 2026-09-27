# Configuration

Nothing in the Harness is hardcoded — agents, tools, workflows, artifact
types, validation steps, and guardrail policy are all plain files. This is
the map of every one of them.

| File | Governs | Full reference |
| --- | --- | --- |
| `runtime.config.json` | Runtime engine, queue, retry defaults, logging, memory, validation pipeline order, workflow approvals / strict checks / rework rounds, REST API bind address, plugin directories | `runtime/src/config/runtime.config.schema.md` |
| `config/tools.json` | Tool Runtime registrations: id, module, permissions, timeout, retries | below |
| `config/guardrails.json` | Permission policy (default/per-tool/per-agent), dangerous-command patterns, approval hooks, write sandbox, write-scope enforcement of agent.yaml permissions | below |
| `config/artifact-types.json` | Artifact type metadata: template, producedBy, consumedBy | below |
| `config/validation-steps.json` | The shell command (if any) behind each Validation Pipeline step — also what workflow `gate.checks` run | below |
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
    "backend-agent": { "terminal": "allow" },
    "security-review-agent": { "terminal": "deny" },
    "validation-pipeline": { "terminal": "allow" }
  },
  "dangerousCommandPatterns": ["rm\\s+-rf\\s+/(?!\\S)", "..."],
  "approvalHooks": { "autoApproveInNonInteractive": false },
  "sandbox": { "enabled": false, "allowedWriteRoots": ["features", ".adf"] },
  "writeScope": {
    "enabled": true,
    "onViolation": "fail",
    "pathAliases": {
      "backend-code": ["src/backend/**", "tests/backend/**"],
      "frontend-code": ["src/frontend/**", "tests/frontend/**"],
      "source-code": ["src/**", "tests/**"]
    },
    "alwaysAllowed": [".adf/**", "adf-core/registry.json", "features/<feature-name>/feature.json"]
  }
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

The same policy also decides which native tools the **cli-adapter**
executor pre-authorizes for an agent (`--allowedTools`): a tool the agent
declares in `agent.yaml` `tools:` is granted only if its policy is
`"allow"`, or `"ask"` and the approval hook approves it; `"deny"` is never
granted. `adf doctor` and the test suite flag an agent that declares a
tool its guardrails deny.

### `writeScope` — making agent.yaml permissions binding

With `enabled: true` the Workflow Engine snapshots the git working tree
before every agent stage and afterwards checks each changed file against
that agent's `agent.yaml`:

```yaml
permissions:
  write:
    - "@backend-code"                                         # alias from pathAliases
    - features/<feature-name>/backend-implementation-report.md # resolved to --feature-dir
  deny:
    - specification.md                                        # bare filename = in the feature dir
    - "@frontend-code"
```

Entries are globs (`**`, `*`, `?`, `<placeholder>` = one path segment) —
never prose. `deny` wins over `write`. `pathAliases` is where you describe
your repository layout once (point `backend-code` at `api/**`,
`frontend-code` at `web/**`, …) instead of editing every agent.
`alwaysAllowed` covers files the Harness and adf-core themselves write
during a stage. `onViolation`: `"fail"` (default — fail the stage, leave
the files for a human to inspect) or `"revert"` (also restore the
offending files; files that already had local edits before the stage are
reported, never touched). Not a git work tree → the check is skipped with
a warning. Parallel branches are checked together against the union of
their scopes (each agent's own `deny` still applies to it).

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
    "build": { "command": "dotnet build && npm --prefix src/frontend run build", "description": "..." },
    "unit-tests": { "command": "dotnet test && npm --prefix src/frontend test", "description": "..." },
    "lint": { "command": null, "description": "..." },
    "harness-tests": { "command": "node --test", "description": "ADF's own test suite" }
  }
}
```

These are **your project's** commands, and they matter twice: `adf
validate` runs them, and workflow gates list them under `gate.checks`
(`build`, `unit-tests`, `integration-tests`, `security-scan`, `lint`) so a
stage cannot pass on the agent's word alone. All project steps ship with
`command: null` because ADF cannot know your stack — configure them first
(`adf doctor` lists the ones gates reference but you haven't configured).

A step with `command: null` is **skipped**, not failed, by `adf validate`
— a fresh project doesn't need every step wired up on day one. As a gate
check it passes as **unverified** (shown on the stage), or fails when
`runtime.config.json` `workflow.strictChecks` is `true`.
`harness-tests` runs ADF's own suite and is deliberately in no gate. Step
order comes from `runtime.config.json`'s `validation.pipeline` array (or
`adf validate --stages a,b,c` to run a subset).

## `runtime.config.json` → `workflow`

```json
"workflow": { "approvals": "workflow", "strictChecks": false, "maxReworkRounds": 2 }
```

- `approvals`: `"workflow"` honours each workflow's `human_approval`;
  `"auto"` approves every stage (logged) — for CI only.
- `strictChecks`: an unconfigured gate check fails the gate instead of
  passing as unverified.
- `maxReworkRounds`: default for a review stage's `on_fail.max_rounds`
  and for human rejections.

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
