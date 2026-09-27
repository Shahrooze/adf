// Write-scope enforcement: after an agent stage finishes, compare the
// working tree against a snapshot taken before the stage started and
// check every file the stage changed against that agent's own
// agent.yaml `permissions.write` / `permissions.deny` lists.
//
// This is what makes those lists binding for executors the Harness cannot
// mediate call-by-call (cli-adapter spawns a separate AI CLI with its own
// native file tools): whatever the child process did, the diff is the
// ground truth. It is executor-agnostic, so the same check applies to
// mock and plugin executors too.
//
// Pattern vocabulary (agent.yaml permissions entries):
//   features/<feature-name>/x.md   feature-relative path (resolved to featureDir)
//   x.md                           bare filename = featureDir/x.md
//   src/**, tests/*.cs             repo-relative globs (`**`, `*`, `?`)
//   <bug-id>, <anything>           placeholder = one path segment wildcard
//   @backend-code                  alias from config/guardrails.json writeScope.pathAliases
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "../config/paths.mjs";

export class WriteScopeError extends Error {
  constructor(message) {
    super(message);
    this.name = "WriteScopeError";
  }
}

function toPosix(p) {
  return p.split(path.sep).join("/");
}

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else {
          re += ".*";
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") {
      re += "[^/]";
    } else if (c === "<") {
      const close = glob.indexOf(">", i);
      if (close === -1) throw new WriteScopeError(`Unterminated placeholder in pattern "${glob}"`);
      re += "[^/]+";
      i = close;
    } else {
      re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${re}$`);
}

// A permissions entry must be a path pattern, not prose ("frontend source
// code" can't be enforced). Registry validation and tests use this.
export function isValidScopeEntry(entry) {
  return typeof entry === "string" && entry.length > 0 && !/\s/.test(entry);
}

function featurePrefix(featureDir, root) {
  if (!featureDir) return null;
  const rel = toPosix(path.relative(root, path.resolve(root, featureDir)));
  return rel.replace(/\/+$/, "");
}

function expandEntry(entry, { featureDir, aliases, root = REPO_ROOT }) {
  if (!isValidScopeEntry(entry)) {
    throw new WriteScopeError(`Invalid permissions entry "${entry}" (must be a path/glob or @alias, no spaces)`);
  }
  if (entry.startsWith("@")) {
    const expanded = aliases?.[entry.slice(1)];
    if (!expanded) throw new WriteScopeError(`Unknown path alias "${entry}" (define it in config/guardrails.json writeScope.pathAliases)`);
    return expanded.flatMap((e) => expandEntry(e, { featureDir, aliases, root }));
  }
  const prefix = featurePrefix(featureDir, root);
  if (entry.startsWith("features/<feature-name>/")) {
    const rest = entry.slice("features/<feature-name>/".length);
    return [prefix ? `${prefix}/${rest}` : `features/*/${rest}`];
  }
  if (!entry.includes("/")) {
    return [prefix ? `${prefix}/${entry}` : `features/*/${entry}`];
  }
  return [entry];
}

// Expands a list of permissions entries (globs, bare filenames,
// feature-relative paths, @aliases) into compiled matchers.
export function compileScopeEntries(list, { featureDir = null, aliases = {}, root = REPO_ROOT } = {}) {
  return (list ?? []).flatMap((e) => expandEntry(e, { featureDir, aliases, root })).map((g) => ({ glob: g, re: globToRegExp(g) }));
}

// Resolves one agent's permissions into concrete repo-relative regexes.
export function resolveWriteScope(agent, { featureDir = null, aliases = {}, root = REPO_ROOT } = {}) {
  const permissions = agent?.raw?.permissions ?? {};
  const compile = (list) => compileScopeEntries(list, { featureDir, aliases, root });
  return { agentId: agent?.id ?? null, write: compile(permissions.write), deny: compile(permissions.deny), declared: Boolean(permissions.write) };
}

// ---- working-tree snapshots -------------------------------------------------

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
}

function hashFile(absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile()) return "non-file";
    return crypto.createHash("sha1").update(fs.readFileSync(absPath)).digest("hex");
  } catch {
    return "deleted";
  }
}

function dirtyPaths(root) {
  // -z: NUL-separated, no quoting; renames emit "XY new\0old\0".
  const out = git(["status", "--porcelain", "-z", "--untracked-files=all"], root);
  const parts = out.split("\0").filter(Boolean);
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    const code = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (code.startsWith("R") || code.startsWith("C")) paths.push(parts[++i]);
  }
  return paths;
}

// Returns null when root isn't a git work tree (the check is then skipped
// and the caller logs that it could not be enforced).
export function snapshotWorkingTree(root = REPO_ROOT) {
  try {
    git(["rev-parse", "--is-inside-work-tree"], root);
  } catch {
    return null;
  }
  const head = (() => {
    try {
      return git(["rev-parse", "HEAD"], root).trim();
    } catch {
      return null;
    }
  })();
  const files = new Map();
  for (const rel of dirtyPaths(root)) files.set(rel, hashFile(path.join(root, rel)));
  return { root, head, files };
}

// Every repo-relative path whose content differs from the snapshot.
export function changedSince(snapshot, root = snapshot?.root ?? REPO_ROOT) {
  if (!snapshot) return null;
  const changed = new Set();
  const now = new Set(dirtyPaths(root));
  for (const rel of now) {
    const before = snapshot.files.get(rel);
    // Clean at snapshot time and dirty now -> changed by this stage.
    if (before === undefined || before !== hashFile(path.join(root, rel))) changed.add(rel);
  }
  for (const [rel, before] of snapshot.files) {
    if (now.has(rel)) continue;
    // Dirty at snapshot time, clean now -> the stage reverted/committed it.
    if (before !== hashFile(path.join(root, rel))) changed.add(rel);
  }
  // A commit made during the stage leaves a clean tree; include its files.
  if (snapshot.head) {
    try {
      const head = git(["rev-parse", "HEAD"], root).trim();
      if (head !== snapshot.head) {
        for (const rel of git(["diff", "--name-only", "-z", snapshot.head, head], root).split("\0").filter(Boolean)) {
          // Committing a pre-existing local edit unchanged is not a write.
          const before = snapshot.files.get(rel);
          if (before === undefined || before !== hashFile(path.join(root, rel))) changed.add(rel);
        }
      }
    } catch {
      // HEAD vanished (e.g. unborn branch) -- nothing more to add.
    }
  }
  return [...changed].sort();
}

// scopes: one resolved scope per agent that ran in the window (several for
// a parallel stage). A path is allowed when at least one agent's scope
// allows it without that same agent denying it; alwaysAllowed globs (the
// Harness's own state, adf-core's generated index) bypass the check.
export function checkWriteScope(changedPaths, scopes, { alwaysAllowed = [] } = {}) {
  const always = alwaysAllowed.map((a) => (a.re ? a.re : globToRegExp(a)));
  const violations = [];
  for (const rel of changedPaths) {
    if (always.some((re) => re.test(rel))) continue;
    const reasons = [];
    const ok = scopes.some((scope) => {
      const denied = scope.deny.find((d) => d.re.test(rel));
      if (denied) {
        reasons.push(`${scope.agentId} denies ${denied.glob}`);
        return false;
      }
      const allowed = scope.write.some((w) => w.re.test(rel));
      if (!allowed) reasons.push(`not in ${scope.agentId} write scope`);
      return allowed;
    });
    if (!ok) violations.push({ path: rel, reason: reasons.join("; ") });
  }
  return violations;
}

// Restores violating paths to their pre-stage state: tracked files from
// HEAD (or from the snapshot content hash if they were already dirty --
// in that case we cannot restore and report it), untracked new files are
// removed.
export function revertPaths(snapshot, paths, root = snapshot.root) {
  const reverted = [];
  const unrevertable = [];
  for (const rel of paths) {
    if (snapshot.files.has(rel) && snapshot.files.get(rel) !== "deleted") {
      unrevertable.push(rel); // pre-existing local edits; don't guess
      continue;
    }
    let tracked = true;
    try {
      git(["cat-file", "-e", `HEAD:${rel}`], root);
    } catch {
      tracked = false;
    }
    try {
      if (tracked) git(["checkout", "HEAD", "--", rel], root);
      else fs.rmSync(path.join(root, rel), { force: true });
      reverted.push(rel);
    } catch {
      unrevertable.push(rel);
    }
  }
  return { reverted, unrevertable };
}
