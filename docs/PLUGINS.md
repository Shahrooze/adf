# Plugins

A plugin adds an agent, tool, workflow, artifact type, executor, or
validation step **without any change to Harness core**. See
`plugins/README.md` for the quick version; this is the fuller reference.

## Anatomy

```
plugins/my-plugin/
  plugin.json     # { "id", "name", "version", "description", "main" }
  index.mjs        # exports async register(ctx)
  ...any other files the plugin needs (a tool implementation, etc.)
```

`plugin.json`:

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "What it does.",
  "main": "index.mjs"
}
```

`index.mjs`:

```js
export async function register(ctx) {
  ctx.registerTool({ id: "my-tool", module: "./my-tool.mjs", ... });
}
```

## The PluginContext API

Everything a plugin can do (`runtime/src/plugins/plugin-api.mjs`):

| Method | Delegates to |
| --- | --- |
| `ctx.registerAgent(rawOrDescriptor, opts?)` | `AgentRegistry.register()` — add an agent with no `agent.yaml` on disk |
| `ctx.registerTool(descriptor)` | `ToolRegistry.register()` — `{id, module, permissions, timeoutMs, retries}` |
| `ctx.registerWorkflow(id, raw, filePath?)` | `WorkflowRegistry.register()` — a workflow definition object, same shape a parsed `workflows/*.yaml` produces |
| `ctx.registerArtifactType(descriptor)` | `ArtifactTypeRegistry.register()` |
| `ctx.registerExecutor(name, executor)` | `AgentRuntime.registerExecutor()` — add a new `AgentExecutor` implementation |
| `ctx.registerValidationStep(id, stepConfig)` | Adds/overrides an entry in the Validation Pipeline's step config |
| `ctx.config`, `ctx.logger` | Read-only access to the Harness's own config and structured logger |

A plugin's own tool module path is resolved relative to the plugin's own
directory — use `path.dirname(fileURLToPath(import.meta.url))`, see the
reference plugin.

## Discovery

`runtime.config.json`'s `plugins.directories` (default `["plugins"]`) is
scanned for any subdirectory containing `plugin.json`. Loading happens
once, automatically, when a `Harness` is constructed
(`plugins.autoload`, default `true`) — the CLI and REST server both call
`harness.loadPlugins()` on startup, so a plugin dropped into `plugins/` is
picked up the next time `adf` runs, no build step.

A plugin whose `register()` throws is **logged and skipped** — it never
takes the rest of the Harness down (`PluginLoader.loadAll` never rejects
because one plugin is broken).

## Reference Plugin

`runtime/examples/plugins/hello-tool-plugin/` is a complete, tested
example registering one tool, one validation step, and one artifact type.
Try it:

```sh
cp -r runtime/examples/plugins/hello-tool-plugin plugins/
adf plugins list      # shows it discovered
adf doctor             # still passes — a broken copy wouldn't stop the Harness
```

(`runtime/tests/plugins.test.mjs` exercises this same plugin, plus a
deliberately-broken one, as part of the test suite.)

## Inspecting Plugins

```sh
adf plugins list   # every discovered plugin.json, loaded or not
adf plugins load    # force a fresh load and report per-plugin success/failure
```
