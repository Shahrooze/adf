#!/usr/bin/env node
// The unified `adf` CLI: one binary reusing exactly the same Harness the
// REST API (runtime/src/api/rest-server.mjs) and any future MCP/IDE/GitHub
// Action integration builds on.
import readline from "node:readline";
import { Harness } from "../harness.mjs";
import { runCommand } from "./commands/run.mjs";
import { workflowCommand } from "./commands/workflow.mjs";
import { agentCommand } from "./commands/agent.mjs";
import { statusCommand } from "./commands/status.mjs";
import { logsCommand } from "./commands/logs.mjs";
import { artifactsCommand } from "./commands/artifacts.mjs";
import { validateCommand } from "./commands/validate.mjs";
import { resumeCommand } from "./commands/resume.mjs";
import { retryCommand } from "./commands/retry.mjs";
import { doctorCommand } from "./commands/doctor.mjs";
import { pluginsCommand } from "./commands/plugins.mjs";
import { registryCommand } from "./commands/registry.mjs";
import { serveCommand } from "./commands/serve.mjs";
import * as codes from "./exit-codes.mjs";
import { adfVersion } from "../../../adf-core/lib/init.mjs";

const COMMANDS = {
  run: runCommand,
  workflow: workflowCommand,
  agent: agentCommand,
  status: statusCommand,
  logs: logsCommand,
  artifacts: artifactsCommand,
  validate: validateCommand,
  resume: resumeCommand,
  retry: retryCommand,
  doctor: doctorCommand,
  plugins: pluginsCommand,
  registry: registryCommand,
  serve: serveCommand,
};

const TOP_LEVEL_HELP = `adf — the ADF Agent Runtime / Harness CLI

Usage: adf <command> [args...]

Commands:
  run <workflow-id>      Run a workflow (alias for "workflow run")
  workflow <run|list|show>
  agent <run|list>
  status [run-id]         Inspect workflow run checkpoints and the job queue
  logs [run-id]           Inspect structured run logs
  artifacts [show <id>]   Inspect tracked artifacts
  validate                Run the Validation Pipeline
  resume <run-id>         Resume a paused/interrupted workflow run
  retry <run-id>          Retry a failed workflow run's failed stage
  doctor                  Environment/config health check
  plugins <list|load>     Inspect the plugin system
  registry <...>          Passthrough to the pre-Harness adf-core CLI
  serve                   Start the REST API over this same Harness

Run "adf <command> --help" for command-specific options.`;

// A real approval hook when the CLI is run interactively: prompt the
// operator y/N on the terminal. Only wired up when stdin is a TTY (see
// main()) — non-interactive runs (CI, piped input) never hang waiting for
// a human; they fall through to config/guardrails.json's
// approvalHooks.autoApproveInNonInteractive instead.
async function interactiveOnAsk({ agentId, toolId, reason }) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) =>
    rl.question(`Allow agent "${agentId}" to use tool "${toolId}" (${reason})? [y/N] `, resolve)
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function main(argv) {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    console.log(TOP_LEVEL_HELP);
    return codes.OK;
  }
  if (command === "--version" || command === "-v") {
    console.log(adfVersion());
    return codes.OK;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command "${command}". Run "adf --help" for the command list.`);
    return codes.USAGE_ERROR;
  }

  const harness = new Harness({ onAsk: process.stdin.isTTY ? interactiveOnAsk : null });
  await harness.loadPlugins();

  try {
    return await handler(harness, rest);
  } catch (err) {
    console.error(`adf ${command}: ${err.message}`);
    if (process.env.ADF_DEBUG) console.error(err.stack);
    return codes.GENERIC_ERROR;
  }
}

main(process.argv.slice(2)).then((code) => process.exit(code));
