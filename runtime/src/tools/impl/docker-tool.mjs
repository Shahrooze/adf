// Docker tool: build/run/exec/ps via execFile (no shell), so this stays
// safe to call the same way the git tool does. Requires the `docker` CLI
// to be present on PATH; returns a clear error rather than throwing an
// opaque ENOENT if it is not.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "../../config/paths.mjs";

const execFileAsync = promisify(execFile);

export const metadata = { id: "docker", actions: ["build", "run", "exec", "ps", "images"] };

async function docker(args, cwd, timeoutMs) {
  try {
    const { stdout } = await execFileAsync("docker", args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error("docker CLI not found on PATH — install Docker or disable the docker tool");
    }
    throw new Error(`docker ${args.join(" ")} failed: ${err.stderr || err.message}`);
  }
}

export async function execute(args, ctx) {
  const cwd = ctx.cwd ?? REPO_ROOT;
  const timeoutMs = args.timeoutMs ?? 120000;
  switch (args.action) {
    case "build":
      return docker(["build", "-t", args.tag, args.context ?? "."], cwd, timeoutMs);
    case "run":
      return docker(["run", "--rm", ...(args.flags ?? []), args.image, ...(args.command ?? [])], cwd, timeoutMs);
    case "exec":
      return docker(["exec", args.container, ...(args.command ?? [])], cwd, timeoutMs);
    case "ps":
      return docker(["ps", "--format", "{{.ID}} {{.Image}} {{.Status}}"], cwd, timeoutMs);
    case "images":
      return docker(["images", "--format", "{{.Repository}}:{{.Tag}}"], cwd, timeoutMs);
    default:
      throw new Error(`Unknown docker action "${args.action}"`);
  }
}
