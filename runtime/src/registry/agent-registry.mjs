// Agents are no longer hardcoded anywhere in the Harness. Every agent
// registers itself simply by existing as agents/<dir>/agent.yaml — this
// module discovers, parses and validates every one of them into a plain
// AgentDescriptor the rest of the runtime can consume.
import fs from "node:fs";
import path from "node:path";
import { parseYamlFile } from "../yaml/yaml-lite.mjs";
import { AGENTS_DIR } from "../config/paths.mjs";

const REQUIRED_FIELDS = ["id", "name"];

export class AgentDescriptor {
  constructor(raw, dir, systemPromptPath, instructionsPath) {
    this.id = raw.id;
    this.name = raw.name;
    this.version = raw.version ?? "0.0.0";
    this.description = (raw.description ?? "").trim();
    this.owner = raw.owner ?? null;
    this.stage = raw.stage ?? null;
    this.status = raw.status ?? "Stable";
    this.capabilities = raw.capabilities ?? [];
    this.requiredTools = raw.tools ?? ["fs"];
    this.supportedArtifacts = raw.supported_artifacts ?? [];
    this.inputs = raw.inputs ?? raw.input ?? null;
    this.outputs = raw.outputs ?? raw.output ?? null;
    this.consumes = raw.consumes ?? raw.reads ?? [];
    this.produces = raw.produces ?? raw.writes ?? [];
    this.nextAgent = raw.next_agent && raw.next_agent !== "none" ? raw.next_agent : null;
    this.dir = dir;
    this.systemPromptPath = systemPromptPath;
    this.instructionsPath = instructionsPath;
    this.raw = raw;
  }

  systemPrompt() {
    return fs.existsSync(this.systemPromptPath)
      ? fs.readFileSync(this.systemPromptPath, "utf8")
      : "";
  }

  instructions() {
    return fs.existsSync(this.instructionsPath)
      ? fs.readFileSync(this.instructionsPath, "utf8")
      : "";
  }

  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  requiresTool(toolId) {
    return this.requiredTools.includes(toolId);
  }
}

export class AgentRegistry {
  constructor({ agentsDir = AGENTS_DIR } = {}) {
    this.agentsDir = agentsDir;
    this._agents = new Map();
    this._errors = [];
  }

  discover() {
    this._agents.clear();
    this._errors = [];
    if (!fs.existsSync(this.agentsDir)) return this;

    const dirs = fs
      .readdirSync(this.agentsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    for (const dir of dirs) {
      const manifestPath = path.join(this.agentsDir, dir, "agent.yaml");
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const raw = parseYamlFile(manifestPath);
        for (const field of REQUIRED_FIELDS) {
          if (!raw[field]) {
            throw new Error(`agent.yaml missing required field "${field}"`);
          }
        }
        const descriptor = new AgentDescriptor(
          raw,
          dir,
          path.join(this.agentsDir, dir, "system.md"),
          path.join(this.agentsDir, dir, "instructions.md")
        );
        if (this._agents.has(descriptor.id)) {
          throw new Error(`duplicate agent id "${descriptor.id}" (dir "${dir}")`);
        }
        this._agents.set(descriptor.id, descriptor);
      } catch (err) {
        this._errors.push({ dir, manifestPath, error: err.message });
      }
    }
    return this;
  }

  errors() {
    return this._errors;
  }

  list() {
    return [...this._agents.values()];
  }

  get(id) {
    const agent = this._agents.get(id);
    if (!agent) {
      throw new Error(
        `Unknown agent "${id}". Known agents: ${[...this._agents.keys()].join(", ") || "(none)"}`
      );
    }
    return agent;
  }

  has(id) {
    return this._agents.has(id);
  }

  findByCapability(capability) {
    return this.list().filter((a) => a.hasCapability(capability));
  }

  // Lets plugins add agents at runtime without a corresponding
  // agents/<dir>/agent.yaml on disk — pass either an AgentDescriptor or a
  // raw object shaped like a parsed agent.yaml (plus dir/systemPromptPath/
  // instructionsPath when the plugin ships its own prompt files).
  register(descriptorOrRaw, { dir = null, systemPromptPath = null, instructionsPath = null } = {}) {
    const descriptor =
      descriptorOrRaw instanceof AgentDescriptor
        ? descriptorOrRaw
        : new AgentDescriptor(descriptorOrRaw, dir ?? descriptorOrRaw.id, systemPromptPath ?? "", instructionsPath ?? "");
    if (this._agents.has(descriptor.id)) {
      throw new Error(`Agent id "${descriptor.id}" is already registered`);
    }
    this._agents.set(descriptor.id, descriptor);
    return descriptor;
  }
}

export function loadAgentRegistry(opts) {
  return new AgentRegistry(opts).discover();
}
