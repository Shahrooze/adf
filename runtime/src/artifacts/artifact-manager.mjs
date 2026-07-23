// Artifacts are first-class citizens: every document or code output a
// workflow stage produces is tracked here with an id, type, version,
// author, dependencies and status — independent of where its content
// physically lives on disk (features/<id>/*.md, src/**, etc). The file on
// disk stays the source of truth for content; this manager tracks its
// metadata history and snapshots each version so nothing is silently lost
// when a later stage overwrites a file.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { adfStateDir, REPO_ROOT } from "../config/paths.mjs";

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export const ARTIFACT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "rejected",
  "superseded",
];

export class ArtifactManager {
  constructor({ stateDir = adfStateDir("artifacts"), repoRoot = REPO_ROOT } = {}) {
    this.stateDir = stateDir;
    this.repoRoot = repoRoot;
    this.indexPath = path.join(this.stateDir, "index.json");
    this.historyDir = path.join(this.stateDir, "history");
    fs.mkdirSync(this.historyDir, { recursive: true });
    this._records = this._load();
  }

  _load() {
    if (!fs.existsSync(this.indexPath)) return new Map();
    const data = JSON.parse(fs.readFileSync(this.indexPath, "utf8"));
    return new Map(Object.entries(data));
  }

  _save() {
    const obj = Object.fromEntries(this._records);
    fs.writeFileSync(this.indexPath, JSON.stringify(obj, null, 2) + "\n", "utf8");
  }

  // Registers or updates an artifact from its content directly (used by
  // agent executors that produce content without necessarily having
  // written it to disk yet).
  record({
    id,
    type,
    relPath = null,
    content = null,
    author,
    dependencies = [],
    status = "draft",
    workflowRunId = null,
  }) {
    if (!id) throw new Error("Artifact requires an id");
    if (!type) throw new Error("Artifact requires a type");
    const now = new Date().toISOString();
    const existing = this._records.get(id);
    const hash = content !== null ? sha256(content) : existing?.contentHash ?? null;
    const contentChanged = !existing || existing.contentHash !== hash;

    const version = existing && !contentChanged ? existing.version : (existing?.version ?? 0) + 1;

    if (content !== null && contentChanged) {
      const snapshotDir = path.join(this.historyDir, id.replace(/[\/]/g, "__"));
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, `v${version}.snapshot`), content, "utf8");
    }

    const record = {
      id,
      type,
      relPath: relPath ?? existing?.relPath ?? null,
      version,
      author: author ?? existing?.author ?? "unknown",
      dependencies: dependencies.length ? dependencies : existing?.dependencies ?? [],
      status,
      contentHash: hash,
      workflowRunId: workflowRunId ?? existing?.workflowRunId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      history: [
        ...(existing?.history ?? []),
        ...(contentChanged
          ? [{ version, contentHash: hash, author: author ?? "unknown", timestamp: now, status }]
          : []),
      ],
    };
    this._records.set(id, record);
    this._save();
    return record;
  }

  // Registers/refreshes an artifact directly from a file already on disk
  // (the common case: an agent wrote features/<feature>/design.md).
  recordFromFile(absOrRelPath, { id = null, type, author, dependencies = [], status = "draft", workflowRunId = null }) {
    const absPath = path.isAbsolute(absOrRelPath) ? absOrRelPath : path.join(this.repoRoot, absOrRelPath);
    const relPath = path.relative(this.repoRoot, absPath).split(path.sep).join("/");
    const content = fs.existsSync(absPath) ? fs.readFileSync(absPath, "utf8") : "";
    const artifactId = id ?? relPath;
    return this.record({
      id: artifactId,
      type,
      relPath,
      content,
      author,
      dependencies,
      status,
      workflowRunId,
    });
  }

  setStatus(id, status, author = "system") {
    const record = this.get(id);
    record.status = status;
    record.author = author;
    record.updatedAt = new Date().toISOString();
    this._records.set(id, record);
    this._save();
    return record;
  }

  get(id) {
    const record = this._records.get(id);
    if (!record) throw new Error(`Unknown artifact "${id}"`);
    return record;
  }

  has(id) {
    return this._records.has(id);
  }

  list({ type = null, status = null, workflowRunId = null } = {}) {
    return [...this._records.values()].filter(
      (r) =>
        (type === null || r.type === type) &&
        (status === null || r.status === status) &&
        (workflowRunId === null || r.workflowRunId === workflowRunId)
    );
  }

  history(id) {
    return this.get(id).history;
  }

  snapshot(id, version) {
    const snapshotDir = path.join(this.historyDir, id.replace(/[\/]/g, "__"));
    const file = path.join(snapshotDir, `v${version}.snapshot`);
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  }

  // Resolves the current content for an artifact: prefers the live file on
  // disk (record.relPath) so edits made outside the manager are picked up,
  // and falls back to the last recorded snapshot for content-only
  // artifacts that were never backed by a file.
  readContent(id) {
    const record = this.get(id);
    if (record.relPath) {
      const absPath = path.join(this.repoRoot, record.relPath);
      if (fs.existsSync(absPath)) return fs.readFileSync(absPath, "utf8");
    }
    return this.snapshot(id, record.version);
  }

  dependencyGraph() {
    const graph = {};
    for (const record of this._records.values()) {
      graph[record.id] = record.dependencies;
    }
    return graph;
  }
}
