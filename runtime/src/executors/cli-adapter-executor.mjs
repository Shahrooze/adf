// Bridges the Runtime to an external AI coding CLI (Claude Code, Codex,
// Gemini CLI, ...) — the same tool a human currently runs by hand against
// agents/*/agent.yaml. The full context bundle + task instructions are
// written to the child process's stdin; its stdout becomes the agent's
// response. This is what makes the Harness "any AI CLI", not just one
// vendor: swap `command`/`args` in runtime.config.json's
// `executors.cli-adapter` section.
//
// Unlike the other executors, this one cannot mediate individual tool
// calls through the Harness's own toolRuntime/guardrails — the spawned CLI
// is a separate OS process with no RPC channel back into this one. So the
// contract here is: the child process must have its own native tool
// access and must write the produced artifact(s) directly to disk at the
// exact paths this executor tells it to. Two things follow from that:
//   1. It needs to actually be told those paths (see _buildOutputSection)
//      — the context bundle alone never mentions featureDir.
//   2. It needs *some* file-write permission pre-authorized, since a
//      headless `-p` run has no terminal to answer an interactive
//      permission prompt and fails closed (silently produces no file) —
//      see _buildAllowedToolsArgs, scoped to what the agent's own
//      agent.yaml `tools:` list declares, not a blanket bypass.
//
// Because this spawns a real OS process, pause()/resume()/cancel() are
// genuine: SIGSTOP/SIGCONT actually suspend/continue the child on POSIX,
// and cancel() sends SIGTERM (then SIGKILL if it doesn't exit).
import { spawn } from "node:child_process";
import path from "node:path";
import { AgentExecutor } from "./agent-executor.mjs";
import { REPO_ROOT } from "../config/paths.mjs";

// Harness tool id (agents/*/agent.yaml `tools:`, config/tools.json) ->
// Claude Code CLI `--allowedTools` entries. Kept deliberately conservative
// (e.g. `git`/`docker` are scoped Bash prefixes, not blanket Bash) so an
// agent only gets pre-authorized for what it already declared it needs.
// Executors for other AI CLIs should override this via the `toolMap`
// constructor option if that CLI's tool names differ.
const DEFAULT_TOOL_MAP = {
  fs: ["Read", "Write", "Edit", "Glob", "Grep"],
  terminal: ["Bash"],
  git: ["Bash(git *)"],
  github: ["Bash(gh *)"],
  docker: ["Bash(docker *)"],
  http: ["WebFetch"],
  database: ["Bash(psql *)", "Bash(mysql *)", "Bash(sqlite3 *)"],
  // "mcp" has no static CLI-flag equivalent (it depends on servers
  // configured in config/mcp-servers.json) and is intentionally omitted —
  // an agent that declares it gets no extra --allowedTools entry for it.
};

export class CliAdapterExecutor extends AgentExecutor {
  constructor({
    command = "claude",
    args = ["-p"],
    cwd = process.cwd(),
    env = process.env,
    toolMap = DEFAULT_TOOL_MAP,
  } = {}) {
    super();
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.toolMap = toolMap;
    this._children = new Map();
  }

  get name() {
    return "cli-adapter";
  }

  // Every path an agent's produced artifacts should land at, as absolute
  // paths under featureDir (or the repo root when there's no featureDir —
  // e.g. a code-review-report.md-only run outside the feature pipeline).
  _outputPaths({ featureDir, produces }) {
    if (!produces?.length) return [];
    const dir = featureDir ? path.resolve(REPO_ROOT, featureDir) : REPO_ROOT;
    return produces.map((filename) => path.join(dir, filename));
  }

  _buildOutputSection({ featureDir, produces }) {
    const outputPaths = this._outputPaths({ featureDir, produces });
    if (!outputPaths.length) return null;
    return [
      `# Target Output Location`,
      `Write every artifact this stage produces directly to these exact ` +
        `absolute file paths on disk, creating parent directories as needed ` +
        `— do not just describe the content in your response, actually ` +
        `create/update these files using your file-editing tools:`,
      ...outputPaths.map((p) => `- ${p}`),
    ].join("\n");
  }

  _buildPrompt({ agent, task, contextBundle, featureDir, produces }) {
    const outputSection = this._buildOutputSection({ featureDir, produces });
    return [
      `# System Prompt (${agent.id})`,
      agent.systemPrompt(),
      `# Instructions`,
      agent.instructions(),
      `# Task`,
      task.description ?? "",
      outputSection,
      `# Context`,
      contextBundle.toPromptText(),
    ]
      .filter((section) => section != null)
      .join("\n\n");
  }

  // Scoped `--allowedTools` for this specific agent's declared `tools:`,
  // so a headless run can actually write its output without prompting for
  // permission it has no terminal to answer — without falling back to an
  // unscoped bypass for capabilities the agent never claimed to need.
  _buildAllowedToolsArgs(agent) {
    const names = new Set();
    for (const toolId of agent?.requiredTools ?? []) {
      for (const name of this.toolMap[toolId] ?? []) names.add(name);
    }
    return names.size ? ["--allowedTools", [...names].join(" ")] : [];
  }

  async *run({ agent, task, contextBundle, agentId, featureDir, produces, signal, executionId }) {
    yield { type: "progress", message: `spawning "${this.command}" for ${agent.id}` };

    const prompt = this._buildPrompt({ agent, task, contextBundle, featureDir, produces });
    const args = [...this.args, ...this._buildAllowedToolsArgs(agent)];
    const child = spawn(this.command, args, { cwd: this.cwd, env: this.env });
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

    // artifacts stays [] deliberately: this executor cannot know whether
    // the child actually wrote its output (only that it exited 0), so it
    // never claims artifacts on the child's behalf. AgentRuntime's
    // _recordArtifacts falls back to checking disk for exactly the paths
    // this executor told the child to write to (see _outputPaths above).
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
