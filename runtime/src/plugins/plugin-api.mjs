// The only surface a plugin ever touches. Every registration method here
// delegates to an existing registry's own register()/discover() —
// plugins never reach into Harness internals, so the core never has to
// change to support a new plugin.
export class PluginContext {
  constructor(harness) {
    this._harness = harness;
    this.config = harness.config;
    this.logger = harness.logger;
  }

  registerAgent(rawAgentOrDescriptor, opts) {
    return this._harness.agentRegistry.register(rawAgentOrDescriptor, opts);
  }

  registerTool(descriptor) {
    return this._harness.toolRegistry.register(descriptor);
  }

  registerWorkflow(id, raw, filePath = null) {
    return this._harness.workflowRegistry.register(id, raw, filePath);
  }

  registerArtifactType(descriptor) {
    return this._harness.artifactTypeRegistry.register(descriptor);
  }

  registerExecutor(name, executor) {
    return this._harness.agentRuntime.registerExecutor(name, executor);
  }

  // Validation steps are just entries in the pipeline's stepsConfig map —
  // a plugin can add a brand new step id, or override an existing one's
  // command, without editing config/validation-steps.json.
  registerValidationStep(id, stepConfig) {
    this._harness.validationPipeline.stepsConfig[id] = stepConfig;
    if (!this._harness.validationPipeline.steps.includes(id)) {
      this._harness.validationPipeline.steps.push(id);
    }
  }
}
