import path from "node:path";
import { REPO_ROOT, ADF_CORE_DIR, readTextIfExists, writeText, today } from "./fs-utils.mjs";
import { readConfig, writeConfig } from "./config-io.mjs";
import { confirm, askWithDefault } from "./prompt.mjs";
import { bold, dim } from "./color.mjs";
import * as exitCodes from "./exit-codes.mjs";

export const TEMPLATES_DIR = path.join(ADF_CORE_DIR, "templates");
export const CONTEXT_DIR = path.join(REPO_ROOT, "context");
export const VERSION_PATH = path.join(ADF_CORE_DIR, "VERSION");

export const TECH_STACK_PATH = path.join(CONTEXT_DIR, "tech-stack.md");
export const PROJECT_PATH = path.join(CONTEXT_DIR, "project.md");
export const DESIGN_SYSTEM_PATH = path.join(CONTEXT_DIR, "design-system.md");

// The stack facts ADF ships an opinion about out of the box — this is the
// exact content of context/tech-stack.md and context/project.md before
// `init` existed, transcribed into config form. `init` offers these as
// suggested defaults; nothing enforces a project must keep them.
export function defaultConfig() {
  return {
    project: {
      name: null,
      version: "0.1.0",
      description: "",
    },
    stack: {
      backend: { language: "C# 14", framework: ".NET 10" },
      frontend: { framework: "Next.js 16", language: "TypeScript" },
      database: "PostgreSQL 17",
      testing: { unit: "xUnit", e2e: "Playwright" },
      auth: "JWT",
      api_style: "REST",
      git_workflow: "GitHub Flow",
      infra: "Docker",
    },
  };
}

