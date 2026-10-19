import type { CreateWorkflow } from "../../application/workflows/create-workflow";
import type { DeleteWorkflow } from "../../application/workflows/delete-workflow";
import type { ListWorkflows } from "../../application/workflows/list-workflows";
import type { UpdateWorkflow } from "../../application/workflows/update-workflow";
import type { ValidateWorkflow } from "../../application/workflows/validate-workflow";
import { workflowDocument } from "../../domain/workflow";
import { methodNotAllowed, type ApiRoute } from "./api-responses";
import { readJsonBody, readWorkflowChanges, requiredString } from "./request-body";

const WORKFLOWS_PATH = "/api/workflows";
const WORKFLOW_VALIDATIONS_PATH = "/api/workflow-validations";
const WORKFLOW_PATH = /^\/api\/workflows\/([a-z0-9][a-z0-9-]*)$/;

export type WorkflowUseCases = {
  listWorkflows: ListWorkflows;
  createWorkflow: CreateWorkflow;
  updateWorkflow: UpdateWorkflow;
  deleteWorkflow: DeleteWorkflow;
  validateWorkflow: ValidateWorkflow;
};

async function readWorkflow(request: Request) {
  const body = await readJsonBody(request);
  return { ...readWorkflowChanges(body), name: requiredString(body, "name") };
}

export function createWorkflowRoutes(useCases: WorkflowUseCases): ApiRoute {
  return async (request, url) => {
    if (url.pathname === WORKFLOWS_PATH) {
      if (request.method === "GET") return Response.json(await useCases.listWorkflows.execute());
      if (request.method !== "POST") return methodNotAllowed();
      return Response.json(await useCases.createWorkflow.execute(await readWorkflow(request)), { status: 201 });
    }
    if (url.pathname === WORKFLOW_VALIDATIONS_PATH) {
      if (request.method !== "POST") return methodNotAllowed();
      const workflow = await readWorkflow(request);
      return Response.json({ problems: await useCases.validateWorkflow.execute(workflow), document: workflowDocument(workflow) });
    }
    const workflowName = url.pathname.match(WORKFLOW_PATH)?.[1];
    if (workflowName === undefined) return null;
    if (request.method === "PUT") {
      return Response.json(await useCases.updateWorkflow.execute(workflowName, readWorkflowChanges(await readJsonBody(request))));
    }
    if (request.method !== "DELETE") return methodNotAllowed();
    await useCases.deleteWorkflow.execute(workflowName);
    return new Response(null, { status: 204 });
  };
}
