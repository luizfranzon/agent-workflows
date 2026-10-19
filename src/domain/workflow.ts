import { isSafeName, type AgentName } from "./agent";

export type WorkflowName = string;

export const END = "Fim";

export const EXIT_KINDS = ["handoff", "devolucao"] as const;

export type ExitKind = (typeof EXIT_KINDS)[number];

export type Exit = { kind: ExitKind; to: string; maxReturns: number | null };

export type CanvasPosition = { x: number; y: number };

export type Etapa = { name: string; agent: AgentName; exits: Exit[]; position: CanvasPosition | null };

export type Workflow = {
  name: WorkflowName;
  entry: string;
  etapas: Etapa[];
  entryPosition: CanvasPosition | null;
  endPosition: CanvasPosition | null;
};

const DEFAULT_MAX_RETURNS = 3;
const ARROW = "→";
const EXIT_LABEL: Record<ExitKind, string> = { handoff: "handoff", devolucao: "devolução" };
const HEADER = /^# Workflow:\s*(.+)$/;
const ENTRY = /^Entrada\s*(?:→|->)\s*(.+)$/;
const ETAPA = /^## (.+)$/;
const AGENT = /^agente:\s*(.+)$/;
const ETAPA_POSITION = /^posição:\s*(-?\d+),\s*(-?\d+)$/;
const ENTRY_POSITION = /^posição Entrada:\s*(-?\d+),\s*(-?\d+)$/;
const END_POSITION = /^posição Fim:\s*(-?\d+),\s*(-?\d+)$/;
const EXIT = /^- (handoff|devolução|devolucao)\s*(?:→|->)\s*(.+?)(?:\s*\(máx (\d+)\))?$/;

export function workflowProblems(workflow: Workflow, existingAgents: AgentName[]) {
  const etapaNames = workflow.etapas.map((etapa) => etapa.name);
  const problems = [
    ...(isSafeName(workflow.name) ? [] : ["Nome do Workflow: só letras minúsculas, números e hífen"]),
    ...(workflow.etapas.length === 0 ? ["O Workflow precisa de ao menos uma Etapa"] : []),
    ...(etapaNames.includes(workflow.entry) ? [] : ["A Entrada precisa apontar para uma Etapa"]),
    ...etapaNameProblems(etapaNames),
    ...workflow.etapas.flatMap((etapa) => etapaProblems(etapa, etapaNames, existingAgents)),
  ];
  if (problems.length > 0) return problems;
  return graphProblems(workflow);
}

export function maxReturnsOf(exit: Exit) {
  return exit.maxReturns ?? DEFAULT_MAX_RETURNS;
}

export function workflowDocument(workflow: Workflow) {
  const header = [
    `Entrada ${ARROW} ${workflow.entry}`,
    ...positionLine("posição Entrada", workflow.entryPosition),
    ...positionLine("posição Fim", workflow.endPosition),
  ].join("\n");
  const etapaSections = workflow.etapas.map((etapa) =>
    [`## ${etapa.name}`, `agente: ${etapa.agent}`, ...positionLine("posição", etapa.position), "saídas:", ...etapa.exits.map(exitLine)].join("\n"),
  );
  return [`# Workflow: ${workflow.name}`, header, ...etapaSections].join("\n\n") + "\n";
}

export function parseWorkflowDocument(name: WorkflowName, document: string): Workflow {
  const workflow: Workflow = { name, entry: "", etapas: [], entryPosition: null, endPosition: null };
  for (const line of document.replaceAll("\r\n", "\n").split("\n").map((rawLine) => rawLine.trim())) {
    const currentEtapa = workflow.etapas.at(-1);
    const etapaMatch = line.match(ETAPA);
    const entryMatch = line.match(ENTRY);
    const agentMatch = line.match(AGENT);
    const exitMatch = line.match(EXIT);
    const etapaPositionMatch = line.match(ETAPA_POSITION);
    const entryPositionMatch = line.match(ENTRY_POSITION);
    const endPositionMatch = line.match(END_POSITION);
    if (etapaMatch) workflow.etapas.push({ name: etapaMatch[1]!.trim(), agent: "", exits: [], position: null });
    else if (entryMatch) workflow.entry = entryMatch[1]!.trim();
    else if (entryPositionMatch) workflow.entryPosition = positionFrom(entryPositionMatch);
    else if (endPositionMatch) workflow.endPosition = positionFrom(endPositionMatch);
    else if (agentMatch && currentEtapa) currentEtapa.agent = agentMatch[1]!.trim();
    else if (etapaPositionMatch && currentEtapa) currentEtapa.position = positionFrom(etapaPositionMatch);
    else if (exitMatch && currentEtapa) currentEtapa.exits.push(exitFrom(exitMatch));
    else if (!isIgnorableLine(line)) throw new InvalidWorkflowDocumentError(name, line);
  }
  return workflow;
}

