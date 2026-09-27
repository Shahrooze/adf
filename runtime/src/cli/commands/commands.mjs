import path from "node:path";
import { parseArgs } from "../args.mjs";
import * as codes from "../exit-codes.mjs";
import { REPO_ROOT } from "../../config/paths.mjs";
import { planCommands, writeCommands } from "../../commands/command-generator.mjs";

const HELP = `Usage:
  adf commands            Regenerate .claude/commands/*.md and .codex/prompts/*.md from agents/
  adf commands --check    Exit non-zero if any generated command file is out of date

agents/<dir>/ (agent.yaml + system.md + instructions.md) is the only
source of truth; the command files just point an AI CLI at it.`;

export async function commandsCommand(harness, argv) {
  const { flags } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }
  const plan = planCommands(harness.agentRegistry);
  const stale = plan.filter((e) => !e.upToDate);
  const rel = (f) => path.relative(REPO_ROOT, f);

  if (flags.check) {
    for (const e of stale) console.error(`out of date: ${rel(e.file)}${e.expected == null ? " (no agent defines it)" : ""}`);
    if (stale.length) {
      console.error(`\n${stale.length} command file(s) out of date. Run: ./adf commands`);
      return codes.GENERIC_ERROR;
    }
    console.log(`${plan.length} command file(s) up to date.`);
    return codes.OK;
  }

  const changed = writeCommands(plan);
  for (const e of changed) console.log(`${e.expected == null ? "removed" : "wrote"} ${rel(e.file)}`);
  console.log(`${changed.length} file(s) changed, ${plan.length - changed.length} already up to date.`);
  return codes.OK;
}
