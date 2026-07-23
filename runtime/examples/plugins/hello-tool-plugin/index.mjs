// Reference plugin, proving out the four extension points a plugin can
// use without any change to Harness core: a new tool, a new validation
// step, and a new artifact type. Point runtime.config.json's
// `plugins.directories` at this example's parent directory (or copy this
// folder into your project's own `plugins/`) to load it.
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function register(ctx) {
  ctx.registerTool({
    id: "hello",
    name: "Hello",
    description: "Reference tool from hello-tool-plugin — greets whoever calls it.",
    module: path.join(HERE, "hello-tool.mjs"),
    permissions: [],
    timeoutMs: 5000,
    retries: 0,
    source: "plugin:hello-tool-plugin",
  });

  ctx.registerValidationStep("hello-check", {
    command: 'echo "hello-tool-plugin validation step ran"',
    description: "Reference validation step from hello-tool-plugin.",
  });

  ctx.registerArtifactType({
    id: "hello-note",
    name: "Hello Note",
    template: null,
    producedBy: [],
    consumedBy: [],
  });

  ctx.logger?.info?.("hello-tool-plugin registered its tool, validation step, and artifact type", {});
}
