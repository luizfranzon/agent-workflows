import { AgentInUseError, AgentNotFoundError, type AgentName } from "../../domain/agent";
import type { AgentRepository, WorkflowRepository } from "../ports";

export class DeleteAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly workflows: WorkflowRepository,
  ) {}

  async execute(name: AgentName) {
    if ((await this.agents.find(name)) === null) throw new AgentNotFoundError(name);
    const workflowsUsingAgent = (await this.workflows.list())
      .filter((workflow) => workflow.etapas.some((etapa) => etapa.agent === name))
      .map((workflow) => workflow.name);
    if (workflowsUsingAgent.length > 0) throw new AgentInUseError(name, workflowsUsingAgent);
    await this.agents.delete(name);
  }
}