// Turns an arbitrary directory basename into a human-readable project name
// default, e.g. "my-cool-app" -> "My Cool App". Mirrors the word-splitting
// shape of backfill.mjs's local `humanize()`, but for directory basenames
// in general rather than FEAT-/BUG- feature directory names specifically.
export function humanizeProjectName(basename) {
  return basename
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Deep-merges plain objects left to right; later arguments win on a
// per-leaf-field basis. Arrays and non-plain values are replaced wholesale,
// never concatenated. `undefined`/`null` sources are skipped so callers can
// pass an absent --from file or empty --set overrides without clobbering
// earlier layers.
function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function mergeAnswers(...layers) {
  let result = {};
  for (const layer of layers) {
    if (!layer) continue;
    result = mergeTwo(result, layer);
  }
  return result;
}

function mergeTwo(base, override) {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value)) {
      // Always recurse into a fresh object (or the existing plain-object
      // destination) rather than assigning `value` directly — otherwise a
      // nested object with no prior destination is assigned by reference,
      // and a later in-place mutation (e.g. applySetOverrides) would leak
      // back into the caller's original, un-merged object.
      out[key] = mergeTwo(isPlainObject(out[key]) ? out[key] : {}, value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Applies "--set a.b.c=value" style dot-path overrides onto a config
// object, creating intermediate objects as needed. Returns a new object;
// does not mutate `config`.
export function applySetOverrides(config, setPairs) {
  let result = mergeAnswers(config);
  for (const pair of setPairs) {
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    const keyPath = pair.slice(0, eq).split(".");
    const value = pair.slice(eq + 1);
    let cursor = result;
    for (let i = 0; i < keyPath.length - 1; i++) {
      const segment = keyPath[i];
      if (!isPlainObject(cursor[segment])) cursor[segment] = {};
      cursor = cursor[segment];
    }
    cursor[keyPath[keyPath.length - 1]] = value;
  }
  return result;
}

// The single mapping between a config path and the {{TOKEN}} it fills —
// every render function and diffConfig() reads this list rather than
// duplicating the field set.
export const TOKEN_FIELDS = [
  { token: "PROJECT_NAME", path: ["project", "name"] },
  { token: "PROJECT_VERSION", path: ["project", "version"] },
  { token: "BACKEND_LANGUAGE", path: ["stack", "backend", "language"] },
  { token: "BACKEND_FRAMEWORK", path: ["stack", "backend", "framework"] },
  { token: "FRONTEND_FRAMEWORK", path: ["stack", "frontend", "framework"] },
  { token: "FRONTEND_LANGUAGE", path: ["stack", "frontend", "language"] },
  { token: "DATABASE", path: ["stack", "database"] },
  { token: "TESTING_UNIT", path: ["stack", "testing", "unit"] },
  { token: "TESTING_E2E", path: ["stack", "testing", "e2e"] },
  { token: "AUTH", path: ["stack", "auth"] },
  { token: "API_STYLE", path: ["stack", "api_style"] },
  { token: "GIT_WORKFLOW", path: ["stack", "git_workflow"] },
  { token: "INFRA", path: ["stack", "infra"] },
];

function getPath(obj, keyPath) {
  return keyPath.reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

export function tokensFromConfig(config) {
  const tokens = {};
  for (const { token, path: keyPath } of TOKEN_FIELDS) {
    tokens[token] = getPath(config, keyPath) ?? "";
  }
  return tokens;
}

// Substitutes every {{TOKEN}} in `text` from `tokens`. Throws if a token
// remains unresolved, so a template/config mismatch fails loudly at render
// time instead of shipping a literal "{{FOO}}" into a generated file.
export function renderTemplate(text, tokens) {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (full, name) => {
    if (!(name in tokens)) {
      throw new Error(`Unresolved template token: {{${name}}}`);
    }
    return tokens[name];
  });
}

function readTemplate(filename) {
  const filePath = path.join(TEMPLATES_DIR, filename);
  const text = readTextIfExists(filePath);
  if (text === null) throw new Error(`Missing template: ${filePath}`);
  return text;
}

export function renderTechStack(config) {
  return renderTemplate(readTemplate("tech-stack.template.md"), tokensFromConfig(config));
}

export function renderProject(config) {
  return renderTemplate(readTemplate("project.template.md"), tokensFromConfig(config));
}

export function renderDesignSystem(config) {
  return renderTemplate(readTemplate("design-system.template.md"), tokensFromConfig(config));
}

// Flattens TOKEN_FIELDS-covered leaves of two configs and reports every
// field whose value changed, for the interactive re-run confirmation
// summary. Fields absent from TOKEN_FIELDS (e.g. project.description) are
// intentionally not diffed here — they're metadata, not rendered stack
// facts, so a changed description isn't part of the "this will change your
// generated docs" confirmation.
export function diffConfig(oldConfig, newConfig) {
  const changes = [];
  for (const { token, path: keyPath } of TOKEN_FIELDS) {
    const oldValue = getPath(oldConfig, keyPath) ?? null;
    const newValue = getPath(newConfig, keyPath) ?? null;
    if (oldValue !== newValue) {
      changes.push({ field: keyPath.join("."), token, oldValue, newValue });
    }
  }
  return changes;
}

export function adfVersion() {
  return (readTextIfExists(VERSION_PATH) ?? "0.0.0").trim();
}

const QUESTIONS = [
  { label: "Project name", get: (c) => c.project.name, set: (c, v) => (c.project.name = v) },
  { label: "One-line description (optional)", get: (c) => c.project.description, set: (c, v) => (c.project.description = v) },
  { label: "Backend language", get: (c) => c.stack.backend.language, set: (c, v) => (c.stack.backend.language = v) },
  { label: "Backend framework", get: (c) => c.stack.backend.framework, set: (c, v) => (c.stack.backend.framework = v) },
  { label: 'Frontend framework (or "none" for API-only)', get: (c) => c.stack.frontend.framework, set: (c, v) => (c.stack.frontend.framework = v) },
  { label: "Frontend language", get: (c) => c.stack.frontend.language, set: (c, v) => (c.stack.frontend.language = v) },
  { label: "Database", get: (c) => c.stack.database, set: (c, v) => (c.stack.database = v) },
  { label: "Unit testing framework", get: (c) => c.stack.testing.unit, set: (c, v) => (c.stack.testing.unit = v) },
  { label: "E2E / frontend testing framework", get: (c) => c.stack.testing.e2e, set: (c, v) => (c.stack.testing.e2e = v) },
  { label: "Auth approach", get: (c) => c.stack.auth, set: (c, v) => (c.stack.auth = v) },
  { label: "API style", get: (c) => c.stack.api_style, set: (c, v) => (c.stack.api_style = v) },
  { label: "Git branch strategy", get: (c) => c.stack.git_workflow, set: (c, v) => (c.stack.git_workflow = v) },
  { label: "Infra / containerization", get: (c) => c.stack.infra, set: (c, v) => (c.stack.infra = v) },
];

async function promptForAnswers(defaults) {
  const answers = mergeAnswers(defaults);
  for (const q of QUESTIONS) {
    const value = await askWithDefault(q.label, q.get(defaults) ?? "");
    q.set(answers, value);
  }
  return answers;
}

function printDiff(changes) {
  if (!changes.length) {
    console.log(dim("No stack fields changed."));
    return;
  }
  console.log(bold("The following will change:"));
  for (const c of changes) {
    console.log(`  ${c.field}: ${dim(String(c.oldValue))} -> ${bold(String(c.newValue))}`);
  }
}

// Thin IO wrapper: readline prompting + adf.config.json / context/*.md
// writes. Every decision (what the answers are, what changed, what gets
// rendered) is delegated to the pure functions above so this function is
// the only place in the module that touches stdin/stdout/the filesystem.
export async function runInit({ yes = false, force = false, fromPath = null, setPairs = [] } = {}) {
  const existingConfig = readConfig();
  const baseDefaults = mergeAnswers(defaultConfig(), existingConfig ?? {});
  if (!baseDefaults.project.name) {
    baseDefaults.project.name = humanizeProjectName(path.basename(REPO_ROOT));
  }

  let fromFileConfig = null;
  if (fromPath) {
    const text = readTextIfExists(path.resolve(fromPath));
    if (text === null) {
      console.error(`Error: --from file not found: ${fromPath}`);
      return exitCodes.USAGE_ERROR;
    }
    try {
      fromFileConfig = JSON.parse(text);
    } catch (err) {
      console.error(`Error: --from file is not valid JSON: ${err.message}`);
      return exitCodes.USAGE_ERROR;
    }
  }

  const merged = applySetOverrides(mergeAnswers(baseDefaults, fromFileConfig), setPairs);
  const nonInteractive = yes || fromFileConfig !== null || setPairs.length > 0;
  const stdinIsTTY = Boolean(process.stdin.isTTY);

  let answers;
  if (yes) {
    answers = merged;
  } else if (stdinIsTTY) {
    answers = applySetOverrides(await promptForAnswers(merged), setPairs);
  } else if (nonInteractive) {
    answers = merged;
  } else {
    console.error("Error: no TTY to prompt on, and neither --yes nor --from/--set was supplied.");
    console.error("Re-run with --yes to accept defaults, or --from <file>/--set key=value for scripted input.");
    return exitCodes.USAGE_ERROR;
  }

  const finalConfig = mergeAnswers(answers, {
    generated: {
      adf_version: adfVersion(),
      initialized_at: existingConfig?.generated?.initialized_at ?? today(),
      last_synced: today(),
    },
  });

  const alreadyInitialized = Boolean(existingConfig) || [TECH_STACK_PATH, PROJECT_PATH, DESIGN_SYSTEM_PATH].some(
    (p) => readTextIfExists(p) !== null
  );

  if (alreadyInitialized && !force) {
    const changes = diffConfig(existingConfig ?? defaultConfig(), finalConfig);
    if (!nonInteractive && stdinIsTTY) {
      printDiff(changes);
      const proceed = await confirm("Overwrite adf.config.json and regenerate context/*.md?", { defaultYes: false });
      if (!proceed) {
        console.log("Aborted — nothing was written.");
        return exitCodes.ABORTED;
      }
    } else {
      console.error("adf.config.json already exists. Re-run with --force to overwrite non-interactively.");
      return exitCodes.ABORTED;
    }
  }

  writeConfig(finalConfig);
  writeText(TECH_STACK_PATH, renderTechStack(finalConfig));
  writeText(PROJECT_PATH, renderProject(finalConfig));
  writeText(DESIGN_SYSTEM_PATH, renderDesignSystem(finalConfig));

  console.log(`Wrote adf.config.json, context/tech-stack.md, context/project.md, context/design-system.md.`);
  console.log(`Run "node adf-core/cli.mjs sync" to refresh the generated registry/index against the new context.`);
  return exitCodes.OK;
}
