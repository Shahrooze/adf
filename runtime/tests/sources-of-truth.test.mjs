// Things that must not drift: generated slash commands vs agents/, the
// cli-adapter's tool grants vs config/guardrails.json, and the worked
// example vs the gates it claims to pass.
import test from "node:test";
import assert from "node:assert/strict";
import { loadAgentRegistry } from "../src/registry/agent-registry.mjs";
import { loadWorkflowRegistry } from "../src/registry/workflow-registry.mjs";
import { loadRuntimeConfig } from "../src/config/config-loader.mjs";
import { PolicyEngine } from "../src/guardrails/policy-engine.mjs";
import { CliAdapterExecutor } from "../src/executors/cli-adapter-executor.mjs";
import { planCommands } from "../src/commands/command-generator.mjs";
import { parseWorkflow } from "../src/workflow/workflow-parser.mjs";
import { evaluateGate } from "../src/workflow/gate-evaluator.mjs";

test("committed .claude/commands and .codex/prompts are exactly what agents/ generates (./adf commands)", () => {
  const stale = planCommands(loadAgentRegistry()).filter((e) => !e.upToDate);
  assert.deepEqual(
    stale.map((e) => e.file),
    [],
    "run ./adf commands"
  );
});

test("every agent declares a slash command and every command points at its own agent files", () => {
  const registry = loadAgentRegistry();
  for (const agent of registry.list()) {
    assert.ok(agent.raw.command?.name, `${agent.id} has no command: block`);
  }
  for (const entry of planCommands(registry)) {
    const agent = registry.get(entry.agentId);
    assert.match(entry.expected, new RegExp(`agents/${agent.dir}/system\\.md`));
    assert.match(entry.expected, new RegExp(`agents/${agent.dir}/instructions\\.md`));
  }
});

test("no agent declares a tool its guardrails deny", () => {
  const config = loadRuntimeConfig();
  const engine = new PolicyEngine({ guardrails: config.guardrails });
  for (const agent of loadAgentRegistry().list()) {
    for (const toolId of agent.requiredTools) {
      assert.notEqual(engine.policyFor(agent.id, toolId), "deny", `${agent.id} declares "${toolId}" but guardrails deny it`);
    }
  }
});

test("cli-adapter grants only tools guardrails allow, asks for 'ask', and states the write scope", async () => {
  const registry = loadAgentRegistry();
  const asked = [];
  const guardrails = {
    defaultPolicy: "allow",
    toolPermissions: { terminal: "ask", git: "allow" },
    agentOverrides: { "backend-agent": { git: "deny" } },
    writeScope: { pathAliases: { "backend-code": ["src/backend/**"], "frontend-code": ["src/frontend/**"] } },
  };
  const policyEngine = new PolicyEngine({
    guardrails,
    onAsk: async ({ toolId }) => {
      asked.push(toolId);
      return false;
    },
  });
  const executor = new CliAdapterExecutor({ policyEngine });
  const backend = registry.get("backend-agent"); // tools: fs, git, terminal
  const args = await executor._buildAllowedToolsArgs(backend);
  assert.deepEqual(args, ["--allowedTools", "Read Write Edit Glob Grep"]);
  assert.deepEqual(asked, ["terminal"]);

  const scope = executor._buildScopeSection({ agent: backend, featureDir: "features/f" });
  assert.match(scope, /- src\/backend\/\*\*/);
  assert.match(scope, /- features\/f\/backend-implementation-report\.md/);
  assert.match(scope, /must not modify[\s\S]*- features\/f\/specification\.md[\s\S]*- src\/frontend\/\*\*/);
});

test("the worked example (examples/features/archive-project) passes every feature-development gate", () => {
  const def = parseWorkflow(loadWorkflowRegistry().get("feature-development").raw);
  const featureDir = "examples/features/archive-project";
  for (const stage of def.stages) {
    const result = evaluateGate(stage.gate, { featureDir });
    assert.ok(result.passed, `${stage.id}: ${result.reasons.join("; ")}`);
  }
});
