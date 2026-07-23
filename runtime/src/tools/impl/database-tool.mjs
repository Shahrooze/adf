// Database tool: runs a query through a CLI adapter binary (psql, mysql,
// sqlite3) rather than bundling a driver, keeping the Harness dependency
// free. Connection details are passed by the caller (typically resolved
// from the project's own environment/config) — nothing is stored here.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "../../config/paths.mjs";

const execFileAsync = promisify(execFile);

export const metadata = { id: "database", actions: ["query"], adapters: ["sqlite3", "psql", "mysql"] };

const ADAPTER_ARGS = {
  sqlite3: (connection, query) => ["sqlite3", [connection, "-json", query]],
  psql: (connection, query) => ["psql", [connection, "-c", query, "--json"]],
  mysql: (connection, query) => ["mysql", [connection, "-e", query]],
};

export async function execute(args, ctx) {
  const { adapter, connection, query, timeoutMs = 30000 } = args;
  if (!adapter || !ADAPTER_ARGS[adapter]) {
    throw new Error(`Unsupported database adapter "${adapter}". Supported: ${Object.keys(ADAPTER_ARGS).join(", ")}`);
  }
  if (!query) throw new Error("database tool requires args.query");
  const [bin, binArgs] = ADAPTER_ARGS[adapter](connection, query);
  try {
    const { stdout } = await execFileAsync(bin, binArgs, {
      cwd: ctx.cwd ?? REPO_ROOT,
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`"${bin}" CLI not found on PATH — install the ${adapter} client`);
    }
    throw new Error(`${bin} query failed: ${err.stderr || err.message}`);
  }
}
