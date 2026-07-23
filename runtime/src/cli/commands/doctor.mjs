import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "../args.mjs";
import { section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";
import { ADF_STATE_DIR, RUNTIME_CONFIG_PATH, CONFIG_DIR } from "../../config/paths.mjs";

const HELP = `Usage:
  adf doctor

Sanity-checks the Harness's own environment: Node version, config files,
agent/workflow registry health, optional CLI dependencies, and that
.adf/ is writable. Exits non-zero if anything critical fails.`;

function checkBinary(name) {
  try {
    execFileSync(name, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function doctorCommand(harness, argv) {
  const { flags } = parseArgs(argv);
  if (flags.help || flags.h) {
    console.log(HELP);
    return codes.OK;
  }

  const checks = [];
  const record = (name, ok, detail, severity = "fail") => checks.push({ name, ok, detail, severity });

  const [major] = process.versions.node.split(".").map(Number);
  record("Node.js >= 18", major >= 18, `found ${process.version}`);

  record("runtime.config.json readable", fs.existsSync(RUNTIME_CONFIG_PATH), RUNTIME_CONFIG_PATH);
  record("config/tools.json readable", fs.existsSync(`${CONFIG_DIR}/tools.json`), `${CONFIG_DIR}/tools.json`);
  record("config/guardrails.json readable", fs.existsSync(`${CONFIG_DIR}/guardrails.json`), `${CONFIG_DIR}/guardrails.json`);

  record(
    "Agent registry loads with zero errors",
    harness.agentRegistry.errors().length === 0,
    harness.agentRegistry.errors().map((e) => `${e.dir}: ${e.error}`).join("; ") || `${harness.agentRegistry.list().length} agents`
  );
  record(
    "Workflow registry loads with zero errors",
    harness.workflowRegistry.errors().length === 0,
    harness.workflowRegistry.errors().map((e) => `${e.file}: ${e.error}`).join("; ") || `${harness.workflowRegistry.list().length} workflows`
  );

  try {
    fs.mkdirSync(ADF_STATE_DIR, { recursive: true });
    fs.accessSync(ADF_STATE_DIR, fs.constants.W_OK);
    record(".adf/ state directory is writable", true, ADF_STATE_DIR);
  } catch (err) {
    record(".adf/ state directory is writable", false, err.message);
  }

  for (const bin of ["git"]) {
    record(`"${bin}" CLI available`, checkBinary(bin), "required for the git tool");
  }
  for (const bin of ["gh", "docker", "claude"]) {
    record(`"${bin}" CLI available (optional)`, checkBinary(bin), "used by github/docker tools or the cli-adapter executor", "warn");
  }

  section("adf doctor");
  let hasCriticalFailure = false;
  for (const check of checks) {
    const marker = check.ok ? "ok  " : check.severity === "warn" ? "warn" : "FAIL";
    if (!check.ok && check.severity !== "warn") hasCriticalFailure = true;
    console.log(`  [${marker}] ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }

  console.log(`\n${hasCriticalFailure ? "One or more critical checks failed." : "All critical checks passed."}`);
  return hasCriticalFailure ? codes.GENERIC_ERROR : codes.OK;
}
