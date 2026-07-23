// GitHub tool: a thin, allow-listed wrapper around the `gh` CLI when it is
// installed and authenticated. Only read/comment-style subcommands are
// allow-listed by default — anything else is refused with a clear error
// rather than silently passed through, since this tool is dual-use
// (reading a PR is safe; merging one is not something an agent should do
// without a human in the loop).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "../../config/paths.mjs";

const execFileAsync = promisify(execFile);

export const metadata = { id: "github", actions: ["issueView", "issueList", "prView", "prList", "prComment"] };

const ALLOWED = {
  issueView: (a) => ["issue", "view", a.number, "--json", "title,body,state,labels"],
  issueList: (a) => ["issue", "list", "--limit", String(a.limit ?? 20), "--json", "number,title,state"],
  prView: (a) => ["pr", "view", a.number, "--json", "title,body,state,mergeable,statusCheckRollup"],
  prList: (a) => ["pr", "list", "--limit", String(a.limit ?? 20), "--json", "number,title,state"],
  prComment: (a) => ["pr", "comment", a.number, "--body", a.body],
};

export async function execute(args, ctx) {
  const builder = ALLOWED[args.action];
  if (!builder) {
    throw new Error(
      `Unknown or unsupported github action "${args.action}". Allowed: ${Object.keys(ALLOWED).join(", ")}`
    );
  }
  const ghArgs = builder(args).map(String);
  try {
    const { stdout } = await execFileAsync("gh", ghArgs, {
      cwd: ctx.cwd ?? REPO_ROOT,
      timeout: args.timeoutMs ?? 30000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("gh CLI not found on PATH — install and authenticate the GitHub CLI");
    }
    throw new Error(`gh ${ghArgs.join(" ")} failed: ${err.stderr || err.message}`);
  }
}
