import { WorkflowAlreadyExistsError, type Workflow } from "../../domain/workflow";
import type { WorkflowRepository } from "../ports";
import type { ValidateWorkflow } from "./validate-workflow";

export class CreateWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly validateWorkflow: ValidateWorkflow,
  ) {}

  async execute(workflow: Workflow) {
    await this.validateWorkflow.requireValid(workflow);
    if (await this.workflows.exists(workflow.name)) throw new WorkflowAlreadyExistsError(workflow.name);
    await this.workflows.save(workflow);
    return workflow;
  }
}
