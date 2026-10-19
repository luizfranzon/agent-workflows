import { AgentAlreadyExistsError, parseAgent, type Agent } from "../../domain/agent";
import type { AgentRepository } from "../ports";

export class CreateAgent {
  constructor(private readonly agents: AgentRepository) {}

  async execute(candidate: Agent) {
    const agent = parseAgent(candidate);
    if (await this.agents.exists(agent.name)) throw new AgentAlreadyExistsError(agent.name);
    await this.agents.save(agent);
    return agent;
  }
}
