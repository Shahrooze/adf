// Turns a run's raw JSONL log into a chronological, human-readable
// timeline: every entry with its offset from the run's first log line.
export function buildTimeline(logEntries) {
  if (!logEntries.length) return [];
  const t0 = new Date(logEntries[0].timestamp).getTime();
  return logEntries.map((entry) => ({
    offsetMs: new Date(entry.timestamp).getTime() - t0,
    timestamp: entry.timestamp,
    level: entry.level,
    agentId: entry.agentId,
    message: entry.message,
    durationMs: entry.durationMs ?? null,
    retryCount: entry.retryCount ?? null,
  }));
}

export function renderTimelineText(timeline) {
  return timeline
    .map((e) => `[+${String(e.offsetMs).padStart(6, " ")}ms] ${e.level.toUpperCase().padEnd(5)} ${e.agentId ? `(${e.agentId}) ` : ""}${e.message}`)
    .join("\n");
}
