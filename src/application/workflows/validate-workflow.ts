import { InvalidWorkflowError, workflowProblems, type Workflow } from "../../domain/workflow";
import type { AgentRepository } from "../ports";

export class ValidateWorkflow {
  constructor(private readonly agents: AgentRepository) {}

  async execute(workflow: Workflow) {
    const agentNames = (await this.agents.list()).map((agent) => agent.name);
    return workflowProblems(workflow, agentNames);
  }

  async requireValid(workflow: Workflow) {
    const problems = await this.execute(workflow);
    if (problems.length > 0) throw new InvalidWorkflowError(problems);
  }
}
