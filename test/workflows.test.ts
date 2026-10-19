import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { startTestDaemon, type TestDaemon } from "./support/daemon-harness";

let daemon: TestDaemon;

afterEach(async () => {
  await daemon?.stop();
});

const feature = {
  name: "feature",
  entry: "Planejar",
  etapas: [
    { name: "Planejar", agent: "planner", exits: [{ kind: "handoff", to: "Implementar" }] },
    { name: "Implementar", agent: "implementer", exits: [{ kind: "handoff", to: "Revisar" }] },
    {
      name: "Revisar",
      agent: "reviewer",
      exits: [
        { kind: "handoff", to: "Fim" },
        { kind: "devolucao", to: "Implementar", maxReturns: 2 },
      ],
    },
  ],
};

const FEATURE_DOCUMENT = `# Workflow: feature

Entrada → Planejar

## Planejar
agente: planner
saídas:
- handoff → Implementar

## Implementar
agente: implementer
saídas:
- handoff → Revisar

## Revisar
agente: reviewer
saídas:
- handoff → Fim
- devolução → Implementar (máx 2)
`;

async function startWithAgents() {
  daemon = await startTestDaemon();
  for (const name of ["planner", "implementer", "reviewer"]) {
    await daemon.sendJson("POST", "/api/agents", { name, description: name, tools: [], instructions: "" });
  }
}

async function problemsOf(workflow: unknown) {
  return ((await (await daemon.sendJson("POST", "/api/workflow-validations", workflow)).json()) as { problems: string[] }).problems;
}

