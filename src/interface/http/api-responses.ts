import { AgentAlreadyExistsError, AgentInUseError, AgentNotFoundError, InvalidAgentError } from "../../domain/agent";
import { InvalidWorkflowError, WorkflowAlreadyExistsError, WorkflowNotFoundError } from "../../domain/workflow";
import { InvalidRequestBodyError } from "./request-body";

export type ApiRoute = (request: Request, url: URL) => Promise<Response | null>;

const STATUS_BY_ERROR: [new (...args: never[]) => Error, number][] = [
  [InvalidRequestBodyError, 400],
  [AgentNotFoundError, 404],
  [WorkflowNotFoundError, 404],
  [AgentAlreadyExistsError, 409],
  [WorkflowAlreadyExistsError, 409],
  [AgentInUseError, 409],
  [InvalidAgentError, 422],
];

export function errorResponse(error: unknown) {
  if (error instanceof InvalidWorkflowError) {
    return Response.json({ error: error.message, code: error.constructor.name, problems: error.problems }, { status: 422 });
  }
  const status = STATUS_BY_ERROR.find(([errorType]) => error instanceof errorType)?.[1];
  if (status === undefined) throw error;
  return Response.json({ error: (error as Error).message, code: error!.constructor.name }, { status });
}

export function notFound() {
  return Response.json({ error: "Não encontrado" }, { status: 404 });
}

export function methodNotAllowed() {
  return Response.json({ error: "Método não permitido" }, { status: 405 });
}
