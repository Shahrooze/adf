// Normalizes a raw workflow YAML document (as parsed by yaml-lite) into
// the execution graph the Workflow Engine actually runs. This is the one
// place that understands the declarative stage vocabulary — sequential
// (the default: stages run in array order), parallel (a `parallel:` list
// of branch stages executed concurrently), and conditional (any stage may
// carry a `condition:` gating whether it runs at all) — so
// workflows/*.yaml stays pure data and the engine stays pure control flow.
export const STAGE_TYPES = Object.freeze({
  AGENT: "agent",
  PARALLEL: "parallel",
  GATE_ONLY: "gate-only",
});

function normalizeRetry(raw) {
  if (!raw) return null;
  return {
    maxAttempts: raw.max_attempts ?? raw.maxAttempts ?? 3,
    backoffMs: raw.backoff_ms ?? raw.backoffMs ?? 2000,
    backoffFactor: raw.backoff_factor ?? raw.backoffFactor ?? 2,
  };
}

function normalizeRollback(raw) {
  if (!raw) return null;
  if (raw.agent) return { type: "agent", agent: raw.agent, description: raw.description ?? null };
  if (raw.tool) {
    const tool = typeof raw.tool === "string" ? { id: raw.tool, args: raw.args ?? {} } : raw.tool;
    return { type: "tool", toolId: tool.id, args: tool.args ?? {} };
  }
  return null;
}

function normalizeCondition(raw) {
  if (!raw) return null;
  // condition: { type: "stage-status" | "artifact-status", target: "<id>", equals: "<value>" }
  if (!raw.type || !raw.target) {
    throw new Error(`Invalid condition (needs "type" and "target"): ${JSON.stringify(raw)}`);
  }
  if (!["stage-status", "artifact-status"].includes(raw.type)) {
    throw new Error(`Unsupported condition type "${raw.type}"`);
  }
  return { type: raw.type, target: raw.target, equals: raw.equals ?? "completed" };
}

// Statuses a reviewing agent writes when it legitimately does NOT approve.
// A gate seeing one of these is a verdict, not a flaky execution: the
// engine never retries it, it routes the findings back to the author
// stage named in `on_fail.rework` instead.
export const DEFAULT_REJECT_STATUSES = Object.freeze(["CHANGES_REQUIRED", "REJECTED"]);

function asList(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeGate(raw) {
  if (!raw) return null;
  return {
    ...raw,
    required_artifacts: asList(raw.required_artifacts),
    // Validation-pipeline step ids (config/validation-steps.json) the
    // Harness itself runs before the gate can pass -- the deterministic
    // half of the gate, independent of what the agent claims.
    checks: asList(raw.checks),
    reject_statuses: raw.reject_statuses ? asList(raw.reject_statuses) : [...DEFAULT_REJECT_STATUSES],
    // Exact lines that must appear in every required artifact.
    markers: asList(raw.markers),
  };
}

function normalizeOnFail(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return { rework: raw, maxRounds: null };
  if (!raw.rework) throw new Error(`Invalid on_fail (needs "rework: <stage-id>"): ${JSON.stringify(raw)}`);
  return { rework: raw.rework, maxRounds: raw.max_rounds ?? raw.maxRounds ?? null };
}

function normalizeStage(raw, idPrefix = "") {
  const id = raw.id ?? `${idPrefix}stage-${Math.random().toString(36).slice(2, 8)}`;
  const common = {
    id,
    consumes: raw.consumes ?? [],
    produces: raw.produces ?? [],
    gate: normalizeGate(raw.gate),
    onFail: normalizeOnFail(raw.on_fail ?? raw.onFail),
    // null = inherit the workflow-level `human_approval` setting.
    humanApproval: raw.human_approval ?? raw.humanApproval ?? null,
    retry: normalizeRetry(raw.retry),
    rollback: normalizeRollback(raw.rollback),
    condition: normalizeCondition(raw.condition),
    description: raw.description ?? null,
    executor: raw.executor ?? null,
    timeoutMs: raw.timeout_ms ?? raw.timeoutMs ?? null,
  };

  if (Array.isArray(raw.parallel)) {
    return {
      ...common,
      type: STAGE_TYPES.PARALLEL,
      agent: null,
      branches: raw.parallel.map((branch, i) => normalizeStage(branch, `${id}-branch-${i}-`)),
    };
  }

  if (raw.agent) {
    return { ...common, type: STAGE_TYPES.AGENT, agent: raw.agent, branches: null };
  }

  return { ...common, type: STAGE_TYPES.GATE_ONLY, agent: null, branches: null };
}

export class WorkflowDefinition {
  constructor({ id, name, version, description, trigger, stages, rules, humanApproval = false, track = null }) {
    this.id = id;
    this.name = name;
    this.version = version;
    this.description = description;
    this.trigger = trigger;
    this.stages = stages;
    this.rules = rules;
    this.humanApproval = humanApproval;
    this.track = track;
  }

  indexOf(stageId) {
    return this.stages.findIndex((s) => s.id === stageId);
  }

  // Gate-only stages are mechanical checks; only stages that produced work
  // (agent or parallel) are offered to a human for approval.
  requiresApproval(stage) {
    if (stage.type === STAGE_TYPES.GATE_ONLY) return false;
    return stage.humanApproval ?? this.humanApproval;
  }

  findStage(stageId, stages = this.stages) {
    for (const stage of stages) {
      if (stage.id === stageId) return stage;
      if (stage.branches) {
        const nested = this.findStage(stageId, stage.branches);
        if (nested) return nested;
      }
    }
    return null;
  }
}

export function parseWorkflow(raw) {
  if (!raw.id) throw new Error('Workflow definition missing required field "id"');
  if (!Array.isArray(raw.stages)) throw new Error('Workflow definition missing required field "stages"');
  const stages = raw.stages.map((s) => normalizeStage(s));
  const ids = new Set();
  for (const stage of stages) {
    if (ids.has(stage.id)) throw new Error(`Duplicate stage id "${stage.id}" in workflow "${raw.id}"`);
    ids.add(stage.id);
  }
  stages.forEach((stage, index) => {
    if (!stage.onFail) return;
    const target = stages.findIndex((s) => s.id === stage.onFail.rework);
    if (target === -1) {
      throw new Error(`Stage "${stage.id}" on_fail.rework targets unknown top-level stage "${stage.onFail.rework}"`);
    }
    if (target >= index) {
      throw new Error(`Stage "${stage.id}" on_fail.rework must target an earlier stage (got "${stage.onFail.rework}")`);
    }
  });
  return new WorkflowDefinition({
    id: raw.id,
    name: raw.name ?? raw.id,
    version: raw.version ?? "0.0.0",
    description: (raw.description ?? "").trim(),
    trigger: raw.trigger ?? null,
    stages,
    rules: raw.rules ?? [],
    humanApproval: raw.human_approval ?? raw.humanApproval ?? false,
    track: raw.track ?? null,
  });
}
