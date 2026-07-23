# Plugins

Drop a plugin directory here (or point `runtime.config.json`'s
`plugins.directories` at wherever you keep them) and the Harness picks it
up automatically — no core code changes required.

A plugin is a directory containing:

- `plugin.json` — `{ "id", "name", "version", "description", "main" }`
- an entrypoint module (`main`, defaults to `index.mjs`) exporting an
  async `register(ctx)` function

`ctx` (see `runtime/src/plugins/plugin-api.mjs`) exposes:

- `ctx.registerAgent(rawAgentOrDescriptor, opts?)`
- `ctx.registerTool(descriptor)`
- `ctx.registerWorkflow(id, raw, filePath?)`
- `ctx.registerArtifactType(descriptor)`
- `ctx.registerExecutor(name, executor)`
- `ctx.registerValidationStep(id, stepConfig)`
- `ctx.config`, `ctx.logger` (read-only)

See `runtime/examples/plugins/hello-tool-plugin/` for a complete,
tested reference plugin that registers one of each. Copy it in here to
try it:

```
cp -r runtime/examples/plugins/hello-tool-plugin plugins/
```

A plugin that throws during `register()` is logged and skipped — it never
takes the rest of the Harness down with it.
