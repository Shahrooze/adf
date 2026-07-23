// Bridges the Runtime to an external AI coding CLI (Claude Code, Codex,
// Gemini CLI, ...) — the same tool a human currently runs by hand against
// agents/*/agent.yaml. The full context bundle + task instructions are
// written to the child process's stdin; its stdout becomes the agent's
// response. This is what makes the Harness "any AI CLI", not just one
// vendor: swap `command`/`args` in runtime.config.json's
// `executors.cli-adapter` section.
//
// Because this spawns a real OS process, pause()/resume()/cancel() are
// genuine: SIGSTOP/SIGCONT actually suspend/continue the child on POSIX,
// and cancel() sends SIGTERM (then SIGKILL if it doesn't exit).
import { spawn } from "node:child_process";
import { AgentExecutor } from "./agent-executor.mjs";

export class CliAdapterExecutor extends AgentExecutor {
  constructor({ command = "claude", args = ["-p"], cwd = process.cwd(), env = process.env } = {}) {
    super();
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this._children = new Map();
  }

  get name() {
    return "cli-adapter";
  }

  _buildPrompt({ agent, task, contextBundle }) {
    return [
      `# System Prompt (${agent.id})`,
      agent.systemPrompt(),
      `# Instructions`,
      agent.instructions(),
      `# Task`,
      task.description ?? "",
      `# Context`,
      contextBundle.toPromptText(),
    ].join("\n\n");
  }

  async *run({ agent, task, contextBundle, agentId, signal, executionId }) {
    yield { type: "progress", message: `spawning "${this.command}" for ${agent.id}` };

    const prompt = this._buildPrompt({ agent, task, contextBundle });
    const child = spawn(this.command, this.args, { cwd: this.cwd, env: this.env });
    this._children.set(executionId, child);

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.stdin.write(prompt);
    child.stdin.end();

    const onAbort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", onAbort);

    const exit = await new Promise((resolve) => {
      child.on("error", (err) => resolve({ error: err }));
      child.on("close", (code) => resolve({ code }));
    });
    signal?.removeEventListener("abort", onAbort);
    this._children.delete(executionId);

    if (exit.error) {
      if (exit.error.code === "ENOENT") {
        throw new Error(
          `AI CLI "${this.command}" not found on PATH. Configure executors.cli-adapter.command ` +
            `in runtime.config.json, or use the "mock" executor for dry runs.`
        );
      }
      throw exit.error;
    }
    if (exit.code !== 0 && !signal?.aborted) {
      throw new Error(`"${this.command}" exited with code ${exit.code}: ${stderr.slice(0, 2000)}`);
    }

    yield {
      type: "result",
      content: stdout,
      artifacts: [],
      dependencyIds: contextBundle?.dependencyIds ?? [],
    };
  }

  async pause(executionId) {
    const child = this._children.get(executionId);
    if (!child || process.platform === "win32") return false;
    child.kill("SIGSTOP");
    return true;
  }

  async resume(executionId) {
    const child = this._children.get(executionId);
    if (!child || process.platform === "win32") return false;
    child.kill("SIGCONT");
    return true;
  }

  async cancel(executionId) {
    const child = this._children.get(executionId);
    if (!child) return false;
    child.kill("SIGTERM");
    setTimeout(() => {
      if (this._children.has(executionId)) child.kill("SIGKILL");
    }, 3000);
    return true;
  }
}
