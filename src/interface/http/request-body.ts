import { EXIT_KINDS, type CanvasPosition, type Etapa, type Exit, type Workflow } from "../../domain/workflow";
import type { Agent } from "../../domain/agent";

export class InvalidRequestBodyError extends Error {}

type JsonBody = Record<string, unknown>;

export async function readJsonBody(request: Request): Promise<JsonBody> {
  const body = await request.json().catch(() => null);
  return asObject(body, "Corpo JSON inválido");
}

export function readAgentChanges(body: JsonBody): Omit<Agent, "name"> {
  return {
    description: requiredString(body, "description"),
    model: optionalString(body, "model"),
    tools: stringArray(body, "tools"),
    maxTurns: optionalInteger(body, "maxTurns"),
    instructions: requiredString(body, "instructions"),
  };
}

export function readWorkflowChanges(body: JsonBody): Omit<Workflow, "name"> {
  const etapas = body.etapas;
  if (!Array.isArray(etapas)) throw new InvalidRequestBodyError("Campo deve ser lista: etapas");
  return {
    entry: requiredString(body, "entry"),
    etapas: etapas.map(readEtapa),
    entryPosition: optionalPosition(body.entryPosition),
    endPosition: optionalPosition(body.endPosition),
  };
}

export function optionalName(body: JsonBody) {
  return optionalString(body, "name");
}

export function requiredString(body: JsonBody, field: string) {
  const value = body[field];
  if (typeof value !== "string") throw new InvalidRequestBodyError(`Campo obrigatório: ${field}`);
  return value;
}

function readEtapa(candidate: unknown): Etapa {
  const etapa = asObject(candidate, "Etapa inválida");
  const exits = etapa.exits;
  if (!Array.isArray(exits)) throw new InvalidRequestBodyError("Campo deve ser lista: exits");
  return {
    name: requiredString(etapa, "name").trim(),
    agent: requiredString(etapa, "agent"),
    exits: exits.map(readExit),
    position: optionalPosition(etapa.position),
  };
}

function readExit(candidate: unknown): Exit {
  const exit = asObject(candidate, "Saída inválida");
  const kind = EXIT_KINDS.find((known) => known === exit.kind);
  if (kind === undefined) throw new InvalidRequestBodyError(`Tipo de saída desconhecido: ${String(exit.kind)}`);
  return { kind, to: requiredString(exit, "to").trim(), maxReturns: kind === "devolucao" ? optionalInteger(exit, "maxReturns") : null };
}

function optionalPosition(candidate: unknown): CanvasPosition | null {
  if (candidate === undefined || candidate === null) return null;
  const position = asObject(candidate, "Posição inválida");
  const isFiniteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);
  if (!isFiniteNumber(position.x) || !isFiniteNumber(position.y)) throw new InvalidRequestBodyError("Posição precisa de x e y numéricos");
  return { x: position.x as number, y: position.y as number };
}

function asObject(candidate: unknown, message: string) {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) throw new InvalidRequestBodyError(message);
  return candidate as JsonBody;
}

function optionalString(body: JsonBody, field: string) {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new InvalidRequestBodyError(`Campo deve ser texto: ${field}`);
  return value;
}

function optionalInteger(body: JsonBody, field: string) {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new InvalidRequestBodyError(`Campo deve ser inteiro: ${field}`);
  return value;
}

function stringArray(body: JsonBody, field: string) {
  const value = body[field] ?? [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new InvalidRequestBodyError(`Campo deve ser lista de textos: ${field}`);
  }
  return value as string[];
}
