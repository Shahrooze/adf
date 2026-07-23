import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PluginLoader } from "../src/plugins/plugin-loader.mjs";
import { PluginContext } from "../src/plugins/plugin-api.mjs";
import { loadAgentRegistry } from "../src/registry/agent-registry.mjs";
import { loadToolRegistry } from "../src/registry/tool-registry.mjs";
import { loadWorkflowRegistry } from "../src/registry/workflow-registry.mjs";
import { loadArtifactTypeRegistry } from "../src/registry/artifact-type-registry.mjs";
import { ValidationPipeline } from "../src/validation/validation-pipeline.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";

function fakeHarness() {
  return {
    config: {},
    logger: null,
    agentRegistry: loadAgentRegistry(),
    toolRegistry: loadToolRegistry(),
    workflowRegistry: loadWorkflowRegistry(),
    artifactTypeRegistry: loadArtifactTypeRegistry(),
    agentRuntime: { registerExecutor: () => {} },
    validationPipeline: new ValidationPipeline({ toolRuntime: null, steps: [] }),
  };
}

test("AgentRegistry.register lets a plugin add an agent without an agent.yaml on disk", () => {
  const registry = loadAgentRegistry();
  const before = registry.list().length;
  const descriptor = registry.register({
    id: "plugin-demo-agent",
    name: "Plugin Demo Agent",
    capabilities: ["demo"],
    tools: ["fs"],
    supported_artifacts: ["demo-note"],
  });
  assert.equal(registry.list().length, before + 1);
  assert.equal(descriptor.id, "plugin-demo-agent");
  assert.throws(() => registry.register({ id: "plugin-demo-agent" }), /already registered/);
});

test("PluginLoader discovers the reference hello-tool-plugin example", () => {
  const loader = new PluginLoader({
    config: { plugins: { autoload: true, directories: ["runtime/examples/plugins"] } },
  });
  const found = loader.discover();
  assert.ok(found.some((p) => p.manifest?.id === "hello-tool-plugin"));
});

test("PluginLoader.loadAll registers the plugin's tool, validation step, and artifact type", async () => {
  const harness = fakeHarness();
  const loader = new PluginLoader({
    config: { plugins: { autoload: true, directories: ["runtime/examples/plugins"] } },
  });
  const ctx = new PluginContext(harness);
  const results = await loader.loadAll(ctx);

  assert.equal(results.length, 1);
  assert.equal(results[0].loaded, true);
  assert.equal(results[0].id, "hello-tool-plugin");

  assert.ok(harness.toolRegistry.has("hello"));
  const tool = harness.toolRegistry.get("hello");
  const mod = await tool.load();
  const greeting = await mod.execute({ name: "Test" }, {});
  assert.match(greeting, /Hello, Test!/);

  assert.ok(harness.validationPipeline.steps.includes("hello-check"));
  assert.ok(harness.artifactTypeRegistry.has("hello-note"));
});

test("PluginLoader.loadAll reports a broken plugin without throwing or blocking other plugins", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adf-plugins-"));
  fs.mkdirSync(path.join(dir, "broken-plugin"));
  fs.writeFileSync(path.join(dir, "broken-plugin", "plugin.json"), JSON.stringify({ id: "broken-plugin", main: "index.mjs" }));
  fs.writeFileSync(path.join(dir, "broken-plugin", "index.mjs"), `export async function register() { throw new Error("boom"); }`);

  fs.mkdirSync(path.join(dir, "good-plugin"));
  fs.writeFileSync(path.join(dir, "good-plugin", "plugin.json"), JSON.stringify({ id: "good-plugin", main: "index.mjs" }));
  fs.writeFileSync(path.join(dir, "good-plugin", "index.mjs"), `export async function register(ctx) { ctx.registerValidationStep("good-plugin-step", { command: "true" }); }`);

  const harness = fakeHarness();
  const loader = new PluginLoader({ config: { plugins: { autoload: true, directories: [dir] } } });
  const ctx = new PluginContext(harness);
  const results = await loader.loadAll(ctx);

  const broken = results.find((r) => r.id === "broken-plugin");
  const good = results.find((r) => r.id === "good-plugin");
  assert.equal(broken.loaded, false);
  assert.match(broken.error, /boom/);
  assert.equal(good.loaded, true);
  assert.ok(harness.validationPipeline.steps.includes("good-plugin-step"));
});

test("PluginLoader respects plugins.autoload = false", async () => {
  const harness = fakeHarness();
  const loader = new PluginLoader({ config: { plugins: { autoload: false, directories: ["runtime/examples/plugins"] } } });
  const results = await loader.loadAll(new PluginContext(harness));
  assert.deepEqual(results, []);
});
