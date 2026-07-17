import test from "node:test";
import assert from "node:assert/strict";
import {
  ruleManifestPresent,
  ruleRequiredFields,
  ruleIdConsistency,
  ruleReferences,
  ruleCircularDependencies,
  ruleOrphanFiles,
  ruleIncompleteRelease,
  ruleInconsistentGate,
} from "../lib/validate-rules.mjs";
import { STAGES } from "../lib/workflow-stages.mjs";

// Minimal synthetic records — the rule functions are pure over this shape,
// so tests never touch the real repository's features/**.
function record(overrides = {}) {
  return {
    name: "FEAT-100-test",
    expectedId: "FEAT-100",
    archived: false,
    manifest: {
      id: "FEAT-100",
      name: "Test Feature",
      priority: "Medium",
      owner: "Engineering",
      dependencies: [],
      related_features: [],
    },
    derived: { gates: {}, documents: {}, status_summary: {} },
    orphans: [],
    ...overrides,
  };
}

test("ruleManifestPresent flags a missing feature.json", () => {
  const findings = ruleManifestPresent([record({ manifest: null })]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "missing-manifest");
});

test("ruleRequiredFields flags missing fields and bad priority", () => {
  const findings = ruleRequiredFields([
    record({ manifest: { id: "FEAT-100", dependencies: [], related_features: [] } }),
    record({ name: "FEAT-101-test", manifest: { id: "FEAT-101", name: "X", priority: "Urgent", owner: "Eng" } }),
  ]);
  const codes = findings.map((f) => f.code);
  assert.ok(codes.includes("missing-field"));
  assert.ok(codes.includes("invalid-priority"));
});

test("ruleIdConsistency flags id mismatch and duplicate ids", () => {
  const a = record({ manifest: { id: "FEAT-999", name: "A", priority: "Low", owner: "Eng" } });
  const b = record({ name: "FEAT-100-b", expectedId: "FEAT-100", manifest: { id: "FEAT-100", name: "B", priority: "Low", owner: "Eng" } });
  const findings = ruleIdConsistency([a, b]);
  assert.ok(findings.some((f) => f.code === "id-mismatch"));
});

test("ruleIdConsistency flags duplicate ids across two directories", () => {
  const a = record({ name: "FEAT-100-a" });
  const b = record({ name: "FEAT-100-b" });
  const findings = ruleIdConsistency([a, b]);
  assert.ok(findings.some((f) => f.code === "duplicate-id"));
});

test("ruleReferences flags self-reference and broken reference", () => {
  const r = record({ manifest: { id: "FEAT-100", name: "A", priority: "Low", owner: "Eng", dependencies: ["FEAT-100", "FEAT-999"], related_features: [] } });
  const findings = ruleReferences([r]);
  assert.ok(findings.some((f) => f.code === "self-reference"));
  assert.ok(findings.some((f) => f.code === "broken-reference"));
});

test("ruleReferences allows a reference to a real feature", () => {
  const a = record({ name: "FEAT-100-a", expectedId: "FEAT-100", manifest: { id: "FEAT-100", name: "A", priority: "Low", owner: "Eng", dependencies: [], related_features: [] } });
  const b = record({ name: "FEAT-101-b", expectedId: "FEAT-101", manifest: { id: "FEAT-101", name: "B", priority: "Low", owner: "Eng", dependencies: ["FEAT-100"], related_features: [] } });
  assert.equal(ruleReferences([a, b]).length, 0);
});

test("ruleCircularDependencies detects a two-node cycle", () => {
  const a = record({ name: "FEAT-100-a", expectedId: "FEAT-100", manifest: { id: "FEAT-100", name: "A", priority: "Low", owner: "Eng", dependencies: ["FEAT-101"], related_features: [] } });
  const b = record({ name: "FEAT-101-b", expectedId: "FEAT-101", manifest: { id: "FEAT-101", name: "B", priority: "Low", owner: "Eng", dependencies: ["FEAT-100"], related_features: [] } });
  const findings = ruleCircularDependencies([a, b]);
  assert.ok(findings.length >= 1);
  assert.equal(findings[0].code, "circular-dependency");
});

test("ruleCircularDependencies passes a DAG", () => {
  const a = record({ name: "FEAT-100-a", expectedId: "FEAT-100" });
  const b = record({ name: "FEAT-101-b", expectedId: "FEAT-101", manifest: { id: "FEAT-101", name: "B", priority: "Low", owner: "Eng", dependencies: ["FEAT-100"], related_features: [] } });
  assert.equal(ruleCircularDependencies([a, b]).length, 0);
});

test("ruleOrphanFiles surfaces undeclared extra files as warnings", () => {
  const findings = ruleOrphanFiles([record({ orphans: ["notes.md"] })]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warning");
  assert.equal(findings[0].code, "orphan-file");
});

test("ruleIncompleteRelease flags RELEASE_READY with an unsatisfied earlier gate", () => {
  const gates = Object.fromEntries(STAGES.map((s) => [s.id, s.readyStatus]));
  gates["backend-implementation"] = null; // simulate a missing/blocked stage
  const findings = ruleIncompleteRelease([record({ derived: { gates, documents: { "backend-implementation": null }, status_summary: {} } })]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, "incomplete-release");
});

test("ruleIncompleteRelease passes a feature with every gate satisfied", () => {
  const gates = Object.fromEntries(STAGES.map((s) => [s.id, s.readyStatus]));
  const findings = ruleIncompleteRelease([record({ derived: { gates, documents: {}, status_summary: {} } })]);
  assert.equal(findings.length, 0);
});

test("ruleIncompleteRelease ignores archived features", () => {
  const findings = ruleIncompleteRelease([
    record({ archived: true, derived: { gates: { "code-review": "RELEASE_READY" }, documents: {}, status_summary: {} } }),
  ]);
  assert.equal(findings.length, 0);
});

test("ruleInconsistentGate warns when an artifact's status doesn't match its own gate", () => {
  const documents = { feature: { file: "specification.md", status: "READY_FOR_DESIGN", recommendation: null } };
  const findings = ruleInconsistentGate([record({ derived: { gates: {}, documents, status_summary: {} } })]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, "warning");
  assert.equal(findings[0].code, "gate-not-satisfied");
});
