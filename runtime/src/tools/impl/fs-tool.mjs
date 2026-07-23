// Filesystem tool: read/write/list/search/mkdir/exists, sandboxed to the
// repository root so no agent can walk a "../../.." out of the project.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../../config/paths.mjs";

export const metadata = {
  id: "fs",
  actions: ["read", "write", "append", "list", "exists", "mkdir", "search", "delete"],
};

function resolveSafe(relPath) {
  const abs = path.isAbsolute(relPath) ? relPath : path.join(REPO_ROOT, relPath);
  const normalized = path.normalize(abs);
  if (normalized !== REPO_ROOT && !normalized.startsWith(REPO_ROOT + path.sep)) {
    throw new Error(`Path "${relPath}" escapes the repository root`);
  }
  return normalized;
}

function searchRecursive(dir, pattern, results, limit) {
  if (results.length >= limit || !fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".adf") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      searchRecursive(full, pattern, results, limit);
    } else if (entry.isFile()) {
      const content = fs.readFileSync(full, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (results.length >= limit) return;
        if (pattern.test(line)) {
          results.push({ file: path.relative(REPO_ROOT, full), line: idx + 1, text: line.trim() });
        }
      });
    }
  }
}

export async function execute(args, _ctx) {
  const { action, path: relPath, content, pattern, limit = 100 } = args;
  switch (action) {
    case "read": {
      const abs = resolveSafe(relPath);
      if (!fs.existsSync(abs)) throw new Error(`File not found: ${relPath}`);
      return fs.readFileSync(abs, "utf8");
    }
    case "write": {
      const abs = resolveSafe(relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content ?? "", "utf8");
      return { written: relPath, bytes: (content ?? "").length };
    }
    case "append": {
      const abs = resolveSafe(relPath);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.appendFileSync(abs, content ?? "", "utf8");
      return { appended: relPath, bytes: (content ?? "").length };
    }
    case "list": {
      const abs = resolveSafe(relPath ?? ".");
      if (!fs.existsSync(abs)) return [];
      return fs.readdirSync(abs, { withFileTypes: true }).map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "dir" : "file",
      }));
    }
    case "exists": {
      return fs.existsSync(resolveSafe(relPath));
    }
    case "mkdir": {
      const abs = resolveSafe(relPath);
      fs.mkdirSync(abs, { recursive: true });
      return { created: relPath };
    }
    case "delete": {
      const abs = resolveSafe(relPath);
      if (fs.existsSync(abs)) fs.rmSync(abs, { recursive: true, force: true });
      return { deleted: relPath };
    }
    case "search": {
      const results = [];
      searchRecursive(resolveSafe(relPath ?? "."), new RegExp(pattern), results, limit);
      return results;
    }
    default:
      throw new Error(`Unknown fs action "${action}"`);
  }
}
