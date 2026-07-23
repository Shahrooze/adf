// Registers every known artifact type (config/artifact-types.json) so the
// Artifact Manager and Context Manager can validate an artifact's type,
// resolve its template, and know who produces/consumes it — instead of
// each caller hardcoding a list of "the eleven report kinds".
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR, TEMPLATES_DIR } from "../config/paths.mjs";

export class ArtifactTypeDescriptor {
  constructor({ id, name, template, producedBy, consumedBy }) {
    this.id = id;
    this.name = name ?? id;
    this.template = template ?? null;
    this.producedBy = producedBy ?? [];
    this.consumedBy = consumedBy ?? [];
  }

  templatePath() {
    return this.template ? path.join(TEMPLATES_DIR, this.template) : null;
  }

  templateExists() {
    const p = this.templatePath();
    return p !== null && fs.existsSync(p);
  }
}

export class ArtifactTypeRegistry {
  constructor({ configPath = path.join(CONFIG_DIR, "artifact-types.json") } = {}) {
    this.configPath = configPath;
    this._types = new Map();
  }

  discover() {
    this._types.clear();
    if (!fs.existsSync(this.configPath)) return this;
    const data = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
    for (const entry of data.artifactTypes || []) {
      this.register(new ArtifactTypeDescriptor(entry));
    }
    return this;
  }

  register(descriptor) {
    const d = descriptor instanceof ArtifactTypeDescriptor ? descriptor : new ArtifactTypeDescriptor(descriptor);
    this._types.set(d.id, d);
    return d;
  }

  list() {
    return [...this._types.values()];
  }

  get(id) {
    const type = this._types.get(id);
    if (!type) {
      throw new Error(
        `Unknown artifact type "${id}". Known types: ${[...this._types.keys()].join(", ") || "(none)"}`
      );
    }
    return type;
  }

  has(id) {
    return this._types.has(id);
  }

  producedByAgent(agentId) {
    return this.list().filter((t) => t.producedBy.includes(agentId));
  }

  consumedByAgent(agentId) {
    return this.list().filter((t) => t.consumedBy.includes(agentId));
  }
}

export function loadArtifactTypeRegistry(opts) {
  return new ArtifactTypeRegistry(opts).discover();
}
