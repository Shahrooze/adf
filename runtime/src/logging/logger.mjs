// Structured, append-only JSONL logging for every runtime execution.
//
// Every log record is a single JSON object per line (JSONL), so logs can be
// tailed, grepped, or streamed without buffering a whole file. `adf logs`
// reads these files back.
import fs from "node:fs";
import path from "node:path";
import { adfStateDir } from "../config/paths.mjs";

export const LOG_FIELDS = [
  "timestamp",
  "level",
  "workflowRunId",
  "agentId",
  "toolCalls",
  "durationMs",
  "artifacts",
  "error",
  "retryCount",
  "tokenUsage",
  "message",
];

export class Logger {
  // A single Logger instance is shared by the whole Harness and may log
  // entries for many different workflow runs over its lifetime (the CLI
  // constructs one Harness per invocation, but a long-lived REST server
  // reuses one Harness across many runs). Each entry is therefore routed
  // to the log file matching ITS OWN workflowRunId — falling back to
  // `runId` passed at construction (useful for tests/child loggers scoped
  // to one run), and finally to a shared "runtime.jsonl" for entries with
  // no run at all (e.g. plugin loading at startup).
  constructor({ runId = null, logDir } = {}) {
    this.runId = runId;
    this.logDir = logDir || adfStateDir("logs");
    fs.mkdirSync(this.logDir, { recursive: true });
  }

  _filePathFor(workflowRunId) {
    const id = workflowRunId ?? this.runId ?? "runtime";
    return path.join(this.logDir, `${id}.jsonl`);
  }

  _write(record) {
    const line = JSON.stringify(record);
    fs.appendFileSync(this._filePathFor(record.workflowRunId), line + "\n", "utf8");
    return record;
  }

  log(level, message, fields = {}) {
    return this._write({
      timestamp: new Date().toISOString(),
      level,
      workflowRunId: fields.workflowRunId ?? this.runId ?? null,
      agentId: fields.agentId ?? null,
      toolCalls: fields.toolCalls ?? undefined,
      durationMs: fields.durationMs ?? undefined,
      artifacts: fields.artifacts ?? undefined,
      error: fields.error ?? undefined,
      retryCount: fields.retryCount ?? undefined,
      tokenUsage: fields.tokenUsage ?? undefined,
      message,
    });
  }

  info(message, fields) {
    return this.log("info", message, fields);
  }
  warn(message, fields) {
    return this.log("warn", message, fields);
  }
  error(message, fields) {
    return this.log("error", message, fields);
  }
  debug(message, fields) {
    return this.log("debug", message, fields);
  }

  child(extra) {
    const parent = this;
    return {
      info: (m, f) => parent.log("info", m, { ...extra, ...f }),
      warn: (m, f) => parent.log("warn", m, { ...extra, ...f }),
      error: (m, f) => parent.log("error", m, { ...extra, ...f }),
      debug: (m, f) => parent.log("debug", m, { ...extra, ...f }),
    };
  }

  static readRun(runId, logDir) {
    const dir = logDir || adfStateDir("logs");
    const filePath = path.join(dir, `${runId}.jsonl`);
    if (!fs.existsSync(filePath)) return [];
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return { level: "error", message: `unparsable log line: ${line}` };
        }
      });
  }

  static listRuns(logDir) {
    const dir = logDir || adfStateDir("logs");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.replace(/\.jsonl$/, ""))
      .sort();
  }
}
