// Discovers every declarative workflow definition under workflows/*.yaml.
// This module only does discovery + raw parsing; workflow/workflow-parser.mjs
// turns the raw document into the normalized execution graph the Workflow
// Engine actually runs (sequential / parallel / conditional stages).
import fs from "node:fs";
import path from "node:path";
import { parseYamlFile } from "../yaml/yaml-lite.mjs";
import { WORKFLOWS_DIR } from "../config/paths.mjs";

export class WorkflowRegistry {
  constructor({ workflowsDir = WORKFLOWS_DIR } = {}) {
    this.workflowsDir = workflowsDir;
    this._workflows = new Map();
    this._errors = [];
  }

  discover() {
    this._workflows.clear();
    this._errors = [];
    if (!fs.existsSync(this.workflowsDir)) return this;

    const files = fs
      .readdirSync(this.workflowsDir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .sort();

    for (const file of files) {
      const filePath = path.join(this.workflowsDir, file);
      try {
        const raw = parseYamlFile(filePath);
        if (!raw.id) throw new Error("workflow yaml missing required field \"id\"");
        if (this._workflows.has(raw.id)) {
          throw new Error(`duplicate workflow id "${raw.id}" (file "${file}")`);
        }
        this._workflows.set(raw.id, { raw, filePath, file });
      } catch (err) {
        this._errors.push({ file, filePath, error: err.message });
      }
    }
    return this;
  }

  errors() {
    return this._errors;
  }

  list() {
    return [...this._workflows.values()];
  }

  get(id) {
    const wf = this._workflows.get(id);
    if (!wf) {
      throw new Error(
        `Unknown workflow "${id}". Known workflows: ${[...this._workflows.keys()].join(", ") || "(none)"}`
      );
    }
    return wf;
  }

  has(id) {
    return this._workflows.has(id);
  }

  register(id, raw, filePath = null) {
    this._workflows.set(id, { raw, filePath, file: filePath ? path.basename(filePath) : null });
  }
}

export function loadWorkflowRegistry(opts) {
  return new WorkflowRegistry(opts).discover();
}
