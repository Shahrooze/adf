import test from "node:test";
import assert from "node:assert/strict";
import { Harness } from "../src/harness.mjs";

test("Harness assembles every subsystem from real repo config with no errors", () => {
  const harness = new Harness({ runId: "harness-assembly-test" });
  assert.ok(harness.agentRegistry.list().length >= 12);
  assert.equal(harness.agentRegistry.errors().length, 0);
  assert.ok(harness.toolRegistry.list().length >= 7);
  assert.ok(harness.workflowRegistry.has("feature-development"));
  assert.ok(harness.workflowRegistry.has("parallel-development"));
  assert.ok(harness.artifactTypeRegistry.has("specification"));
  assert.ok(harness.agentRuntime.executors.has("mock"));
  assert.ok(harness.agentRuntime.executors.has("cli-adapter"));
  assert.ok(harness.workflowEngine);
  assert.ok(harness.validationPipeline);
  assert.ok(harness.queue);
  assert.ok(harness.checkpointStore);
});

test("Harness.loadPlugins loads plugins configured in runtime.config.json (none by default outside plugins/)", async () => {
  const harness = new Harness({ runId: "harness-plugin-test" });
  const results = await harness.loadPlugins();
  assert.deepEqual(results, []);
});
