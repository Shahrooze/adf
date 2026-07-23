// Approval hooks decide what happens when a tool permission resolves to
// "ask". The default implementation is non-interactive (logs the request
// and applies the configured autoApproveInNonInteractive default) so
// headless workflow runs never hang waiting for input; a CLI or REST
// caller can pass a custom `onAsk` to prompt a real human instead.
export class ApprovalHook {
  constructor({ config = {}, logger = null, onAsk = null } = {}) {
    this.config = config;
    this.logger = logger;
    this.onAsk = onAsk;
  }

  async request({ agentId, toolId, reason }) {
    this.logger?.info?.(`Approval requested: agent="${agentId}" tool="${toolId}"`, {
      agentId,
      toolCalls: [{ toolId, reason, event: "approval-requested" }],
    });

    if (this.onAsk) {
      const approved = await this.onAsk({ agentId, toolId, reason });
      this.logger?.info?.(`Approval ${approved ? "granted" : "denied"} for tool="${toolId}"`, { agentId });
      return approved;
    }

    const approved = Boolean(this.config.autoApproveInNonInteractive);
    this.logger?.warn?.(
      `Approval auto-${approved ? "granted" : "denied"} (non-interactive, no approval callback registered)`,
      { agentId }
    );
    return approved;
  }
}
