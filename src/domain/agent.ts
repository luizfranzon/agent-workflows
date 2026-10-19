export type AgentName = string;

export type Agent = {
  name: AgentName;
  description: string;
  model: string | null;
  tools: string[];
  maxTurns: number | null;
  instructions: string;
};

export type AgentDocument = { agent: Agent; preservedFrontmatter: string[] };

const FRONTMATTER_FENCE = "---";
const EDITABLE_KEYS = ["name", "description", "model", "tools", "maxTurns"];
const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;
const BLANK_AGENT_NAME = /^agente-(\d+)$/;

export const BLANK_AGENT_DESCRIPTION = "Descreva quando o Claude deve usar este Agente";

export function nextBlankAgentName(takenNames: AgentName[]) {
  const usedNumbers = takenNames.map((name) => Number(name.match(BLANK_AGENT_NAME)?.[1] ?? 0));
  const nextNumber = Math.max(0, ...usedNumbers) + 1;
  return `agente-${String(nextNumber).padStart(2, "0")}`;
}

export function isSafeName(candidate: string) {
  return SAFE_NAME.test(candidate);
}

export function parseAgent(candidate: Agent): Agent {
  if (!isSafeName(candidate.name)) throw new InvalidAgentError("Nome do Agente: só letras minúsculas, números e hífen");
  const description = singleLine(candidate.description);
  if (description === "") throw new InvalidAgentError("O Agente precisa de uma descrição");
  const maxTurnsIsValid = candidate.maxTurns === null || (Number.isInteger(candidate.maxTurns) && candidate.maxTurns > 0);
  if (!maxTurnsIsValid) throw new InvalidAgentError("maxTurns precisa ser inteiro positivo");
  return {
    name: candidate.name,
    description,
    model: singleLine(candidate.model ?? "") || null,
    tools: candidate.tools.map(singleLine).filter((tool) => tool !== ""),
    maxTurns: candidate.maxTurns,
    instructions: candidate.instructions.trim(),
  };
}

export function parseAgentDocument(name: AgentName, document: string): AgentDocument {
  const lines = document.replaceAll("\r\n", "\n").split("\n");
  if (lines[0]?.trim() !== FRONTMATTER_FENCE) throw new InvalidAgentDocumentError(name);
  const closingFence = lines.findIndex((line, index) => index > 0 && line.trim() === FRONTMATTER_FENCE);
  if (closingFence === -1) throw new InvalidAgentDocumentError(name);

  const entries = frontmatterEntries(lines.slice(1, closingFence));
  const valueOf = (key: string) => unquote(entries.find((entry) => entry.key === key)?.value ?? "");
  const toolsEntry = entries.find((entry) => entry.key === "tools");
  const maxTurns = Number(valueOf("maxTurns"));

  return {
    agent: {
      name,
      description: valueOf("description"),
      model: valueOf("model") || null,
      tools: toolsEntry === undefined ? [] : toolsOf(toolsEntry),
      maxTurns: Number.isInteger(maxTurns) && maxTurns > 0 ? maxTurns : null,
      instructions: lines.slice(closingFence + 1).join("\n").trim(),
    },
    preservedFrontmatter: entries.filter((entry) => !EDITABLE_KEYS.includes(entry.key)).flatMap((entry) => entry.lines),
  };
}

export function agentDocument(agent: Agent, preservedFrontmatter: string[]) {
  const editableFrontmatter = [
    `name: ${agent.name}`,
    `description: ${JSON.stringify(agent.description)}`,
    ...(agent.model === null ? [] : [`model: ${agent.model}`]),
    ...(agent.tools.length === 0 ? [] : [`tools: ${agent.tools.join(", ")}`]),
    ...(agent.maxTurns === null ? [] : [`maxTurns: ${agent.maxTurns}`]),
  ];
  return [FRONTMATTER_FENCE, ...editableFrontmatter, ...preservedFrontmatter, FRONTMATTER_FENCE, agent.instructions, ""].join("\n");
}

type FrontmatterEntry = { key: string; value: string; lines: string[] };

function frontmatterEntries(frontmatterLines: string[]) {
  const entries: FrontmatterEntry[] = [];
  for (const line of frontmatterLines) {
    const startsNewEntry = /^[A-Za-z_][\w-]*\s*:/.test(line);
    const current = entries.at(-1);
    if (startsNewEntry) {
      const separator = line.indexOf(":");
      entries.push({ key: line.slice(0, separator).trim(), value: line.slice(separator + 1).trim(), lines: [line] });
    } else if (current !== undefined) {
      current.lines.push(line);
    }
  }
  return entries;
}

function toolsOf(entry: FrontmatterEntry) {
  const listItems = entry.lines.slice(1).map((line) => line.trim()).filter((line) => line.startsWith("- "));
  const inlineValue = entry.value.replace(/^\[|\]$/g, "");
  const tools = listItems.length > 0 ? listItems.map((item) => item.slice(2)) : inlineValue.split(",");
  return tools.map((tool) => unquote(tool.trim())).filter((tool) => tool !== "");
}

function unquote(value: string) {
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) return value.slice(1, -1).replaceAll("''", "'");
  return value;
}

function singleLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export class InvalidAgentError extends Error {}

export class InvalidAgentDocumentError extends Error {
  constructor(name: AgentName) {
    super(`O arquivo do Agente "${name}" precisa começar com frontmatter entre linhas ---`);
  }
}

export class AgentNotFoundError extends Error {
  constructor(name: AgentName) {
    super(`Agente não encontrado: ${name}`);
  }
}

export class AgentAlreadyExistsError extends Error {
  constructor(name: AgentName) {
    super(`Já existe um Agente chamado "${name}"`);
  }
}

export class AgentInUseError extends Error {
  constructor(name: AgentName, workflowNames: string[]) {
    super(`O Agente "${name}" é usado pelos Workflows: ${workflowNames.join(", ")}`);
  }
}
