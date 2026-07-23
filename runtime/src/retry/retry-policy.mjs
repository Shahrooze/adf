// A single retry policy implementation shared by the Workflow Engine (per
// stage) and available to any other caller that wants exponential backoff
// with a cap — so "how many times do we retry, and how long do we wait"
// is answered in exactly one place.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryPolicy {
  constructor({ maxAttempts = 3, backoffMs = 2000, backoffFactor = 2, maxBackoffMs = 60000 } = {}) {
    this.maxAttempts = Math.max(1, maxAttempts);
    this.backoffMs = backoffMs;
    this.backoffFactor = backoffFactor;
    this.maxBackoffMs = maxBackoffMs;
  }

  delayForAttempt(attempt) {
    const delay = this.backoffMs * Math.pow(this.backoffFactor, Math.max(0, attempt - 1));
    return Math.min(delay, this.maxBackoffMs);
  }

  // fn(attempt) receives the 1-indexed attempt number. onRetry(err, attempt)
  // is called after a failed attempt, before waiting to try again.
  async execute(fn, { onRetry, shouldRetry } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;
        const canRetry = attempt < this.maxAttempts && (!shouldRetry || shouldRetry(err));
        if (!canRetry) throw err;
        onRetry?.(err, attempt);
        await sleep(this.delayForAttempt(attempt));
      }
    }
    throw lastError;
  }

  static fromConfig(config = {}) {
    return new RetryPolicy({
      maxAttempts: config.maxAttempts,
      backoffMs: config.backoffMs,
      backoffFactor: config.backoffFactor,
      maxBackoffMs: config.maxBackoffMs,
    });
  }
}
