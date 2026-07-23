// The AgentExecutor contract every executor implementation satisfies. It
// is deliberately an async generator: yielding zero or more progress
// events before a final "result" event lets the Agent Runtime check
// pause/cancel state between yields regardless of whether the underlying
// implementation is a single subprocess call (cli-adapter) or a
// synchronous stub (mock) — see runtime/src/runtime/agent-runtime.mjs.
//
// A concrete executor implements run() and, optionally, pause()/resume()/
// cancel() if it can meaningfully act on those mid-flight (e.g. sending
// SIGSTOP/SIGCONT to a real child process). Executors that cannot pause
// mid-flight simply omit pause()/resume() — the Runtime still honors
// cancel-before-start and timeout for every executor.
export class AgentExecutor {
  get name() {
    throw new Error("AgentExecutor subclasses must implement get name()");
  }

  // eslint-disable-next-line no-unused-vars
  async *run({ agent, task, contextBundle, toolRuntime, agentId, signal, logger }) {
    throw new Error("AgentExecutor subclasses must implement run()");
  }

  async pause(_executionId) {
    return false;
  }

  async resume(_executionId) {
    return false;
  }

  async cancel(_executionId) {
    return false;
  }
}
