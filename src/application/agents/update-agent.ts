import { AgentAlreadyExistsError, AgentNotFoundError, parseAgent, type Agent, type AgentName } from "../../domain/agent";
import type { AgentRepository, WorkflowRepository } from "../ports";

export class UpdateAgent {
  constructor(
    private readonly agents: AgentRepository,
    private readonly workflows: WorkflowRepository,
  ) {}

  async execute(name: AgentName, changes: Agent) {
    if ((await this.agents.find(name)) === null) throw new AgentNotFoundError(name);
    const agent = parseAgent(changes);
    if (agent.name === name) {
      await this.agents.save(agent);
      return agent;
    }
    if (await this.agents.exists(agent.name)) throw new AgentAlreadyExistsError(agent.name);
    await this.agents.rename(name, agent);
    await this.pointWorkflowsTo(name, agent.name);
    return agent;
  }

  private async pointWorkflowsTo(previousName: AgentName, newName: AgentName) {
    const workflowsUsingAgent = (await this.workflows.list()).filter((workflow) => workflow.etapas.some((etapa) => etapa.agent === previousName));
    for (const workflow of workflowsUsingAgent) {
      await this.workflows.save({
        ...workflow,
        etapas: workflow.etapas.map((etapa) => (etapa.agent === previousName ? { ...etapa, agent: newName } : etapa)),
      });
    }
  }
}
