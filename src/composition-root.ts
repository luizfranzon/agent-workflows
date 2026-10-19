import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { CreateAgent } from "./application/agents/create-agent";
import { CreateBlankAgent } from "./application/agents/create-blank-agent";
import { DeleteAgent } from "./application/agents/delete-agent";
import { ListAgents } from "./application/agents/list-agents";
import { UpdateAgent } from "./application/agents/update-agent";
import { BrowserAuthentication } from "./application/browser-authentication";
import { CreateWorkflow } from "./application/workflows/create-workflow";
import { DeleteWorkflow } from "./application/workflows/delete-workflow";
import { ListWorkflows } from "./application/workflows/list-workflows";
import { UpdateWorkflow } from "./application/workflows/update-workflow";
import { ValidateWorkflow } from "./application/workflows/validate-workflow";
import { AccessCredentials } from "./domain/access-credentials";
import { installWorkflowSkill, type SkillInstallation } from "./infrastructure/filesystem/install-workflow-skill";
import { MarkdownAgentRepository } from "./infrastructure/filesystem/markdown-agent-repository";
import { MarkdownWorkflowRepository } from "./infrastructure/filesystem/markdown-workflow-repository";
import { acquireInstanceLock } from "./infrastructure/process/pid-file-instance-lock";
import { createAgentRoutes } from "./interface/http/agent-routes";
import { createConfigRoutes } from "./interface/http/config-routes";
import { createDaemonRequestHandler } from "./interface/http/daemon-server";
import { serveOnFreePort } from "./interface/http/serve-on-free-port";
import { createWorkflowRoutes } from "./interface/http/workflow-routes";

export type DaemonConfiguration = {
  dataDirectory: string;
  claudeDirectory: string;
  uiDirectory: string;
  preferredPort: number;
};

export type RunningDaemon = {
  launchLink: string;
  port: number;
  skillInstallation: SkillInstallation;
  stop: () => Promise<void>;
};

const LOOPBACK_ADDRESS = "127.0.0.1";

export async function startDaemon(configuration: DaemonConfiguration): Promise<RunningDaemon> {
  await mkdir(configuration.dataDirectory, { recursive: true, mode: 0o700 });
  const instanceLock = await acquireInstanceLock(configuration.dataDirectory);

  try {
    const credentials = new AccessCredentials(generateSecret(), generateSecret());
    const authentication = new BrowserAuthentication(credentials);
    const agents = new MarkdownAgentRepository(join(configuration.claudeDirectory, "agents"));
    const workflows = new MarkdownWorkflowRepository(join(configuration.claudeDirectory, "workflows"));
    const validateWorkflow = new ValidateWorkflow(agents);
    const skillInstallation = await installWorkflowSkill(configuration.claudeDirectory);

    const handleRequest = createDaemonRequestHandler({
      authentication,
      uiDirectory: configuration.uiDirectory,
      apiRoutes: [
        createConfigRoutes(configuration.claudeDirectory),
        createAgentRoutes({
          listAgents: new ListAgents(agents),
          createAgent: new CreateAgent(agents),
          createBlankAgent: new CreateBlankAgent(agents),
          updateAgent: new UpdateAgent(agents, workflows),
          deleteAgent: new DeleteAgent(agents, workflows),
        }),
        createWorkflowRoutes({
          listWorkflows: new ListWorkflows(workflows, validateWorkflow),
          createWorkflow: new CreateWorkflow(workflows, validateWorkflow),
          updateWorkflow: new UpdateWorkflow(workflows, validateWorkflow),
          deleteWorkflow: new DeleteWorkflow(workflows),
          validateWorkflow,
        }),
      ],
    });
    const server = serveOnFreePort(configuration.preferredPort, (port) =>
      Bun.serve({ hostname: LOOPBACK_ADDRESS, port, fetch: handleRequest }),
    );

    return {
      launchLink: `http://${LOOPBACK_ADDRESS}:${server.port}/?token=${credentials.launchToken}`,
      port: server.port!,
      skillInstallation,
      stop: async () => {
        await server.stop(true);
        await instanceLock.release();
      },
    };
  } catch (error) {
    await instanceLock.release();
    throw error;
  }
}

function generateSecret() {
  return randomBytes(32).toString("base64url");
}
