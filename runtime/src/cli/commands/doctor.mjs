import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { parseArgs } from "../args.mjs";
import { section } from "../output.mjs";
import * as codes from "../exit-codes.mjs";
import { ADF_STATE_DIR, RUNTIME_CONFIG_PATH, CONFIG_DIR } from "../../config/paths.mjs";
import { parseWorkflow } from "../../workflow/workflow-parser.mjs";
import { planCommands } from "../../commands/command-generator.mjs";
import { resolveWriteScope } from "../../guardrails/write-scope.mjs";

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

  // --- is the configuration actually enforcing what the workflows claim? ---
  const executor = harness.config.runtime?.defaultExecutor ?? "mock";
  record(
    "Default executor runs a real agent",
    executor !== "mock",
    executor === "mock" ? 'runtime.defaultExecutor is "mock": workflow runs produce template placeholders, not work' : executor,
    "warn"
  );

  const stepsConfig = harness.validationPipeline.stepsConfig ?? {};
  const referenced = new Map();
  for (const wf of harness.workflowRegistry.list()) {
    let def;
    try {
      def = parseWorkflow(wf.raw);
    } catch (err) {
      record(`Workflow "${wf.raw.id}" parses`, false, err.message);
      continue;
    }
    const visit = (stages) =>
      stages.forEach((st) => {
        for (const step of st.gate?.checks ?? []) (referenced.get(step) ?? referenced.set(step, new Set()).get(step)).add(def.id);
        if (st.branches) visit(st.branches);
      });
    visit(def.stages);
  }
  const unknown = [...referenced.keys()].filter((step) => !(step in stepsConfig));
  record("Every gate check names a defined validation step", unknown.length === 0, unknown.join(", ") || `${referenced.size} step(s)`);
  const unconfigured = [...referenced.keys()].filter((step) => step in stepsConfig && !stepsConfig[step]?.command);
  record(
    "Every gate check has a command (config/validation-steps.json)",
    unconfigured.length === 0,
    unconfigured.length
      ? `not configured: ${unconfigured.join(", ")} — those gate checks pass as "unverified" (set workflow.strictChecks to fail instead)`
      : `${referenced.size} step(s) configured`,
    harness.config.workflow?.strictChecks ? "fail" : "warn"
  );

  const guardrails = harness.config.guardrails ?? {};
  const contradictions = [];
  for (const agent of harness.agentRegistry.list()) {
    for (const toolId of agent.requiredTools) {
      if (harness.policyEngine.policyFor(agent.id, toolId) === "deny") contradictions.push(`${agent.id} declares "${toolId}" but guardrails deny it`);
    }
  }
  record("Agent tools and guardrails agree", contradictions.length === 0, contradictions.join("; ") || "no contradictions", "warn");

  if (guardrails.writeScope?.enabled) {
    const problems = [];
    for (const agent of harness.agentRegistry.list()) {
      if (!agent.raw.permissions?.write) {
        problems.push(`${agent.id}: no permissions.write (its writes are not enforced)`);
        continue;
      }
      try {
        resolveWriteScope(agent, { featureDir: "features/x", aliases: guardrails.writeScope.pathAliases ?? {} });
      } catch (err) {
        problems.push(`${agent.id}: ${err.message}`);
      }
    }
    record("Write scope resolvable for every agent", problems.length === 0, problems.join("; ") || "enabled");
  } else {
    record("Write scope enforced", false, "config/guardrails.json writeScope.enabled is false: agent.yaml permissions are not checked", "warn");
  }

  const staleCommands = planCommands(harness.agentRegistry).filter((e) => !e.upToDate);
  record(
    "Slash commands match agents/ (adf commands --check)",
    staleCommands.length === 0,
    staleCommands.length ? `${staleCommands.length} out of date — run: ./adf commands` : "up to date",
    "warn"
  );

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
