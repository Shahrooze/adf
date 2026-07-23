# runtime.config.json schema

This is a human-readable reference, not a machine-enforced JSON Schema (the
Harness stays zero-dependency, so there is no schema-validation library
wired up). `runtime/src/config/config-loader.mjs` deep-merges whatever
keys you set here on top of its own defaults — you only need to specify
what you want to change.

| Path | Type | Default | Meaning |
| --- | --- | --- | --- |
| `runtime.defaultExecutor` | string | `"mock"` | Executor used when a workflow stage or `adf agent run` doesn't specify one. `"mock"` never calls an external AI CLI (safe default, used for dry runs and CI); `"cli-adapter"` shells out to a real AI CLI. |
| `runtime.agentTimeoutMs` | number | `600000` | Default per-agent-execution timeout. |
| `runtime.maxConcurrentAgents` | number | `4` | Reserved for future scheduler use; today concurrency is governed by `queue.concurrency`. |
| `runtime.pauseCheckIntervalMs` | number | `250` | How often a paused Agent Runtime execution or Workflow Engine run polls for resume/cancel. |
| `runtime.shortTermMaxEntries` | number | `200` | Cap for short-term (in-process) memory scopes. |
| `runtime.executors["cli-adapter"].command` | string | `"claude"` | Binary invoked by the cli-adapter executor. |
| `runtime.executors["cli-adapter"].args` | string[] | `["-p"]` | Arguments passed before the prompt is piped over stdin. |
| `queue.concurrency` | number | `4` | Max jobs the Execution Queue runs at once. |
| `queue.defaultPriority` | number | `5` | Priority assigned to a queued job when none is given (higher runs first). |
| `retry.maxAttempts` | number | `3` | Default RetryPolicy attempts, used by any stage without its own `retry:`. |
| `retry.backoffMs` / `backoffFactor` / `maxBackoffMs` | number | `2000` / `2` / `60000` | Exponential backoff parameters. |
| `logging.level` | string | `"info"` | Advisory only today — every level is always written; reserved for future filtering. |
| `memory.backend` | string | `"file"` | Persisted memory backend. Only `"file"` exists today. |
| `validation.pipeline` | string[] | `["lint","unit-tests","integration-tests","security-scan","performance","build","review"]` | Step order for `adf validate`, matched against `config/validation-steps.json`. |
| `validation.continueOnFailure` | boolean | `false` | `false` = fail-fast (stop at the first failing step); `true` = run every step and report the full picture. |
| `api.port` / `api.host` | number / string | `4870` / `"127.0.0.1"` | REST API bind address (`adf serve`). |
| `plugins.autoload` | boolean | `true` | Whether `Harness` loads `plugins/*/plugin.json` automatically. |
| `plugins.directories` | string[] | `["plugins"]` | Directories scanned for plugins, relative to the repo root. |

See also:
- `config/tools.json` — Tool Runtime registrations (id, module, permissions, timeoutMs, retries).
- `config/guardrails.json` — permission policy, dangerous-command patterns, sandbox write roots.
- `config/artifact-types.json` — artifact type metadata (template, producedBy, consumedBy).
- `config/validation-steps.json` — the shell command (if any) behind each validation step id.
- `config/mcp-servers.json` — future MCP server registrations for the `mcp` tool.
