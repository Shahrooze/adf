// Generates the per-agent slash commands for AI CLIs (.claude/commands/,
// .codex/prompts/) from agents/<dir>/ -- the single source of truth.
//
// The generated file deliberately does NOT copy system.md/instructions.md:
// it points the CLI at them, so a prompt edit never needs regenerating and
// the command can never drift from the agent. Only agent.yaml metadata
// (command.description / argument_hint, permissions) is rendered, and
// `adf commands --check` (run by the test suite) fails when a committed
// file differs from what agent.yaml generates.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../config/paths.mjs";

export const COMMAND_TARGETS = Object.freeze([".claude/commands", ".codex/prompts"]);

function list(items) {
  return items.map((i) => `- ${i}`).join("\n");
}

export function renderCommand(agent) {
  const command = agent.raw.command ?? {};
  const dir = `agents/${agent.dir}`;
  const permissions = agent.raw.permissions ?? {};
  const lines = [
    "---",
    `description: ${command.description ?? agent.description.split("\n")[0]}`,
    `argument-hint: ${command.argument_hint ?? "<feature-name>"}`,
    "---",
    "",
    `<!-- GENERATED from ${dir}/agent.yaml by \`./adf commands\` — do not edit. Change ${dir}/ instead. -->`,
    "",
    `# ${agent.name}`,
    "",
    `You are executing the ADF ${agent.name} for: $ARGUMENTS`,
    "",
    "Read these two files in full and follow them exactly — they are the whole",
    "definition of this agent:",
    "",
    `1. ${dir}/system.md — role, responsibilities and hard constraints`,
    `2. ${dir}/instructions.md — the step-by-step procedure, inputs, outputs and final STATUS`,
    "",
    "`<feature-name>` in those files is the feature named above; its artifacts",
    "live under `features/<feature-name>/`.",
  ];
  if (permissions.write?.length) {
    lines.push(
      "",
      "## Write scope",
      "",
      "When this agent runs under the ADF Harness, every file it changes is",
      `checked against ${dir}/agent.yaml \`permissions\` (\`@alias\` entries are`,
      "defined in config/guardrails.json `writeScope.pathAliases`).",
      "",
      "May write:",
      "",
      list(permissions.write)
    );
    if (permissions.deny?.length) lines.push("", "Must never modify:", "", list(permissions.deny));
  }
  return lines.join("\n") + "\n";
}

// Returns [{ target, file, expected, actual, upToDate }] for every agent
// that declares a `command:` block, plus stale files with no agent behind them.
export function planCommands(agentRegistry, { root = REPO_ROOT, targets = COMMAND_TARGETS } = {}) {
  const plan = [];
  const agents = agentRegistry.list().filter((a) => a.raw.command?.name);
  for (const target of targets) {
    const wanted = new Set();
    for (const agent of agents) {
      const file = path.join(root, target, `${agent.raw.command.name}.md`);
      wanted.add(path.basename(file));
      const expected = renderCommand(agent);
      const actual = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
      plan.push({ target, file, agentId: agent.id, expected, actual, upToDate: actual === expected });
    }
    const dir = path.join(root, target);
    if (fs.existsSync(dir)) {
      for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !wanted.has(f))) {
        const file = path.join(dir, name);
        const actual = fs.readFileSync(file, "utf8");
        // Only files this generator wrote are considered stale; a
        // hand-written command a project added itself is left alone.
        if (actual.includes("by `./adf commands` — do not edit")) {
          plan.push({ target, file, agentId: null, expected: null, actual, upToDate: false });
        }
      }
    }
  }
  return plan;
}

export function writeCommands(plan) {
  const changed = [];
  for (const entry of plan) {
    if (entry.upToDate) continue;
    if (entry.expected == null) {
      fs.rmSync(entry.file, { force: true });
    } else {
      fs.mkdirSync(path.dirname(entry.file), { recursive: true });
      fs.writeFileSync(entry.file, entry.expected, "utf8");
    }
    changed.push(entry);
  }
  return changed;
}
