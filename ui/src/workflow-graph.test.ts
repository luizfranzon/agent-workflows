import { expect, test } from "bun:test";
import type { Workflow } from "./api";
import { arranged, blankGraph, ENTRADA_ID, etapaOrder, FIM_ID, graphOf, withEtapa, withLink, withoutNodes, withToggledLink, workflowOf } from "./workflow-graph";

const feature: Workflow = {
  name: "feature",
  entry: "planner",
  entryPosition: { x: 0, y: 0 },
  endPosition: { x: 900, y: 0 },
  etapas: [
    { name: "planner", agent: "planner", position: { x: 300, y: 0 }, exits: [{ kind: "handoff", to: "reviewer", maxReturns: null }] },
    {
      name: "reviewer",
      agent: "reviewer",
      position: { x: 600, y: 0 },
      exits: [
        { kind: "handoff", to: "Fim", maxReturns: null },
        { kind: "devolucao", to: "planner", maxReturns: 2 },
      ],
    },
  ],
};

function idOf(graph: ReturnType<typeof blankGraph>, name: string) {
  return graph.nodes.find((node) => node.name === name)!.id;
}

test("converte Workflow em grafo e de volta sem perder nada", () => {
  expect(workflowOf(graphOf(feature))).toEqual(feature);
});

test("ligar para uma Etapa anterior vira devolução; para frente vira handoff", () => {
  let graph = withEtapa(withEtapa({ ...blankGraph(), name: "x" }, "planner", { x: 0, y: 0 }), "reviewer", { x: 0, y: 0 });
  const planner = idOf(graph, "planner");
  const reviewer = idOf(graph, "reviewer");

  graph = withLink(withLink(graph, planner, reviewer), reviewer, planner);

  expect(graph.links.map((link) => [link.kind, link.maxReturns])).toEqual([
    ["handoff", null],
    ["devolucao", 3],
  ]);
});

test("Entrada liga em uma Etapa só e nada liga para a Entrada ou sai do Fim", () => {
  let graph = withEtapa(withEtapa(blankGraph(), "a", { x: 0, y: 0 }), "b", { x: 0, y: 0 });

  graph = withLink(withLink(graph, ENTRADA_ID, idOf(graph, "a")), ENTRADA_ID, idOf(graph, "b"));
  graph = withLink(withLink(graph, idOf(graph, "a"), ENTRADA_ID), FIM_ID, idOf(graph, "a"));

  expect(graph.links.map((link) => [link.from, link.to])).toEqual([[ENTRADA_ID, idOf(graph, "b")]]);
});

test("repete o Agente com nome de Etapa único", () => {
  const graph = withEtapa(withEtapa(blankGraph(), "planner", { x: 0, y: 0 }), "planner", { x: 0, y: 0 });

  expect(graph.nodes.filter((node) => node.kind === "etapa").map((node) => node.name)).toEqual(["planner", "planner-2"]);
});

test("alternar ligação entre Etapas troca handoff e devolução; ligação do Fim não alterna", () => {
  const graph = graphOf(feature);
  const toEnd = graph.links.find((link) => link.to === FIM_ID)!;
  const forward = graph.links.find((link) => link.kind === "handoff" && link.to !== FIM_ID && link.from !== ENTRADA_ID)!;

  const toggled = withToggledLink(withToggledLink(graph, toEnd.id), forward.id);

  expect(toggled.links.find((link) => link.id === toEnd.id)!.kind).toBe("handoff");
  expect(toggled.links.find((link) => link.id === forward.id)!.kind).toBe("devolucao");
});

test("remover Etapa remove suas ligações e nunca remove Entrada e Fim", () => {
  const graph = graphOf(feature);

  const result = withoutNodes(graph, new Set([idOf(graph, "reviewer"), ENTRADA_ID, FIM_ID]));

  expect(result.nodes.map((node) => node.name)).toEqual(["Entrada", "planner", "Fim"]);
  expect(result.links.every((link) => link.from !== idOf(graph, "reviewer") && link.to !== idOf(graph, "reviewer"))).toBe(true);
});

test("ordena Etapas pelo fluxo e organiza em colunas por profundidade", () => {
  const graph = arranged(graphOf({ ...feature, etapas: [...feature.etapas].reverse() }));

  expect(etapaOrder(graph).map((node) => node.name)).toEqual(["planner", "reviewer"]);
  expect(etapaOrder(withEtapa(graph, "solto", { x: 0, y: 0 })).map((node) => node.name)).toEqual(["planner", "reviewer"]);
  expect(graph.nodes.map((node) => [node.name, node.position.x])).toEqual([
    ["Entrada", 0],
    ["reviewer", 660],
    ["planner", 330],
    ["Fim", 990],
  ]);
});
