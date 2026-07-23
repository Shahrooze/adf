// Persists workflow run state to disk after every stage so a run can
// survive an interrupted process (crash, container recycle, Ctrl-C) and
// be resumed later with `adf resume <runId>` instead of starting over.
import fs from "node:fs";
import path from "node:path";
import { adfStateDir } from "../config/paths.mjs";

export class CheckpointStore {
  constructor({ dir = adfStateDir("checkpoints") } = {}) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  _filePath(runId) {
    return path.join(this.dir, `${runId}.json`);
  }

  save(runId, state) {
    const payload = { ...state, checkpointedAt: new Date().toISOString() };
    fs.writeFileSync(this._filePath(runId), JSON.stringify(payload, null, 2) + "\n", "utf8");
    return payload;
  }

  load(runId) {
    const file = this._filePath(runId);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  exists(runId) {
    return fs.existsSync(this._filePath(runId));
  }

  delete(runId) {
    const file = this._filePath(runId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  list() {
    if (!fs.existsSync(this.dir)) return [];
    return fs
      .readdirSync(this.dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  }
}
