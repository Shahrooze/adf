// Terminal tool: runs a single shell command with an output cap and a
// hard timeout. This is the highest-risk built-in tool — the dangerous
// command guard and per-agent guardrail policy (config/guardrails.json)
// gate every call before execute() ever runs.
import { exec } from "node:child_process";
import { REPO_ROOT } from "../../config/paths.mjs";

export const metadata = { id: "terminal", actions: ["run"] };

export async function execute(args, ctx) {
  const { command, timeoutMs = 60000 } = args;
  if (!command) throw new Error("terminal tool requires args.command");
  const cwd = args.cwd ? args.cwd : ctx.cwd ?? REPO_ROOT;

  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024, shell: "/bin/bash" },
      (error, stdout, stderr) => {
        if (error && error.killed) {
          reject(new Error(`Command timed out after ${timeoutMs}ms: ${command}`));
          return;
        }
        resolve({
          command,
          exitCode: error ? error.code ?? 1 : 0,
          stdout: stdout?.toString() ?? "",
          stderr: stderr?.toString() ?? "",
        });
      }
    );
  });
}
