import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Logger } from "../src/logging/logger.mjs";
import { computeMetrics } from "../src/observability/metrics.mjs";
import { buildTimeline, renderTimelineText } from "../src/observability/timeline.mjs";
import { renderMermaidFlowchart, renderRunReport } from "../src/observability/report.mjs";
import { parseWorkflow } from "../src/workflow/workflow-parser.mjs";
import { loadWorkflowRegistry } from "../src/registry/workflow-registry.mjs";

function tmpLogDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "adf-observability-"));
}

test("Logger writes structured JSONL with the required fields and reads it back", () => {
  const logDir = tmpLogDir();
  const logger = new Logger({ runId: "run-1", logDir });
  logger.info("Agent started", { agentId: "backend-agent" });
  logger.error("Tool failed", { agentId: "backend-agent", toolCalls: [{ toolId: "terminal" }], durationMs: 42, retryCount: 1, error: "boom" });

  const entries = Logger.readRun("run-1", logDir);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].workflowRunId, "run-1");
  assert.equal(entries[1].error, "boom");
  assert.equal(entries[1].retryCount, 1);
  assert.deepEqual(Logger.listRuns(logDir), ["run-1"]);
});

test("computeMetrics aggregates agent executions and tool calls separately", () => {
  const entries = [
    { level: "info", agentId: "backend-agent", durationMs: 100, retryCount: 0, message: "Agent completed" },
    { level: "info", agentId: "backend-agent", durationMs: 200, retryCount: 1, message: "Agent completed" },
    { level: "info", toolCalls: [{ toolId: "fs" }], durationMs: 5, message: "Tool succeeded" },
    { level: "error", toolCalls: [{ toolId: "terminal" }], durationMs: 10, message: "Tool failed" },
  ];
  const metrics = computeMetrics(entries);
  const backend = metrics.agents.find((a) => a.agentId === "backend-agent");
  assert.equal(backend.executions, 2);
  assert.equal(backend.avgDurationMs, 150);
  assert.equal(backend.retries, 1);

  const fsTool = metrics.tools.find((t) => t.toolId === "fs");
  assert.equal(fsTool.calls, 1);
  const terminalTool = metrics.tools.find((t) => t.toolId === "terminal");
  assert.equal(terminalTool.failures, 1);
  assert.equal(metrics.errorCount, 1);
});

test("buildTimeline computes offsets relative to the first log entry", () => {
  const entries = [
    { timestamp: "2026-01-01T00:00:00.000Z", level: "info", message: "start" },
    { timestamp: "2026-01-01T00:00:00.500Z", level: "info", message: "middle" },
    { timestamp: "2026-01-01T00:00:01.000Z", level: "info", message: "end" },
  ];
  const timeline = buildTimeline(entries);
  assert.deepEqual(timeline.map((e) => e.offsetMs), [0, 500, 1000]);
  const text = renderTimelineText(timeline);
  assert.match(text, /\+\s*0ms.*start/);
  assert.match(text, /\+\s*1000ms.*end/);
});

test("renderMermaidFlowchart marks passed/failed stages and expands parallel branches", () => {
  const registry = loadWorkflowRegistry();
  const def = parseWorkflow(registry.get("parallel-development").raw);
  const runResult = {
    stageResults: {
      product: { stageId: "product", status: "completed", passed: true },
      architecture: { stageId: "architecture", status: "completed", passed: true },
      "backend-implementation": { stageId: "backend-implementation", status: "failed", passed: false },
      "frontend-implementation": { stageId: "frontend-implementation", status: "completed", passed: true },
    },
  };
  const mermaid = renderMermaidFlowchart(def, runResult);
  assert.match(mermaid, /flowchart TD/);
  assert.match(mermaid, /product ✓/);
  assert.match(mermaid, /backend-implementation ✗/);
  assert.match(mermaid, /implementation --> backend-implementation/);
});

test("renderRunReport combines stages, diagram, metrics and timeline into one report", () => {
  const registry = loadWorkflowRegistry();
  const def = parseWorkflow(registry.get("feature-development").raw);
  const runResult = {
    id: "run-report-test",
    status: "completed",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:00:05.000Z",
    error: null,
    stageResults: { feature: { stageId: "feature", status: "completed", passed: true, retryCount: 0 } },
  };
  const logEntries = [
    { timestamp: "2026-01-01T00:00:00.000Z", level: "info", agentId: "feature-agent", durationMs: 10, message: "Agent completed" },
  ];
  const report = renderRunReport({ workflowDefinition: def, runResult, logEntries });
  assert.match(report, /# Execution Report/);
  assert.match(report, /```mermaid/);
  assert.match(report, /## Agent Metrics/);
  assert.match(report, /## Timeline/);
  assert.match(report, /feature-agent/);
});
