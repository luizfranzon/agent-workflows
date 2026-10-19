import { END, type CanvasPosition, type ExitKind, type Workflow } from "./api";

export type GraphNodeKind = "entrada" | "etapa" | "fim";

export type GraphNode = { id: string; kind: GraphNodeKind; name: string; agent: string; position: CanvasPosition };

export type GraphLink = { id: string; from: string; to: string; kind: ExitKind; maxReturns: number | null };

export type Graph = { name: string; nodes: GraphNode[]; links: GraphLink[] };

export const ENTRADA_ID = "entrada";
export const FIM_ID = "fim";
export const DEFAULT_MAX_RETURNS = 3;

const COLUMN_WIDTH = 330;
const ROW_HEIGHT = 150;

export function blankGraph(): Graph {
  return {
    name: "",
    nodes: [
      { id: ENTRADA_ID, kind: "entrada", name: "Entrada", agent: "", position: { x: 0, y: 0 } },
      { id: FIM_ID, kind: "fim", name: END, agent: "", position: { x: COLUMN_WIDTH, y: 0 } },
    ],
    links: [],
  };
}

export function graphOf(workflow: Workflow): Graph {
  const idOfName = new Map<string, string>([[END, FIM_ID]]);
  const etapaNodes: GraphNode[] = workflow.etapas.map((etapa, index) => {
    const id = `etapa-${index}`;
    idOfName.set(etapa.name, id);
    return { id, kind: "etapa", name: etapa.name, agent: etapa.agent, position: etapa.position ?? { x: 0, y: 0 } };
  });
  const entryId = idOfName.get(workflow.entry);
  const links: GraphLink[] = [
    ...(entryId === undefined ? [] : [{ id: "link-entrada", from: ENTRADA_ID, to: entryId, kind: "handoff" as const, maxReturns: null }]),
    ...workflow.etapas.flatMap((etapa, etapaIndex) =>
      etapa.exits.flatMap((exit, exitIndex) => {
        const targetId = idOfName.get(exit.to);
        if (targetId === undefined) return [];
        return [{ id: `link-${etapaIndex}-${exitIndex}`, from: `etapa-${etapaIndex}`, to: targetId, kind: exit.kind, maxReturns: exit.maxReturns }];
      }),
    ),
  ];
  const graph: Graph = {
    name: workflow.name,
    nodes: [
      { id: ENTRADA_ID, kind: "entrada", name: "Entrada", agent: "", position: workflow.entryPosition ?? { x: 0, y: 0 } },
      ...etapaNodes,
      { id: FIM_ID, kind: "fim", name: END, agent: "", position: workflow.endPosition ?? { x: 0, y: 0 } },
    ],
    links,
  };
  const hasSavedLayout = workflow.entryPosition !== null && workflow.etapas.every((etapa) => etapa.position !== null);
  return hasSavedLayout ? graph : arranged(graph);
}

export function workflowOf(graph: Graph): Workflow {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const entryLink = graph.links.find((link) => link.from === ENTRADA_ID);
  return {
    name: graph.name,
    entry: entryLink ? (nodeById.get(entryLink.to)?.name ?? "") : "",
    entryPosition: nodeById.get(ENTRADA_ID)!.position,
    endPosition: nodeById.get(FIM_ID)!.position,
    etapas: graph.nodes
      .filter((node) => node.kind === "etapa")
      .map((node) => ({
        name: node.name,
        agent: node.agent,
        position: node.position,
        exits: graph.links
          .filter((link) => link.from === node.id)
          .map((link) => ({ kind: link.kind, to: nodeById.get(link.to)?.name ?? "", maxReturns: link.maxReturns })),
      })),
  };
}

export function withEtapa(graph: Graph, agent: string, position: CanvasPosition): Graph {
  const takenNames = new Set(graph.nodes.map((node) => node.name));
  let name = agent;
  for (let suffix = 2; takenNames.has(name); suffix++) name = `${agent}-${suffix}`;
  const node: GraphNode = { id: crypto.randomUUID(), kind: "etapa", name, agent, position };
  return { ...graph, nodes: [...graph.nodes, node] };
}

