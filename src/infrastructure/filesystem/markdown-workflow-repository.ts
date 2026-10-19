import type { WorkflowRepository } from "../../application/ports";
import { parseWorkflowDocument, workflowDocument, type Workflow, type WorkflowName } from "../../domain/workflow";
import { MarkdownDirectory } from "./markdown-directory";

export class MarkdownWorkflowRepository implements WorkflowRepository {
  private readonly files: MarkdownDirectory;

  constructor(directory: string) {
    this.files = new MarkdownDirectory(directory);
  }

  async list() {
    const workflows = await Promise.all((await this.files.names()).map((name) => this.find(name)));
    return workflows.filter((workflow): workflow is Workflow => workflow !== null);
  }

  async find(name: WorkflowName) {
    const document = await this.files.read(name);
    if (document === null) return null;
    try {
      return parseWorkflowDocument(name, document);
    } catch {
      return null;
    }
  }

  async save(workflow: Workflow) {
    await this.files.write(workflow.name, workflowDocument(workflow));
  }

  async exists(name: string) {
    return (await this.files.read(name)) !== null;
  }

  async delete(name: WorkflowName) {
    await this.files.delete(name);
  }
}
