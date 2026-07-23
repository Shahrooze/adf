// The single assembly point for every Harness subsystem. The CLI, the
// REST API, and plugin loading all build on top of one Harness instance
// so they share exactly the same runtime — no separate code paths that
// could drift apart (requirement: "everything reuses the same runtime").
import { loadRuntimeConfig } from "./config/config-loader.mjs";
import { loadAgentRegistry } from "./registry/agent-registry.mjs";
import { loadToolRegistry } from "./registry/tool-registry.mjs";
import { loadWorkflowRegistry } from "./registry/workflow-registry.mjs";
import { loadArtifactTypeRegistry } from "./registry/artifact-type-registry.mjs";
import { ArtifactManager } from "./artifacts/artifact-manager.mjs";
import { getMemoryManager } from "./memory/memory-store.mjs";
import { ContextManager } from "./context/context-manager.mjs";
import { PolicyEngine } from "./guardrails/policy-engine.mjs";
import { ToolRuntime } from "./tools/tool-runtime.mjs";
import { AgentRuntime } from "./runtime/agent-runtime.mjs";
import { MockExecutor } from "./executors/mock-executor.mjs";
import { CliAdapterExecutor } from "./executors/cli-adapter-executor.mjs";
import { CheckpointStore } from "./retry/checkpoint-store.mjs";
import { WorkflowEngine } from "./workflow/workflow-engine.mjs";
import { ValidationPipeline } from "./validation/validation-pipeline.mjs";
import { ExecutionQueue } from "./queue/execution-queue.mjs";
import { Logger } from "./logging/logger.mjs";
import { PluginLoader } from "./plugins/plugin-loader.mjs";
import { PluginContext } from "./plugins/plugin-api.mjs";

export class Harness {
  constructor({ runId = null, onAsk = null } = {}) {
    this.config = loadRuntimeConfig();
    this.logger = new Logger({ runId });

    this.agentRegistry = loadAgentRegistry();
    this.toolRegistry = loadToolRegistry({ config: this.config });
    this.workflowRegistry = loadWorkflowRegistry();
    this.artifactTypeRegistry = loadArtifactTypeRegistry();

    this.artifactManager = new ArtifactManager();
    this.memoryManager = getMemoryManager({ shortTermMaxEntries: this.config.runtime.shortTermMaxEntries });
    this.contextManager = new ContextManager({
      artifactManager: this.artifactManager,
      memoryManager: this.memoryManager,
      logger: this.logger,
    });

    this.policyEngine = new PolicyEngine({ guardrails: this.config.guardrails, logger: this.logger, onAsk });
    this.toolRuntime = new ToolRuntime({ toolRegistry: this.toolRegistry, policyEngine: this.policyEngine, logger: this.logger });

    this.agentRuntime = new AgentRuntime({
      agentRegistry: this.agentRegistry,
      contextManager: this.contextManager,
      artifactManager: this.artifactManager,
      memoryManager: this.memoryManager,
      toolRuntime: this.toolRuntime,
      logger: this.logger,
      config: this.config,
    });
    this.agentRuntime.registerExecutor("mock", new MockExecutor());
    this.agentRuntime.registerExecutor("cli-adapter", new CliAdapterExecutor(this.config.runtime.executors?.["cli-adapter"] ?? {}));

    this.checkpointStore = new CheckpointStore();
    this.workflowEngine = new WorkflowEngine({
      workflowRegistry: this.workflowRegistry,
      agentRuntime: this.agentRuntime,
      artifactManager: this.artifactManager,
      memoryManager: this.memoryManager,
      toolRuntime: this.toolRuntime,
      checkpointStore: this.checkpointStore,
      logger: this.logger,
      config: this.config,
    });

    this.validationPipeline = new ValidationPipeline({
      steps: this.config.validation.pipeline,
      toolRuntime: this.toolRuntime,
      logger: this.logger,
      continueOnFailure: this.config.validation.continueOnFailure,
    });

    this.queue = new ExecutionQueue({ concurrency: this.config.queue.concurrency });

    this.pluginLoader = new PluginLoader({ config: this.config, logger: this.logger });
    this.pluginContext = new PluginContext(this);
  }

  loadPlugins() {
    return this.pluginLoader.loadAll(this.pluginContext);
  }
}

export function createHarness(opts) {
  return new Harness(opts);
}
