import { WorkflowNotFoundError, type Workflow, type WorkflowName } from "../../domain/workflow";
import type { WorkflowRepository } from "../ports";
import type { ValidateWorkflow } from "./validate-workflow";

export class UpdateWorkflow {
  constructor(
    private readonly workflows: WorkflowRepository,
    private readonly validateWorkflow: ValidateWorkflow,
  ) {}

  async execute(name: WorkflowName, changes: Omit<Workflow, "name">) {
    if ((await this.workflows.find(name)) === null) throw new WorkflowNotFoundError(name);
    const workflow = { ...changes, name };
    await this.validateWorkflow.requireValid(workflow);
    await this.workflows.save(workflow);
    return workflow;
  }
}
