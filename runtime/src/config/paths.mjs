// Central definition of repo-relative paths the Harness reads from and
// writes to. Keeping this in one module means every other file resolves
// paths the same way regardless of process.cwd().
import path from "node:path";
import fs from "node:fs";

export const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "..",
  ".."
);

export const AGENTS_DIR = path.join(REPO_ROOT, "agents");
export const WORKFLOWS_DIR = path.join(REPO_ROOT, "workflows");
export const POLICIES_DIR = path.join(REPO_ROOT, "policies");
export const CONTEXT_DIR = path.join(REPO_ROOT, "context");
export const TEMPLATES_DIR = path.join(REPO_ROOT, "templates");
export const FEATURES_DIR = path.join(REPO_ROOT, "features");
export const CONFIG_DIR = path.join(REPO_ROOT, "config");
export const PLUGINS_DIR = path.join(REPO_ROOT, "plugins");
export const RUNTIME_DIR = path.join(REPO_ROOT, "runtime");
export const ADF_STATE_DIR = path.join(REPO_ROOT, ".adf");
export const RUNTIME_CONFIG_PATH = path.join(REPO_ROOT, "runtime.config.json");
export const ADF_PROJECT_CONFIG_PATH = path.join(REPO_ROOT, "adf.config.json");

// Returns (and ensures) a subdirectory under .adf/, e.g. adfStateDir("logs").
export function adfStateDir(...segments) {
  const dir = path.join(ADF_STATE_DIR, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
