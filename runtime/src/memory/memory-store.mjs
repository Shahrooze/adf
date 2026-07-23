// Memory is abstracted behind one small interface (get/set/append/all/
// clear) with two backends today — in-process (short-term, ephemeral) and
// file-backed (session / shared / long-term, persisted under .adf/memory).
// A future vector-backed implementation only has to satisfy the same
// interface to slot in; see VectorMemory below for the forward-compatible
// stub.
import fs from "node:fs";
import path from "node:path";
import { adfStateDir } from "../config/paths.mjs";

class Scope {
  constructor(backend, namespace) {
    this.backend = backend;
    this.namespace = namespace;
  }
  get(key, defaultValue = null) {
    const all = this.backend.read(this.namespace);
    return key in all ? all[key] : defaultValue;
  }
  set(key, value) {
    const all = this.backend.read(this.namespace);
    all[key] = value;
    this.backend.write(this.namespace, all);
  }
  append(key, value) {
    const all = this.backend.read(this.namespace);
    const list = Array.isArray(all[key]) ? all[key] : [];
    list.push(value);
    all[key] = list;
    this.backend.write(this.namespace, all);
    return list;
  }
  all() {
    return this.backend.read(this.namespace);
  }
  clear() {
    this.backend.write(this.namespace, {});
  }
}

class InMemoryBackend {
  constructor() {
    this._store = new Map();
  }
  read(namespace) {
    return this._store.get(namespace) ?? {};
  }
  write(namespace, value) {
    this._store.set(namespace, value);
  }
}

class FileBackend {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }
  _filePath(namespace) {
    return path.join(this.dir, `${namespace.replace(/[\/]/g, "__")}.json`);
  }
  read(namespace) {
    const file = this._filePath(namespace);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  write(namespace, value) {
    fs.writeFileSync(this._filePath(namespace), JSON.stringify(value, null, 2) + "\n", "utf8");
  }
}

// Forward-compatible stub: today it does naive substring relevance ranking
// over long-term memory facts. A real embedding-backed implementation can
// replace `_rank` without changing the public add()/query() contract that
// callers (context manager, agents) already depend on.
export class VectorMemory {
  constructor(backend, namespace = "vector") {
    this.scope = new Scope(backend, namespace);
  }
  add(id, text, metadata = {}) {
    const entries = this.scope.get("entries", []);
    entries.push({ id, text, metadata, addedAt: new Date().toISOString() });
    this.scope.set("entries", entries);
  }
  query(text, { topK = 5 } = {}) {
    const entries = this.scope.get("entries", []);
    const terms = text.toLowerCase().split(/\W+/).filter(Boolean);
    const scored = entries.map((e) => {
      const hay = e.text.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { ...e, score };
    });
    return scored
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

export class MemoryManager {
  constructor({ memoryDir = adfStateDir("memory"), shortTermMaxEntries = 200 } = {}) {
    this.fileBackend = new FileBackend(memoryDir);
    this.inMemoryBackend = new InMemoryBackend();
    this.shortTermMaxEntries = shortTermMaxEntries;
  }

  // Ephemeral, process-local — scoped to a single agent execution and
  // never persisted. Used for scratch reasoning state within one run.
  shortTerm(runId) {
    return new Scope(this.inMemoryBackend, `short-term/${runId}`);
  }

  // Persisted per user/CLI session — survives across separate `adf run`
  // invocations by the same operator.
  session(sessionId) {
    return new Scope(this.fileBackend, `session/${sessionId}`);
  }

  // Persisted per workflow run — the notes/decisions every agent inside
  // one workflow execution can read and write, so stage N can see what
  // stage N-1 learned beyond just its produced artifact.
  shared(workflowRunId) {
    return new Scope(this.fileBackend, `shared/${workflowRunId}`);
  }

  // Persisted globally for the whole project — accumulates durable facts
  // (naming conventions learned, recurring gotchas) across every run.
  longTerm() {
    return new Scope(this.fileBackend, "long-term");
  }

  vector() {
    return new VectorMemory(this.fileBackend, "vector");
  }
}

let sharedManager = null;
export function getMemoryManager(opts) {
  if (!sharedManager) sharedManager = new MemoryManager(opts);
  return sharedManager;
}
