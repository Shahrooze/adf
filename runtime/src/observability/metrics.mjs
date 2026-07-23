// Aggregates the structured JSONL log for one run (see logging/logger.mjs)
// into per-agent and per-tool metrics. Relies only on the fields the
// Logger already always sets — toolCalls marks a tool-call log line,
// agentId + durationMs with no toolCalls marks an agent lifecycle
// terminal event — so this stays correct as long as call sites keep
// logging through Logger, without needing to pattern-match message text.
export function computeMetrics(logEntries) {
  const agents = {};
  const tools = {};
  let retries = 0;

  for (const entry of logEntries) {
    if (entry.retryCount) retries += entry.retryCount;

    if (Array.isArray(entry.toolCalls) && entry.toolCalls.length) {
      for (const call of entry.toolCalls) {
        const bucket = (tools[call.toolId] ??= { toolId: call.toolId, calls: 0, totalDurationMs: 0, failures: 0 });
        bucket.calls++;
        if (typeof entry.durationMs === "number") bucket.totalDurationMs += entry.durationMs;
        if (entry.level === "error") bucket.failures++;
      }
      continue;
    }

    if (entry.agentId && typeof entry.durationMs === "number") {
      const bucket = (agents[entry.agentId] ??= { agentId: entry.agentId, executions: 0, totalDurationMs: 0, failures: 0, retries: 0 });
      bucket.executions++;
      bucket.totalDurationMs += entry.durationMs;
      bucket.retries += entry.retryCount ?? 0;
      if (entry.level === "error" || entry.level === "warn") bucket.failures += entry.level === "error" ? 1 : 0;
    }
  }

  const agentList = Object.values(agents).map((a) => ({ ...a, avgDurationMs: Math.round(a.totalDurationMs / a.executions) }));
  const toolList = Object.values(tools).map((t) => ({ ...t, avgDurationMs: Math.round(t.totalDurationMs / t.calls) }));

  return {
    totalLogEntries: logEntries.length,
    totalRetries: retries,
    errorCount: logEntries.filter((e) => e.level === "error").length,
    warnCount: logEntries.filter((e) => e.level === "warn").length,
    agents: agentList,
    tools: toolList,
  };
}
