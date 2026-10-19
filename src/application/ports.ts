import type { Agent, AgentName } from "../domain/agent";
import type { Workflow, WorkflowName } from "../domain/workflow";

export type AgentRepository = {
  list: () => Promise<Agent[]>;
  find: (name: AgentName) => Promise<Agent | null>;
  exists: (name: AgentName) => Promise<boolean>;
  save: (agent: Agent) => Promise<void>;
  rename: (previousName: AgentName, agent: Agent) => Promise<void>;
  delete: (name: AgentName) => Promise<void>;
};

export type WorkflowRepository = {
  list: () => Promise<Workflow[]>;
  find: (name: WorkflowName) => Promise<Workflow | null>;
  exists: (name: WorkflowName) => Promise<boolean>;
  save: (workflow: Workflow) => Promise<void>;
  delete: (name: WorkflowName) => Promise<void>;
};
