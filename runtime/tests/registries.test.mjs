import test from "node:test";
import assert from "node:assert/strict";
import { loadAgentRegistry } from "../src/registry/agent-registry.mjs";
import { loadToolRegistry, ToolRegistry, ToolDescriptor } from "../src/registry/tool-registry.mjs";
import { loadWorkflowRegistry } from "../src/registry/workflow-registry.mjs";
import { loadArtifactTypeRegistry } from "../src/registry/artifact-type-registry.mjs";

test("AgentRegistry discovers all 12 agents with no errors", () => {
  const registry = loadAgentRegistry();
  assert.equal(registry.errors().length, 0);
  const ids = registry.list().map((a) => a.id).sort();
  assert.equal(ids.length, 12);
  assert.ok(ids.includes("feature-agent"));
  assert.ok(ids.includes("backend-agent"));
  assert.ok(ids.includes("debug-agent"));
});

test("AgentRegistry.get throws a helpful error for unknown agents", () => {
  const registry = loadAgentRegistry();
  assert.throws(() => registry.get("nonexistent-agent"), /Unknown agent/);
});

test("AgentDescriptor exposes capabilities, tools and artifacts", () => {
  const registry = loadAgentRegistry();
  const backend = registry.get("backend-agent");
  assert.ok(backend.hasCapability("backend-implementation"));
  assert.ok(backend.requiresTool("git"));
  assert.ok(backend.supportedArtifacts.includes("source-code"));
  assert.ok(backend.systemPrompt().length > 0);
});

test("AgentRegistry.findByCapability filters correctly", () => {
  const registry = loadAgentRegistry();
  const reviewers = registry.findByCapability("review");
  assert.ok(reviewers.length >= 5);
  assert.ok(reviewers.every((a) => a.capabilities.includes("review")));
});

test("ToolRegistry discovers the built-in tools from config/tools.json", () => {
  const registry = loadToolRegistry();
  assert.ok(registry.has("fs"));
  assert.ok(registry.has("git"));
  assert.ok(registry.has("terminal"));
  const fsTool = registry.get("fs");
  assert.ok(fsTool.permissions.includes("fs:read"));
});

test("ToolRegistry.register allows plugins to add tools without touching config", () => {
  const registry = new ToolRegistry().discover();
  const before = registry.list().length;
  registry.register(new ToolDescriptor({ id: "custom-tool", module: "custom-tool.mjs" }));
  assert.equal(registry.list().length, before + 1);
  assert.ok(registry.has("custom-tool"));
});

test("WorkflowRegistry discovers feature-development.yaml", () => {
  const registry = loadWorkflowRegistry();
  assert.ok(registry.has("feature-development"));
  const wf = registry.get("feature-development");
  assert.equal(wf.raw.stages.length, 12);
});

test("ArtifactTypeRegistry cross-references agents and templates", () => {
  const registry = loadArtifactTypeRegistry();
  assert.ok(registry.has("specification"));
  const spec = registry.get("specification");
  assert.ok(spec.templateExists());
  assert.deepEqual(spec.producedBy, ["feature-agent"]);
  const producedByBackend = registry.producedByAgent("backend-agent").map((t) => t.id);
  assert.ok(producedByBackend.includes("implementation-report"));
});