describe("CRUD de Workflows", () => {
  test("cria o Workflow como texto em workflows/<nome>.md", async () => {
    await startWithAgents();

    const response = await daemon.sendJson("POST", "/api/workflows", feature);

    expect(response.status).toBe(201);
    expect(await Bun.file(join(daemon.claudeDirectory, "workflows", "feature.md")).text()).toBe(FEATURE_DOCUMENT);
  });

  test("lista Workflows lidos do texto, com problemas atuais", async () => {
    await startWithAgents();
    await Bun.write(join(daemon.claudeDirectory, "workflows", "feature.md"), FEATURE_DOCUMENT);

    const workflows = await (await daemon.request("/api/workflows")).json();

    expect(workflows).toEqual([
      {
        ...feature,
        entryPosition: null,
        endPosition: null,
        etapas: feature.etapas.map((etapa) => ({
          ...etapa,
          position: null,
          exits: etapa.exits.map((exit) => ({ maxReturns: null, ...exit })),
        })),
        problems: [],
      },
    ]);
  });

  test("guarda as posições do canvas no texto e as lê de volta", async () => {
    await startWithAgents();
    const positioned = {
      name: "posicionado",
      entry: "Planejar",
      entryPosition: { x: 0, y: 120 },
      endPosition: { x: 640.4, y: 120 },
      etapas: [{ name: "Planejar", agent: "planner", position: { x: 260, y: -40 }, exits: [{ kind: "handoff", to: "Fim" }] }],
    };

    await daemon.sendJson("POST", "/api/workflows", positioned);
    const document = await Bun.file(join(daemon.claudeDirectory, "workflows", "posicionado.md")).text();
    const [listed] = (await (await daemon.request("/api/workflows")).json()) as (typeof positioned)[];

    expect(document).toContain("Entrada → Planejar\nposição Entrada: 0, 120\nposição Fim: 640, 120\n");
    expect(document).toContain("agente: planner\nposição: 260, -40\nsaídas:");
    expect(listed!.endPosition).toEqual({ x: 640, y: 120 });
    expect(listed!.etapas[0]!.position).toEqual({ x: 260, y: -40 });
  });

  test("validação devolve o texto que será gravado", async () => {
    await startWithAgents();

    const validation = (await (await daemon.sendJson("POST", "/api/workflow-validations", feature)).json()) as { document: string };

    expect(validation.document).toBe(FEATURE_DOCUMENT);
  });

  test("lista mostra problema quando o Agente de uma Etapa some do disco", async () => {
    await startWithAgents();
    await daemon.sendJson("POST", "/api/workflows", feature);
    await Bun.file(join(daemon.claudeDirectory, "agents", "reviewer.md")).delete();

    const [workflow] = (await (await daemon.request("/api/workflows")).json()) as { problems: string[] }[];

    expect(workflow!.problems).toEqual(['Etapa "Revisar": Agente "reviewer" não existe']);
  });

  test("atualiza e apaga o Workflow", async () => {
    await startWithAgents();
    await daemon.sendJson("POST", "/api/workflows", feature);

    const updated = await daemon.sendJson("PUT", "/api/workflows/feature", {
      entry: "Implementar",
      etapas: [{ name: "Implementar", agent: "implementer", exits: [{ kind: "handoff", to: "Fim" }] }],
    });
    const deleted = await daemon.sendJson("DELETE", "/api/workflows/feature");

    expect(updated.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(await Bun.file(join(daemon.claudeDirectory, "workflows", "feature.md")).exists()).toBe(false);
  });

  test("recusa salvar Workflow inválido e devolve os problemas", async () => {
    await startWithAgents();

    const response = await daemon.sendJson("POST", "/api/workflows", { ...feature, entry: "Nada" });

    expect(response.status).toBe(422);
    expect(((await response.json()) as { problems: string[] }).problems).toEqual(["A Entrada precisa apontar para uma Etapa"]);
  });

  test("recusa criar Workflow com nome já usado", async () => {
    await startWithAgents();
    await daemon.sendJson("POST", "/api/workflows", feature);

    expect((await daemon.sendJson("POST", "/api/workflows", feature)).status).toBe(409);
  });
});

describe("validação de Workflow", () => {
  test("Workflow com Entrada, handoffs até o Fim e devolução para Etapa anterior é válido", async () => {
    await startWithAgents();

    expect(await problemsOf(feature)).toEqual([]);
  });

  test("aponta Agente inexistente e handoff para Etapa inexistente", async () => {
    await startWithAgents();

    const problems = await problemsOf({
      name: "x",
      entry: "A",
      etapas: [{ name: "A", agent: "ninguem", exits: [{ kind: "handoff", to: "B" }] }],
    });

    expect(problems).toEqual(['Etapa "A": Agente "ninguem" não existe', 'Etapa "A": handoff para Etapa inexistente "B"']);
  });

  test("aponta ciclo de handoffs e Etapa que não chega ao Fim", async () => {
    await startWithAgents();

    const problems = await problemsOf({
      name: "x",
      entry: "A",
      etapas: [
        { name: "A", agent: "planner", exits: [{ kind: "handoff", to: "B" }] },
        { name: "B", agent: "planner", exits: [{ kind: "handoff", to: "A" }] },
      ],
    });

    expect(problems).toContain('Etapa "A": handoffs formam um ciclo');
    expect(problems).toContain('Etapa "B": não chega ao Fim por handoffs');
  });

  test("aponta Etapa inalcançável a partir da Entrada", async () => {
    await startWithAgents();

    const problems = await problemsOf({
      name: "x",
      entry: "A",
      etapas: [
        { name: "A", agent: "planner", exits: [{ kind: "handoff", to: "Fim" }] },
        { name: "B", agent: "planner", exits: [{ kind: "handoff", to: "Fim" }] },
      ],
    });

    expect(problems).toEqual(['Etapa "B": não é alcançável a partir da Entrada']);
  });

  test("aponta devolução para Etapa que não é anterior", async () => {
    await startWithAgents();

    const problems = await problemsOf({
      name: "x",
      entry: "A",
      etapas: [
        { name: "A", agent: "planner", exits: [{ kind: "handoff", to: "B" }, { kind: "devolucao", to: "B" }] },
        { name: "B", agent: "planner", exits: [{ kind: "handoff", to: "Fim" }] },
      ],
    });

    expect(problems).toEqual(['Etapa "A": devolução para "B", que não é uma Etapa anterior']);
  });

  test("aponta nome reservado, duplicado e Workflow sem Etapas", async () => {
    await startWithAgents();

    expect(await problemsOf({ name: "x", entry: "A", etapas: [] })).toEqual([
      "O Workflow precisa de ao menos uma Etapa",
      "A Entrada precisa apontar para uma Etapa",
    ]);
    expect(
      await problemsOf({
        name: "x",
        entry: "Fim",
        etapas: [
          { name: "Fim", agent: "planner", exits: [] },
          { name: "A", agent: "planner", exits: [] },
          { name: "A", agent: "planner", exits: [] },
        ],
      }),
    ).toEqual(['"Fim" é reservado e não pode ser nome de Etapa', 'Etapa duplicada: "A"']);
  });

  test("recusa tipo de saída desconhecido", async () => {
    await startWithAgents();

    const response = await daemon.sendJson("POST", "/api/workflow-validations", {
      name: "x",
      entry: "A",
      etapas: [{ name: "A", agent: "planner", exits: [{ kind: "pulo", to: "Fim" }] }],
    });

    expect(response.status).toBe(400);
  });
});
