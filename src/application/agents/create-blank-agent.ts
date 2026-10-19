import { BLANK_AGENT_DESCRIPTION, nextBlankAgentName } from "../../domain/agent";
import type { AgentRepository } from "../ports";

export class CreateBlankAgent {
  constructor(private readonly agents: AgentRepository) {}

  async execute() {
    const takenNames = (await this.agents.list()).map((agent) => agent.name);
    const agent = { name: nextBlankAgentName(takenNames), description: BLANK_AGENT_DESCRIPTION, model: null, tools: [], maxTurns: null, instructions: "" };
    await this.agents.save(agent);
    return agent;
  }
}
