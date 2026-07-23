import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ExecutionQueue, JOB_STATES } from "../src/queue/execution-queue.mjs";
import { RetryPolicy } from "../src/retry/retry-policy.mjs";
import { CheckpointStore } from "../src/retry/checkpoint-store.mjs";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

test("ExecutionQueue runs jobs up to the concurrency limit and queues the rest", async () => {
  const queue = new ExecutionQueue({ concurrency: 2 });
  let concurrentPeak = 0;
  let active = 0;
  const jobs = Array.from({ length: 5 }, (_, i) =>
    queue.enqueue(async () => {
      active++;
      concurrentPeak = Math.max(concurrentPeak, active);
      await sleep(30);
      active--;
      return i;
    })
  );
  const results = await Promise.all(jobs.map((j) => j.promise));
  assert.deepEqual(results.sort(), [0, 1, 2, 3, 4]);
  assert.ok(concurrentPeak <= 2, `expected peak concurrency <= 2, got ${concurrentPeak}`);
});

test("ExecutionQueue runs higher-priority jobs before lower-priority ones", async () => {
  const queue = new ExecutionQueue({ concurrency: 1 });
  const order = [];
  // First job occupies the only slot so the rest genuinely queue up.
  const blocker = queue.enqueue(async () => sleep(20));
  queue.enqueue(async () => order.push("low"), { priority: 1 });
  queue.enqueue(async () => order.push("high"), { priority: 9 });
  queue.enqueue(async () => order.push("medium"), { priority: 5 });
  await blocker.promise;
  await queue.drain();
  assert.deepEqual(order, ["high", "medium", "low"]);
});

test("ExecutionQueue cancels a still-queued job without running it", async () => {
  const queue = new ExecutionQueue({ concurrency: 1 });
  let ran = false;
  const blocker = queue.enqueue(async () => sleep(30));
  const target = queue.enqueue(async () => {
    ran = true;
  });
  const cancelled = queue.cancel(target.id);
  assert.equal(cancelled, true);
  await assert.rejects(() => target.promise, /cancelled/);
  await blocker.promise;
  await queue.drain();
  assert.equal(ran, false);
  assert.equal(queue.status(target.id).state, JOB_STATES.CANCELLED);
});

test("ExecutionQueue cancels a running job via its AbortSignal", async () => {
  const queue = new ExecutionQueue({ concurrency: 1 });
  const job = queue.enqueue(
    (signal) =>
      new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
        setTimeout(resolve, 500);
      })
  );
  await sleep(20);
  queue.cancel(job.id);
  await assert.rejects(() => job.promise);
  assert.equal(queue.status(job.id).state, JOB_STATES.CANCELLED);
});

test("RetryPolicy retries with exponential backoff up to maxAttempts, then throws", async () => {
  const policy = new RetryPolicy({ maxAttempts: 3, backoffMs: 5, backoffFactor: 2, maxBackoffMs: 100 });
  let attempts = 0;
  const delays = [];
  await assert.rejects(
    () =>
      policy.execute(
        async () => {
          attempts++;
          throw new Error("always fails");
        },
        { onRetry: (_err, attempt) => delays.push(policy.delayForAttempt(attempt)) }
      ),
    /always fails/
  );
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [5, 10]);
});

test("RetryPolicy stops early when shouldRetry returns false", async () => {
  const policy = new RetryPolicy({ maxAttempts: 5, backoffMs: 1 });
  let attempts = 0;
  await assert.rejects(
    () =>
      policy.execute(
        async () => {
          attempts++;
          throw new Error("fatal");
        },
        { shouldRetry: () => false }
      ),
    /fatal/
  );
  assert.equal(attempts, 1);
});

test("RetryPolicy returns the successful result once the fn stops throwing", async () => {
  const policy = new RetryPolicy({ maxAttempts: 5, backoffMs: 1 });
  let attempts = 0;
  const result = await policy.execute(async () => {
    attempts++;
    if (attempts < 3) throw new Error("not yet");
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("CheckpointStore persists, loads, lists and deletes checkpoints", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "adf-checkpoints-"));
  const store = new CheckpointStore({ dir });

  assert.equal(store.load("missing"), null);
  assert.equal(store.exists("missing"), false);

  store.save("run-1", { status: "running", currentStageIndex: 2 });
  assert.equal(store.exists("run-1"), true);
  const loaded = store.load("run-1");
  assert.equal(loaded.status, "running");
  assert.equal(loaded.currentStageIndex, 2);
  assert.ok(loaded.checkpointedAt);

  store.save("run-2", { status: "completed" });
  assert.deepEqual(store.list().sort(), ["run-1", "run-2"]);

  store.delete("run-1");
  assert.equal(store.exists("run-1"), false);
  assert.deepEqual(store.list(), ["run-2"]);
});
