import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { parseYaml, parseYamlFile } from "../src/yaml/yaml-lite.mjs";
import { REPO_ROOT } from "../src/config/paths.mjs";
import fs from "node:fs";

test("parses scalars: strings, numbers, booleans, null", () => {
  const doc = parseYaml(`
name: Feature Agent
version: 3.0.0
count: 12
ratio: 1.5
enabled: true
disabled: false
nothing: ~
`);
  assert.equal(doc.name, "Feature Agent");
  assert.equal(doc.version, "3.0.0");
  assert.equal(doc.count, 12);
  assert.equal(doc.ratio, 1.5);
  assert.equal(doc.enabled, true);
  assert.equal(doc.disabled, false);
  assert.equal(doc.nothing, null);
});

test("parses block sequences and nested mappings", () => {
  const doc = parseYaml(`
inputs:
  - a
  - b
quality_gate:
  required_sections:
    - Summary
    - Risks
`);
  assert.deepEqual(doc.inputs, ["a", "b"]);
  assert.deepEqual(doc.quality_gate.required_sections, ["Summary", "Risks"]);
});

test("parses a sequence of mappings (workflow stages)", () => {
  const doc = parseYaml(`
stages:
  - id: feature
    agent: feature-agent
    produces:
      - specification.md
    gate:
      name: Feature Gate
      status: READY_FOR_PRODUCT_REVIEW
  - id: design
    agent: design-agent
`);
  assert.equal(doc.stages.length, 2);
  assert.equal(doc.stages[0].id, "feature");
  assert.equal(doc.stages[0].gate.name, "Feature Gate");
  assert.deepEqual(doc.stages[0].produces, ["specification.md"]);
  assert.equal(doc.stages[1].id, "design");
});

test("parses literal (|) and folded (>) block scalars", () => {
  const doc = parseYaml(`
literal: |
  line one
  line two

folded: >
  word one
  word two
`);
  assert.equal(doc.literal, "line one\nline two\n");
  assert.equal(doc.folded, "word one word two\n");
});

test("folds multi-line plain and quoted scalar continuations", () => {
  const doc = parseYaml(`
must_not:
  - Write or change source code before the documentation it must match has
    been updated
  - "Simple: documentation updated to the correct behavior, code fixed to
    match it, regression test added"
`);
  assert.equal(
    doc.must_not[0],
    "Write or change source code before the documentation it must match has been updated"
  );
  assert.equal(
    doc.must_not[1],
    "Simple: documentation updated to the correct behavior, code fixed to match it, regression test added"
  );
});

test("a blank line between a key and its nested block does not truncate parsing", () => {
  const doc = parseYaml(`
definition_of_done:

  - item one
  - item two

next_agent: architecture-review-agent
`);
  assert.deepEqual(doc.definition_of_done, ["item one", "item two"]);
  assert.equal(doc.next_agent, "architecture-review-agent");
});

test("strips comments outside of quoted strings", () => {
  const doc = parseYaml(`
a: 1 # comment
b: "value # not a comment"
`);
  assert.equal(doc.a, 1);
  assert.equal(doc.b, "value # not a comment");
});

test("every real agent.yaml in the repo parses with expected top-level keys", () => {
  const agentsDir = path.join(REPO_ROOT, "agents");
  const dirs = fs.readdirSync(agentsDir).filter((d) =>
    fs.statSync(path.join(agentsDir, d)).isDirectory()
  );
  assert.ok(dirs.length >= 12);
  for (const dir of dirs) {
    const file = path.join(agentsDir, dir, "agent.yaml");
    const doc = parseYamlFile(file);
    assert.ok(doc.id, `${file} missing id`);
    assert.ok(doc.name, `${file} missing name`);
    assert.ok(Array.isArray(doc.capabilities) && doc.capabilities.length > 0, `${file} missing capabilities`);
    assert.ok(Array.isArray(doc.tools) && doc.tools.length > 0, `${file} missing tools`);
    assert.ok(
      Array.isArray(doc.supported_artifacts) && doc.supported_artifacts.length > 0,
      `${file} missing supported_artifacts`
    );
  }
});

test("workflows/feature-development.yaml parses all 12 stages with gates intact", () => {
  const wf = parseYamlFile(path.join(REPO_ROOT, "workflows", "feature-development.yaml"));
  assert.equal(wf.id, "feature-development");
  assert.equal(wf.stages.length, 12);
  const backend = wf.stages.find((s) => s.id === "backend-implementation");
  assert.equal(backend.agent, "backend-agent");
  assert.equal(backend.gate.status, "READY_FOR_FRONTEND");
  assert.ok(wf.rules.length > 0);
});
