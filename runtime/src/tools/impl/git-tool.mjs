// Git tool: a fixed set of safe subcommands run via execFile (no shell),
// so arguments can never be reinterpreted as shell syntax.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "../../config/paths.mjs";

const execFileAsync = promisify(execFile);

export const metadata = {
  id: "git",
  actions: ["status", "diff", "log", "add", "commit", "branch", "currentBranch", "show"],
};

async function git(args, cwd) {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return stdout.trim();
  } catch (err) {
    throw new Error(`git ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

export async function execute(args, ctx) {
  const cwd = ctx.cwd ?? REPO_ROOT;
  switch (args.action) {
    case "status":
      return git(["status", "--porcelain=v1", "-b"], cwd);
    case "diff":
      return git(["diff", ...(args.staged ? ["--staged"] : []), ...(args.path ? [args.path] : [])], cwd);
    case "log":
      return git(["log", `-${args.limit ?? 10}`, "--oneline"], cwd);
    case "add":
      return git(["add", ...(args.paths ?? [args.path])], cwd);
    case "commit":
      if (!args.message) throw new Error("git commit requires args.message");
      return git(["commit", "-m", args.message], cwd);
    case "branch":
      return git(["branch", "--list"], cwd);
    case "currentBranch":
      return git(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
    case "show":
      return git(["show", args.ref ?? "HEAD"], cwd);
    default:
      throw new Error(`Unknown git action "${args.action}"`);
  }
}
