// A small in-process job queue: bounded concurrency, priority ordering,
// and cooperative cancellation (every job function receives an
// AbortSignal). This is what lets `adf run` fire off several workflow or
// agent runs without them all starting at once and fighting over the
// same resources.
//
// Durable "resume after the process itself restarted" is intentionally
// NOT this module's job — an arbitrary JS closure can't be serialized and
// replayed. That durability is what the Workflow Engine's checkpoints
// (runtime/src/retry/checkpoint-store.mjs) already provide at the level
// that actually matters: a workflow run survives a restart and resumes
// from its last completed stage. This queue only ever needs to survive
// for the lifetime of one process.
import crypto from "node:crypto";

export const JOB_STATES = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

class Job {
  constructor({ id, label, priority, fn }) {
    this.id = id;
    this.label = label;
    this.priority = priority;
    this.fn = fn;
    this.state = JOB_STATES.QUEUED;
    this.result = null;
    this.error = null;
    this.enqueuedAt = new Date().toISOString();
    this.startedAt = null;
    this.endedAt = null;
    this.controller = new AbortController();
    this._resolvers = [];
  }

  toJSON() {
    return {
      id: this.id,
      label: this.label,
      priority: this.priority,
      state: this.state,
      enqueuedAt: this.enqueuedAt,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      error: this.error ? this.error.message : null,
    };
  }
}

export class ExecutionQueue {
  constructor({ concurrency = 4 } = {}) {
    this.concurrency = concurrency;
    this._queued = [];
    this._running = new Map();
    this._done = new Map();
  }

  get size() {
    return this._queued.length + this._running.size;
  }

  // Returns { id, promise } — the job is scheduled immediately if a slot
  // is free, otherwise it waits in priority order (higher number = runs
  // sooner).
  enqueue(fn, { id = crypto.randomUUID(), priority = 5, label = id } = {}) {
    const job = new Job({ id, label, priority, fn });
    const promise = new Promise((resolve, reject) => {
      job._resolvers.push({ resolve, reject });
    });
    this._queued.push(job);
    this._queued.sort((a, b) => b.priority - a.priority || a.enqueuedAt.localeCompare(b.enqueuedAt));
    this._pump();
    return { id: job.id, promise };
  }

  cancel(jobId) {
    const queuedIndex = this._queued.findIndex((j) => j.id === jobId);
    if (queuedIndex !== -1) {
      const [job] = this._queued.splice(queuedIndex, 1);
      job.state = JOB_STATES.CANCELLED;
      job.endedAt = new Date().toISOString();
      this._done.set(job.id, job);
      job._resolvers.forEach((r) => r.reject(new Error(`Job "${jobId}" cancelled before it started`)));
      return true;
    }
    const running = this._running.get(jobId);
    if (running) {
      running.controller.abort();
      return true;
    }
    return false;
  }

  status(jobId) {
    return (this._queued.find((j) => j.id === jobId) ?? this._running.get(jobId) ?? this._done.get(jobId))?.toJSON() ?? null;
  }

  list() {
    return [...this._queued, ...this._running.values(), ...this._done.values()].map((j) => j.toJSON());
  }

  async drain() {
    while (this._queued.length > 0 || this._running.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  _pump() {
    while (this._running.size < this.concurrency && this._queued.length > 0) {
      const job = this._queued.shift();
      this._running.set(job.id, job);
      job.state = JOB_STATES.RUNNING;
      job.startedAt = new Date().toISOString();
      this._runJob(job);
    }
  }

  async _runJob(job) {
    try {
      const result = await job.fn(job.controller.signal);
      job.state = job.controller.signal.aborted ? JOB_STATES.CANCELLED : JOB_STATES.COMPLETED;
      job.result = result;
      job._resolvers.forEach((r) => r.resolve(result));
    } catch (err) {
      job.state = job.controller.signal.aborted ? JOB_STATES.CANCELLED : JOB_STATES.FAILED;
      job.error = err;
      job._resolvers.forEach((r) => r.reject(err));
    } finally {
      job.endedAt = new Date().toISOString();
      this._running.delete(job.id);
      this._done.set(job.id, job);
      this._pump();
    }
  }
}
