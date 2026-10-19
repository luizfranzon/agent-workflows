import type { AgentRepository } from "../../application/ports";
import { agentDocument, parseAgentDocument, type Agent, type AgentName } from "../../domain/agent";
import { MarkdownDirectory } from "./markdown-directory";

export class MarkdownAgentRepository implements AgentRepository {
  private readonly files: MarkdownDirectory;

  constructor(directory: string) {
    this.files = new MarkdownDirectory(directory);
  }

  async list() {
    const agents = await Promise.all((await this.files.names()).map((name) => this.find(name)));
    return agents.filter((agent): agent is Agent => agent !== null);
  }

  async find(name: AgentName) {
    return (await this.readDocument(name))?.agent ?? null;
  }

  async save(agent: Agent) {
    const preservedFrontmatter = (await this.readDocument(agent.name))?.preservedFrontmatter ?? [];
    await this.files.write(agent.name, agentDocument(agent, preservedFrontmatter));
  }

  async rename(previousName: AgentName, agent: Agent) {
    const preservedFrontmatter = (await this.readDocument(previousName))?.preservedFrontmatter ?? [];
    await this.files.write(agent.name, agentDocument(agent, preservedFrontmatter));
    await this.files.delete(previousName);
  }

  async exists(name: string) {
    return (await this.files.read(name)) !== null;
  }

  async delete(name: AgentName) {
    await this.files.delete(name);
  }

  private async readDocument(name: AgentName) {
    const document = await this.files.read(name);
    if (document === null) return null;
    try {
      return parseAgentDocument(name, document);
    } catch {
      return null;
    }
  }
}
