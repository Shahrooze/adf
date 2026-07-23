// MCP server bridge: makes future Model Context Protocol servers
// plug-and-play. Servers are declared in config/mcp-servers.json (empty by
// default). This module intentionally does not bundle an MCP client
// implementation (keeping the Harness zero-dependency) — instead it
// resolves the configured server's own command and documents exactly how
// a caller should invoke it, and fails fast with a clear, actionable
// error when no server is registered yet, rather than pretending to work.
import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "../../config/paths.mjs";

export const metadata = { id: "mcp", actions: ["call", "listServers"] };

function loadServers() {
  const file = path.join(CONFIG_DIR, "mcp-servers.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8")).servers ?? [];
}

export async function execute(args, _ctx) {
  const servers = loadServers();
  if (args.action === "listServers") return servers;

  if (servers.length === 0) {
    throw new Error(
      'No MCP servers configured. Add one to config/mcp-servers.json (e.g. {"id":"my-server","command":"npx","args":["-y","some-mcp-server"]}) to make its tools available here.'
    );
  }
  const server = servers.find((s) => s.id === args.server);
  if (!server) {
    throw new Error(`Unknown MCP server "${args.server}". Configured: ${servers.map((s) => s.id).join(", ")}`);
  }
  throw new Error(
    `MCP server "${server.id}" is registered but the Harness does not bundle an MCP client yet — ` +
      `wire this tool up to your MCP client library of choice, or invoke it through the CLI/IDE ` +
      `integration that already speaks MCP.`
  );
}
