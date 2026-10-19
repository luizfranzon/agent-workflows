import type { AgentRepository } from "../ports";

export class ListAgents {
  constructor(private readonly agents: AgentRepository) {}

  execute() {
    return this.agents.list();
  }
}