function positionLine(label: string, position: CanvasPosition | null) {
  return position === null ? [] : [`${label}: ${Math.round(position.x)}, ${Math.round(position.y)}`];
}

function positionFrom(match: RegExpMatchArray): CanvasPosition {
  return { x: Number(match[1]), y: Number(match[2]) };
}

function exitLine(exit: Exit) {
  const maxSuffix = exit.kind === "devolucao" ? ` (máx ${maxReturnsOf(exit)})` : "";
  return `- ${EXIT_LABEL[exit.kind]} ${ARROW} ${exit.to}${maxSuffix}`;
}

function exitFrom(match: RegExpMatchArray): Exit {
  const kind: ExitKind = match[1] === "handoff" ? "handoff" : "devolucao";
  return { kind, to: match[2]!.trim(), maxReturns: kind === "devolucao" && match[3] !== undefined ? Number(match[3]) : null };
}

function isIgnorableLine(line: string) {
  return line === "" || line === "saídas:" || HEADER.test(line);
}

function etapaNameProblems(etapaNames: string[]) {
  const duplicated = etapaNames.filter((name, index) => etapaNames.indexOf(name) !== index);
  return [
    ...(etapaNames.some((name) => name.trim() === "") ? ["Toda Etapa precisa de nome"] : []),
    ...(etapaNames.includes(END) ? [`"${END}" é reservado e não pode ser nome de Etapa`] : []),
    ...[...new Set(duplicated)].map((name) => `Etapa duplicada: "${name}"`),
    ...etapaNames.filter((name) => /[→\n]|->|\(máx/.test(name)).map((name) => `Nome de Etapa com caractere reservado: "${name}"`),
  ];
}

function etapaProblems(etapa: Etapa, etapaNames: string[], existingAgents: AgentName[]) {
  const label = `Etapa "${etapa.name}"`;
  return [
    ...(existingAgents.includes(etapa.agent) ? [] : [`${label}: Agente "${etapa.agent}" não existe`]),
    ...etapa.exits.flatMap((exit) => {
      if (exit.kind === "handoff") {
        if (exit.to === etapa.name) return [`${label}: handoff para ela mesma`];
        return exit.to === END || etapaNames.includes(exit.to) ? [] : [`${label}: handoff para Etapa inexistente "${exit.to}"`];
      }
      if (!etapaNames.includes(exit.to)) return [`${label}: devolução precisa voltar para uma Etapa existente`];
      const maxIsValid = exit.maxReturns === null || (Number.isInteger(exit.maxReturns) && exit.maxReturns > 0);
      return maxIsValid ? [] : [`${label}: máximo de devoluções precisa ser inteiro positivo`];
    }),
  ];
}

function graphProblems(workflow: Workflow) {
  const handoffTargets = new Map(
    workflow.etapas.map((etapa) => [etapa.name, etapa.exits.filter((exit) => exit.kind === "handoff").map((exit) => exit.to)]),
  );
  const reachableFrom = (start: string) => {
    const reached = new Set<string>();
    const pending = [...(handoffTargets.get(start) ?? [])];
    while (pending.length > 0) {
      const next = pending.pop()!;
      if (reached.has(next)) continue;
      reached.add(next);
      pending.push(...(handoffTargets.get(next) ?? []));
    }
    return reached;
  };
  const reachableFromEntry = new Set([workflow.entry, ...reachableFrom(workflow.entry)]);

  return workflow.etapas.flatMap((etapa) => {
    const label = `Etapa "${etapa.name}"`;
    const downstream = reachableFrom(etapa.name);
    return [
      ...(downstream.has(etapa.name) ? [`${label}: handoffs formam um ciclo`] : []),
      ...(reachableFromEntry.has(etapa.name) ? [] : [`${label}: não é alcançável a partir da Entrada`]),
      ...(downstream.has(END) ? [] : [`${label}: não chega ao ${END} por handoffs`]),
      ...etapa.exits
        .filter((exit) => exit.kind === "devolucao" && !reachableFrom(exit.to).has(etapa.name))
        .map((exit) => `${label}: devolução para "${exit.to}", que não é uma Etapa anterior`),
    ];
  });
}

export class InvalidWorkflowError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join("\n"));
  }
}

export class InvalidWorkflowDocumentError extends Error {
  constructor(name: WorkflowName, line: string) {
    super(`Linha não reconhecida no Workflow "${name}": ${line}`);
  }
}

export class WorkflowNotFoundError extends Error {
  constructor(name: WorkflowName) {
    super(`Workflow não encontrado: ${name}`);
  }
}

export class WorkflowAlreadyExistsError extends Error {
  constructor(name: WorkflowName) {
    super(`Já existe um Workflow chamado "${name}"`);
  }
}
