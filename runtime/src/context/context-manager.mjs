// Builds the exact context bundle handed to one agent execution: the
// policies and project context it needs, the artifacts it consumes
// (resolved through the Artifact Manager, falling back to reading the file
// directly the first time an artifact hasn't been recorded yet), and the
// relevant slice of shared workflow memory — trimmed to a size budget so
// agents receive only what they need, not the whole repository.
import fs from "node:fs";
import path from "node:path";
import { POLICIES_DIR, CONTEXT_DIR, REPO_ROOT } from "../config/paths.mjs";

function readDirText(dir, { extensions = [".md"] } = {}) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => extensions.some((ext) => f.endsWith(ext)))
    .sort()
    .map((f) => ({
      name: f,
      path: path.join(dir, f),
      content: fs.readFileSync(path.join(dir, f), "utf8"),
    }));
}

export class ContextBundle {
  constructor({ agentId, policies, projectContext, artifacts, memory, dependencyIds, trimmed }) {
    this.agentId = agentId;
    this.policies = policies;
    this.projectContext = projectContext;
    this.artifacts = artifacts;
    this.memory = memory;
    this.dependencyIds = dependencyIds;
    this.trimmed = trimmed;
  }

  // Flattens the bundle into a single prompt-ready text blob, in a stable
  // order, for executors that just want "the context" as one string.
  toPromptText() {
    const sections = [];
    if (this.projectContext.length) {
      sections.push(
        "# Project Context\n" + this.projectContext.map((c) => c.content).join("\n\n")
      );
    }
    if (this.policies.length) {
      sections.push("# Policies\n" + this.policies.map((p) => p.content).join("\n\n"));
    }
    if (this.artifacts.length) {
      sections.push(
        "# Consumed Artifacts\n" +
          this.artifacts
            .map((a) => `## ${a.id} (${a.type})\n${a.content}`)
            .join("\n\n")
      );
    }
    if (Object.keys(this.memory.shared).length) {
      sections.push("# Shared Workflow Memory\n" + JSON.stringify(this.memory.shared, null, 2));
    }
    if (this.memory.longTermFacts.length) {
      sections.push(
        "# Long-Term Memory (relevant facts)\n" + this.memory.longTermFacts.join("\n")
      );
    }
    return sections.join("\n\n---\n\n");
  }
}

export class ContextManager {
  constructor({
    artifactManager,
    memoryManager,
    maxContextChars = 200_000,
    policiesDir = POLICIES_DIR,
    contextDir = CONTEXT_DIR,
    logger = null,
  }) {
    this.artifactManager = artifactManager;
    this.memoryManager = memoryManager;
    this.maxContextChars = maxContextChars;
    this.policiesDir = policiesDir;
    this.contextDir = contextDir;
    this.logger = logger;
  }

  // consumesPaths: the stage's `consumes` list (artifact filenames or
  // artifact ids, resolved relative to featureDir when not already an
  // artifact id in the manager).
  build({ agent, workflowRunId, featureDir = null, consumesPaths = [], includePolicies = true }) {
    const projectContext = readDirText(this.contextDir);
    const policies = includePolicies ? readDirText(this.policiesDir) : [];

    const artifacts = [];
    const dependencyIds = [];
    for (const consume of consumesPaths) {
      const resolved = this._resolveArtifact(consume, featureDir);
      if (resolved) {
        artifacts.push(resolved);
        dependencyIds.push(resolved.id);
      }
    }

    const shared = workflowRunId ? this.memoryManager.shared(workflowRunId).all() : {};
    const longTermFacts = this.memoryManager
      .longTerm()
      .get("facts", [])
      .slice(-20);

    let bundle = new ContextBundle({
      agentId: agent.id,
      policies,
      projectContext,
      artifacts,
      memory: { shared, longTermFacts },
      dependencyIds,
      trimmed: false,
    });

    bundle = this._trim(bundle);
    return bundle;
  }

  _resolveArtifact(consume, featureDir) {
    if (this.artifactManager.has(consume)) {
      const record = this.artifactManager.get(consume);
      return { id: record.id, type: record.type, content: this.artifactManager.readContent(record.id) ?? "" };
    }
    if (featureDir) {
      const candidate = path.join(featureDir, consume);
      const absCandidate = path.isAbsolute(candidate) ? candidate : path.join(REPO_ROOT, candidate);
      if (fs.existsSync(absCandidate)) {
        return {
          id: path.relative(REPO_ROOT, absCandidate).split(path.sep).join("/"),
          type: consume.replace(/\.md$/, ""),
          content: fs.readFileSync(absCandidate, "utf8"),
        };
      }
    }
    this.logger?.warn?.(`Context: could not resolve consumed artifact "${consume}"`, {});
    return null;
  }

  // Deterministic, non-LLM trimming, applied as a cascade from least to
  // most important until the bundle fits the configured character budget.
  // Consumed artifacts are trimmed last (and only truncated, never
  // dropped) because they are the one thing an agent cannot reconstruct on
  // its own. Every trim is logged so the operator can see exactly what an
  // agent did NOT receive.
  _trim(bundle) {
    const fits = () => bundle.toPromptText().length <= this.maxContextChars;
    if (fits()) return bundle;

    const steps = [
      ["dropped long-term memory facts", () => (bundle.memory.longTermFacts = [])],
      ["dropped policy documents", () => (bundle.policies = [])],
      ["dropped project context documents", () => (bundle.projectContext = [])],
    ];
    for (const [reason, apply] of steps) {
      apply();
      bundle.trimmed = true;
      this.logger?.warn?.(`Context trimmed: ${reason}`, { agentId: bundle.agentId });
      if (fits()) return bundle;
    }

    // Last resort: truncate the largest consumed artifacts to make the
    // remainder fit, largest first.
    const sorted = [...bundle.artifacts].sort((a, b) => b.content.length - a.content.length);
    for (const artifact of sorted) {
      if (fits()) break;
      const overBy = bundle.toPromptText().length - this.maxContextChars;
      const keep = Math.max(200, artifact.content.length - overBy - 100);
      if (keep < artifact.content.length) {
        const removed = artifact.content.length - keep;
        artifact.content = artifact.content.slice(0, keep) + `\n\n[... trimmed ${removed} chars ...]`;
      }
    }
    this.logger?.warn?.("Context trimmed: truncated largest consumed artifacts to fit budget", {
      agentId: bundle.agentId,
    });
    return bundle;
  }
}
