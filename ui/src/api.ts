export type Agent = {
  name: string;
  description: string;
  model: string | null;
  tools: string[];
  maxTurns: number | null;
  instructions: string;
};

export type ExitKind = "handoff" | "devolucao";

export type Exit = { kind: ExitKind; to: string; maxReturns: number | null };

export type CanvasPosition = { x: number; y: number };

export type Etapa = { name: string; agent: string; exits: Exit[]; position: CanvasPosition | null };

export type Workflow = {
  name: string;
  entry: string;
  etapas: Etapa[];
  entryPosition: CanvasPosition | null;
  endPosition: CanvasPosition | null;
};

export type WorkflowValidation = { problems: string[]; document: string };

export type ListedWorkflow = Workflow & { problems: string[] };

export const END = "Fim";

export class DaemonRequestError extends Error {
  constructor(
    message: string,
    readonly problems: string[],
  ) {
    super(message);
  }
}

async function request<Body>(method: string, path: string, payload?: unknown): Promise<Body> {
  const response = await fetch(path, {
    method,
    headers: payload === undefined ? undefined : { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new DaemonRequestError(body?.error ?? response.statusText, body?.problems ?? []);
  return body as Body;
}

export const api = {
  listAgents: () => request<Agent[]>("GET", "/api/agents"),
  createAgent: (agent: Agent) => request<Agent>("POST", "/api/agents", agent),
  createBlankAgent: () => request<Agent>("POST", "/api/agent-drafts"),
  updateAgent: (previousName: string, agent: Agent) => request<Agent>("PUT", `/api/agents/${previousName}`, agent),
  deleteAgent: (name: string) => request<null>("DELETE", `/api/agents/${name}`),
  listWorkflows: () => request<ListedWorkflow[]>("GET", "/api/workflows"),
  createWorkflow: (workflow: Workflow) => request<Workflow>("POST", "/api/workflows", workflow),
  updateWorkflow: (workflow: Workflow) => request<Workflow>("PUT", `/api/workflows/${workflow.name}`, workflow),
  deleteWorkflow: (name: string) => request<null>("DELETE", `/api/workflows/${name}`),
  validateWorkflow: (workflow: Workflow) => request<WorkflowValidation>("POST", "/api/workflow-validations", workflow),
  getConfig: () => request<{ claudeDirectory: string }>("GET", "/api/config"),
};
