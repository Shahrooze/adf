// Renders a single, human-readable execution report for a workflow run:
// stage-by-stage results, a Mermaid flowchart of the workflow (so
// "workflow visualization" is a diagram anyone can paste into a Markdown
// viewer, not just a mental model), agent/tool metrics, and the full
// timeline. `adf status --report` and `adf logs --report` both go through
// this.
import { computeMetrics } from "./metrics.mjs";
import { buildTimeline, renderTimelineText } from "./timeline.mjs";

function stageLabel(stageId, stageResults) {
  const result = stageResults[stageId];
  if (!result) return stageId;
  if (result.skipped) return `${stageId} (skipped)`;
  return result.passed ? `${stageId} ✓` : `${stageId} ✗`;
}

export function renderMermaidFlowchart(workflowDefinition, runResult) {
  const lines = ["flowchart TD"];
  const stageResults = runResult?.stageResults ?? {};

  for (const stage of workflowDefinition.stages) {
    if (stage.type === "parallel") {
      lines.push(`  ${stage.id}{{"${stage.id} (parallel)"}}`);
      for (const branch of stage.branches) {
        lines.push(`  ${branch.id}(["${stageLabel(branch.id, stageResults)}"])`);
        lines.push(`  ${stage.id} --> ${branch.id}`);
      }
    } else {
      lines.push(`  ${stage.id}["${stageLabel(stage.id, stageResults)}"]`);
    }
  }
  for (let i = 0; i < workflowDefinition.stages.length - 1; i++) {
    lines.push(`  ${workflowDefinition.stages[i].id} --> ${workflowDefinition.stages[i + 1].id}`);
  }
  return lines.join("\n");
}

export function renderRunReport({ workflowDefinition, runResult, logEntries = [] }) {
  const metrics = computeMetrics(logEntries);
  const timeline = buildTimeline(logEntries);
  const sections = [];

  sections.push(`# Execution Report: ${workflowDefinition.name} (run ${runResult.id})`);
  sections.push(`Status: **${runResult.status}**${runResult.error ? ` — ${runResult.error}` : ""}`);
  sections.push(`Started: ${runResult.startedAt ?? "n/a"}  \nEnded: ${runResult.endedAt ?? "n/a"}`);

  sections.push("## Stages\n\n| Stage | Status | Retries | Error |\n| --- | --- | --- | --- |\n" +
    Object.values(runResult.stageResults)
      .map((r) => `| ${r.stageId} | ${r.skipped ? "skipped" : r.status} | ${r.retryCount ?? 0} | ${r.error ?? ""} |`)
      .join("\n"));

  sections.push("## Workflow Diagram\n\n```mermaid\n" + renderMermaidFlowchart(workflowDefinition, runResult) + "\n```");

  sections.push(
    "## Agent Metrics\n\n| Agent | Executions | Avg Duration (ms) | Retries |\n| --- | --- | --- | --- |\n" +
      (metrics.agents.length
        ? metrics.agents.map((a) => `| ${a.agentId} | ${a.executions} | ${a.avgDurationMs} | ${a.retries} |`).join("\n")
        : "| (no agent metrics recorded) | | | |")
  );

  sections.push(
    "## Tool Metrics\n\n| Tool | Calls | Avg Duration (ms) | Failures |\n| --- | --- | --- | --- |\n" +
      (metrics.tools.length
        ? metrics.tools.map((t) => `| ${t.toolId} | ${t.calls} | ${t.avgDurationMs} | ${t.failures} |`).join("\n")
        : "| (no tool metrics recorded) | | | |")
  );

  sections.push("## Timeline\n\n```\n" + (timeline.length ? renderTimelineText(timeline) : "(no log entries)") + "\n```");

  return sections.join("\n\n");
}
