import type { WorkflowRepository } from "../ports";
import type { ValidateWorkflow } from "./validate-workflow";

export class ListWorkflows {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly validateWorkflow: ValidateWorkflow,
  ) {}

  async execute() {
    const workflows = await this.workflows.list();
    return Promise.all(workflows.map(async (workflow) => ({ ...workflow, problems: await this.validateWorkflow.execute(workflow) })));
  }
}
