import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ArtifactManager, ARTIFACT_STATUSES } from "../src/artifacts/artifact-manager.mjs";
import { MemoryManager } from "../src/memory/memory-store.mjs";
import { ContextManager } from "../src/context/context-manager.mjs";

function tmpDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `adf-${name}-`));
}

test("ArtifactManager versions content and snapshots history", () => {
  const am = new ArtifactManager({ stateDir: tmpDir("artifacts"), repoRoot: process.cwd() });
  const v1 = am.record({ id: "x/spec", type: "specification", content: "v1", author: "feature-agent" });
  assert.equal(v1.version, 1);
  assert.equal(v1.status, "draft");

  const v2 = am.record({ id: "x/spec", type: "specification", content: "v2", author: "feature-agent" });
  assert.equal(v2.version, 2);
  assert.equal(v2.history.length, 2);
  assert.equal(am.snapshot("x/spec", 1), "v1");
  assert.equal(am.snapshot("x/spec", 2), "v2");

  // Re-recording identical content does not bump the version.
  const v2again = am.record({ id: "x/spec", type: "specification", content: "v2", author: "feature-agent" });
  assert.equal(v2again.version, 2);
});

test("ArtifactManager tracks status transitions and dependencies", () => {
  const am = new ArtifactManager({ stateDir: tmpDir("artifacts"), repoRoot: process.cwd() });
  am.record({ id: "x/spec", type: "specification", content: "content", author: "feature-agent" });
  am.record({
    id: "x/review",
    type: "product-review",
    content: "review content",
    author: "product-review-agent",
    dependencies: ["x/spec"],
  });
  const updated = am.setStatus("x/review", "approved", "product-review-agent");
  assert.equal(updated.status, "approved");
  assert.ok(ARTIFACT_STATUSES.includes(updated.status));
  assert.deepEqual(am.dependencyGraph()["x/review"], ["x/spec"]);
  assert.throws(() => am.get("nope"), /Unknown artifact/);
});

test("MemoryManager scopes short-term, session, shared, long-term, vector independently", () => {
  const mm = new MemoryManager({ memoryDir: tmpDir("memory") });
  mm.shortTerm("run-a").set("scratch", 1);
  mm.session("sess-1").set("lastCommand", "adf run");
  mm.shared("run-a").append("notes", "backend finished early");
  mm.longTerm().set("facts", ["fact one"]);

  assert.equal(mm.shortTerm("run-a").get("scratch"), 1);
  assert.equal(mm.session("sess-1").get("lastCommand"), "adf run");
  assert.deepEqual(mm.shared("run-a").get("notes"), ["backend finished early"]);
  assert.deepEqual(mm.longTerm().get("facts"), ["fact one"]);

  // A different run does not see run-a's shared memory.
  assert.deepEqual(mm.shared("run-b").all(), {});

  const vec = mm.vector();
  vec.add("fact-1", "always validate input at the API boundary");
  const results = vec.query("input validation boundary");
  assert.equal(results[0].id, "fact-1");
});

test("MemoryManager short-term memory does not persist to disk", () => {
  const dir = tmpDir("memory");
  const mm = new MemoryManager({ memoryDir: dir });
  mm.shortTerm("ephemeral-run").set("x", 1);
  const files = fs.readdirSync(dir);
  assert.equal(files.length, 0);
});

test("ContextManager builds a bundle from artifacts, policies and memory", () => {
  const am = new ArtifactManager({ stateDir: tmpDir("artifacts"), repoRoot: process.cwd() });
  am.record({ id: "demo/spec", type: "specification", content: "The spec body", author: "feature-agent" });
  const mm = new MemoryManager({ memoryDir: tmpDir("memory") });
  mm.shared("run-1").set("note", "context test");

  const cm = new ContextManager({ artifactManager: am, memoryManager: mm, maxContextChars: 500_000 });
  const bundle = cm.build({
    agent: { id: "product-review-agent" },
    workflowRunId: "run-1",
    consumesPaths: ["demo/spec"],
  });

  assert.equal(bundle.artifacts.length, 1);
  assert.equal(bundle.artifacts[0].id, "demo/spec");
  assert.equal(bundle.dependencyIds[0], "demo/spec");
  assert.ok(bundle.toPromptText().includes("The spec body"));
  assert.ok(bundle.toPromptText().includes("context test"));
  assert.equal(bundle.trimmed, false);
});

test("ContextManager trims when the bundle exceeds the character budget", () => {
  const am = new ArtifactManager({ stateDir: tmpDir("artifacts"), repoRoot: process.cwd() });
  am.record({ id: "demo/big", type: "specification", content: "x".repeat(10_000), author: "feature-agent" });
  const mm = new MemoryManager({ memoryDir: tmpDir("memory") });
  mm.longTerm().set("facts", ["fact " + "y".repeat(5000)]);

  const cm = new ContextManager({ artifactManager: am, memoryManager: mm, maxContextChars: 2000 });
  const bundle = cm.build({
    agent: { id: "design-agent" },
    workflowRunId: null,
    consumesPaths: ["demo/big"],
  });

  assert.equal(bundle.trimmed, true);
  assert.ok(bundle.toPromptText().length <= 2500);
  assert.ok(bundle.artifacts[0].content.includes("trimmed"));
});
