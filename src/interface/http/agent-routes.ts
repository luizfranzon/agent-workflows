import type { CreateAgent } from "../../application/agents/create-agent";
import type { CreateBlankAgent } from "../../application/agents/create-blank-agent";
import type { DeleteAgent } from "../../application/agents/delete-agent";
import type { ListAgents } from "../../application/agents/list-agents";
import type { UpdateAgent } from "../../application/agents/update-agent";
import { methodNotAllowed, type ApiRoute } from "./api-responses";
import { optionalName, readAgentChanges, readJsonBody, requiredString } from "./request-body";

const AGENTS_PATH = "/api/agents";
const AGENT_DRAFTS_PATH = "/api/agent-drafts";
const AGENT_PATH = /^\/api\/agents\/([a-z0-9][a-z0-9-]*)$/;

export type AgentUseCases = {
  listAgents: ListAgents;
  createAgent: CreateAgent;
  createBlankAgent: CreateBlankAgent;
  updateAgent: UpdateAgent;
  deleteAgent: DeleteAgent;
};

export function createAgentRoutes(useCases: AgentUseCases): ApiRoute {
  return async (request, url) => {
    if (url.pathname === AGENTS_PATH) {
      if (request.method === "GET") return Response.json(await useCases.listAgents.execute());
      if (request.method !== "POST") return methodNotAllowed();
      const body = await readJsonBody(request);
      const agent = { ...readAgentChanges(body), name: requiredString(body, "name") };
      return Response.json(await useCases.createAgent.execute(agent), { status: 201 });
    }
    if (url.pathname === AGENT_DRAFTS_PATH) {
      if (request.method !== "POST") return methodNotAllowed();
      return Response.json(await useCases.createBlankAgent.execute(), { status: 201 });
    }
    const agentName = url.pathname.match(AGENT_PATH)?.[1];
    if (agentName === undefined) return null;
    if (request.method === "PUT") {
      const body = await readJsonBody(request);
      const agent = { ...readAgentChanges(body), name: optionalName(body) ?? agentName };
      return Response.json(await useCases.updateAgent.execute(agentName, agent));
    }
    if (request.method !== "DELETE") return methodNotAllowed();
    await useCases.deleteAgent.execute(agentName);
    return new Response(null, { status: 204 });
  };
}
