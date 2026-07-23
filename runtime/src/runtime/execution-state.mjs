// The state machine every agent execution moves through. Transitions are
// intentionally narrow (see VALID_TRANSITIONS) so a bug elsewhere can
// never silently resurrect a cancelled or completed execution.
export const AGENT_STATES = Object.freeze({
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  TIMEOUT: "timeout",
  COMPLETED: "completed",
  FAILED: "failed",
});

const VALID_TRANSITIONS = {
  [AGENT_STATES.PENDING]: [AGENT_STATES.RUNNING, AGENT_STATES.CANCELLED],
  [AGENT_STATES.RUNNING]: [
    AGENT_STATES.PAUSED,
    AGENT_STATES.CANCELLED,
    AGENT_STATES.TIMEOUT,
    AGENT_STATES.COMPLETED,
    AGENT_STATES.FAILED,
  ],
  [AGENT_STATES.PAUSED]: [AGENT_STATES.RUNNING, AGENT_STATES.CANCELLED],
  [AGENT_STATES.CANCELLED]: [],
  [AGENT_STATES.TIMEOUT]: [],
  [AGENT_STATES.COMPLETED]: [],
  [AGENT_STATES.FAILED]: [],
};

export class ExecutionState {
  constructor({ id, agentId, workflowRunId = null, stageId = null }) {
    this.id = id;
    this.agentId = agentId;
    this.workflowRunId = workflowRunId;
    this.stageId = stageId;
    this.status = AGENT_STATES.PENDING;
    this.startedAt = null;
    this.endedAt = null;
    this.error = null;
    this.result = null;
    this.retryCount = 0;
    this.progress = [];
    this._pauseRequested = false;
    this._cancelRequested = false;
  }

  transition(next) {
    const allowed = VALID_TRANSITIONS[this.status] ?? [];
    if (!allowed.includes(next)) {
      throw new Error(`Invalid execution state transition: ${this.status} -> ${next}`);
    }
    this.status = next;
    if (next === AGENT_STATES.RUNNING && !this.startedAt) this.startedAt = new Date().toISOString();
    if ([AGENT_STATES.COMPLETED, AGENT_STATES.FAILED, AGENT_STATES.CANCELLED, AGENT_STATES.TIMEOUT].includes(next)) {
      this.endedAt = new Date().toISOString();
    }
    return this;
  }

  requestPause() {
    this._pauseRequested = true;
  }
  clearPause() {
    this._pauseRequested = false;
  }
  isPauseRequested() {
    return this._pauseRequested;
  }

  requestCancel() {
    this._cancelRequested = true;
  }
  isCancelRequested() {
    return this._cancelRequested;
  }

  addProgress(message) {
    this.progress.push({ message, timestamp: new Date().toISOString() });
  }

  durationMs() {
    if (!this.startedAt) return null;
    const end = this.endedAt ? new Date(this.endedAt) : new Date();
    return end - new Date(this.startedAt);
  }

  toJSON() {
    return {
      id: this.id,
      agentId: this.agentId,
      workflowRunId: this.workflowRunId,
      stageId: this.stageId,
      status: this.status,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      durationMs: this.durationMs(),
      error: this.error,
      retryCount: this.retryCount,
      progress: this.progress,
    };
  }
}
