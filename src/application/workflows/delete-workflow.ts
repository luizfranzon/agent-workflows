import { WorkflowNotFoundError, type WorkflowName } from "../../domain/workflow";
import type { WorkflowRepository } from "../ports";

export class DeleteWorkflow {
  constructor(private readonly workflows: WorkflowRepository) {}

  async execute(name: WorkflowName) {
    if ((await this.workflows.find(name)) === null) throw new WorkflowNotFoundError(name);
    await this.workflows.delete(name);
  }
}
