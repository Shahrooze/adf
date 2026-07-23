// Loads every configuration surface the Harness needs: runtime.config.json
// (engine behavior), config/tools.json (Tool Runtime registrations),
// config/guardrails.json (permission policy), config/mcp-servers.json
// (optional, future MCP servers) and adf.config.json (this project's own
// identity/stack, owned by adf-core — read-only here).
//
// Nothing in the Harness hardcodes these values: every file here is a
// plain JSON file a project can edit without touching source code.
import fs from "node:fs";
import {
  RUNTIME_CONFIG_PATH,
  ADF_PROJECT_CONFIG_PATH,
  CONFIG_DIR,
} from "./paths.mjs";
import path from "node:path";

const DEFAULT_RUNTIME_CONFIG = {
  runtime: {
    defaultExecutor: "mock",
    agentTimeoutMs: 600000,
    maxConcurrentAgents: 4,
    pauseCheckIntervalMs: 250,
  },
  queue: { concurrency: 4, defaultPriority: 5 },
  retry: { maxAttempts: 3, backoffMs: 2000, backoffFactor: 2, maxBackoffMs: 60000 },
  logging: { level: "info" },
  memory: { backend: "file", shortTermMaxEntries: 200 },
  validation: {
    pipeline: [
      "lint",
      "unit-tests",
      "integration-tests",
      "security-scan",
      "performance",
      "build",
      "review",
    ],
    continueOnFailure: false,
  },
  api: { port: 4870, host: "127.0.0.1" },
  plugins: { autoload: true, directories: ["plugins"] },
};

const DEFAULT_GUARDRAILS = {
  defaultPolicy: "allow",
  toolPermissions: {},
  agentOverrides: {},
  dangerousCommandPatterns: [],
  approvalHooks: { onAsk: "log", autoApproveInNonInteractive: false },
  sandbox: { enabled: false, allowedWriteRoots: [] },
};

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function deepMerge(base, override) {
  if (!override) return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base &&
      typeof base[key] === "object" &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

let cached = null;

export function loadRuntimeConfig({ fresh = false } = {}) {
  if (cached && !fresh) return cached;

  const runtimeOverride = readJsonIfExists(RUNTIME_CONFIG_PATH) || {};
  const runtimeConfig = deepMerge(DEFAULT_RUNTIME_CONFIG, runtimeOverride);

  const toolsFile = readJsonIfExists(path.join(CONFIG_DIR, "tools.json")) || {
    tools: [],
  };

  const guardrailsOverride =
    readJsonIfExists(path.join(CONFIG_DIR, "guardrails.json")) || {};
  const guardrails = deepMerge(DEFAULT_GUARDRAILS, guardrailsOverride);

  const mcpServers = readJsonIfExists(
    path.join(CONFIG_DIR, "mcp-servers.json")
  ) || { servers: [] };

  const projectConfig = readJsonIfExists(ADF_PROJECT_CONFIG_PATH) || null;

  cached = {
    ...runtimeConfig,
    tools: toolsFile.tools || [],
    guardrails,
    mcpServers: mcpServers.servers || [],
    project: projectConfig,
  };
  return cached;
}

export function resetConfigCache() {
  cached = null;
}