export function withLink(graph: Graph, from: string, to: string): Graph {
  const alreadyLinked = graph.links.some((link) => link.from === from && link.to === to);
  if (from === to || alreadyLinked || to === ENTRADA_ID || from === FIM_ID) return graph;
  const links = from === ENTRADA_ID ? graph.links.filter((link) => link.from !== ENTRADA_ID) : graph.links;
  const goesBack = handoffDescendants(graph, to).has(from);
  const kind: ExitKind = goesBack ? "devolucao" : "handoff";
  const link: GraphLink = { id: crypto.randomUUID(), from, to, kind, maxReturns: goesBack ? DEFAULT_MAX_RETURNS : null };
  return { ...graph, links: [...links, link] };
}

export function withToggledLink(graph: Graph, linkId: string): Graph {
  return {
    ...graph,
    links: graph.links.map((link) => {
      if (link.id !== linkId || !canToggle(graph, link)) return link;
      return link.kind === "handoff"
        ? { ...link, kind: "devolucao", maxReturns: DEFAULT_MAX_RETURNS }
        : { ...link, kind: "handoff", maxReturns: null };
    }),
  };
}

export function canToggle(graph: Graph, link: GraphLink) {
  return link.from !== ENTRADA_ID && link.to !== FIM_ID && graph.nodes.some((node) => node.id === link.to);
}

export function withoutNodes(graph: Graph, removedIds: Set<string>): Graph {
  const removable = new Set([...removedIds].filter((id) => id !== ENTRADA_ID && id !== FIM_ID));
  return {
    ...graph,
    nodes: graph.nodes.filter((node) => !removable.has(node.id)),
    links: graph.links.filter((link) => !removable.has(link.from) && !removable.has(link.to)),
  };
}

export function withoutLinks(graph: Graph, removedIds: Set<string>): Graph {
  return { ...graph, links: graph.links.filter((link) => !removedIds.has(link.id)) };
}

export function etapaOrder(graph: Graph) {
  const depths = handoffDepths(graph);
  return graph.nodes
    .filter((node) => node.kind === "etapa" && depths.has(node.id))
    .sort((first, second) => (depths.get(first.id) ?? Infinity) - (depths.get(second.id) ?? Infinity) || first.position.y - second.position.y);
}

export function arranged(graph: Graph): Graph {
  const depths = handoffDepths(graph);
  const maxEtapaDepth = Math.max(0, ...graph.nodes.filter((node) => node.kind === "etapa").map((node) => depths.get(node.id) ?? 0));
  const columnOf = (node: GraphNode) => {
    if (node.kind === "entrada") return 0;
    if (node.kind === "fim") return maxEtapaDepth + 1;
    return depths.get(node.id) ?? maxEtapaDepth + 1;
  };
  const columns = new Map<number, GraphNode[]>();
  for (const node of graph.nodes) columns.set(columnOf(node), [...(columns.get(columnOf(node)) ?? []), node]);
  const positionOf = new Map<string, CanvasPosition>();
  for (const [column, nodes] of columns) {
    nodes.forEach((node, row) => positionOf.set(node.id, { x: column * COLUMN_WIDTH, y: (row - (nodes.length - 1) / 2) * ROW_HEIGHT }));
  }
  return { ...graph, nodes: graph.nodes.map((node) => ({ ...node, position: positionOf.get(node.id)! })) };
}

function handoffTargets(graph: Graph, nodeId: string) {
  return graph.links.filter((link) => link.from === nodeId && link.kind === "handoff").map((link) => link.to);
}

function handoffDescendants(graph: Graph, nodeId: string) {
  const reached = new Set<string>();
  const pending = handoffTargets(graph, nodeId);
  while (pending.length > 0) {
    const next = pending.pop()!;
    if (reached.has(next)) continue;
    reached.add(next);
    pending.push(...handoffTargets(graph, next));
  }
  return reached;
}

function handoffDepths(graph: Graph) {
  const depths = new Map<string, number>([[ENTRADA_ID, 0]]);
  const pending = [ENTRADA_ID];
  const maxVisits = graph.nodes.length * graph.nodes.length;
  for (let visits = 0; pending.length > 0 && visits < maxVisits; visits++) {
    const current = pending.shift()!;
    for (const target of handoffTargets(graph, current)) {
      const candidateDepth = depths.get(current)! + 1;
      if ((depths.get(target) ?? -1) >= candidateDepth) continue;
      depths.set(target, candidateDepth);
      pending.push(target);
    }
  }
  return depths;
}
