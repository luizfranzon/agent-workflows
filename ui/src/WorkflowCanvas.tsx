import "@xyflow/react/dist/style.css";
import { useState, type CSSProperties } from "react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useViewport,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
} from "@xyflow/react";
import type { Agent } from "./api";
import { agentColor } from "./agent-color";
import {
  arranged,
  canToggle,
  etapaOrder,
  withLink,
  withoutLinks,
  withoutNodes,
  withToggledLink,
  type Graph,
  type GraphLink,
  type GraphNode,
} from "./workflow-graph";

type CardData = { node: GraphNode; agent: Agent | null; stepNumber: number | null; branches: boolean };
type CardNode = Node<CardData, "card">;
type LinkData = { link: GraphLink; toggleable: boolean; onToggle: () => void; onRemove: () => void; onMaxReturns: (value: number) => void };
type LinkEdge = Edge<LinkData, "link">;
type NodeViewState = Pick<CardNode, "selected" | "measured">;

const NODE_TYPES = { card: WorkflowCard };
const EDGE_TYPES = { link: WorkflowLinkEdge };
const ZOOM_DURATION_MS = 200;

export function WorkflowCanvas({ graph, agents, onChange }: { graph: Graph; agents: Agent[]; onChange: (graph: Graph) => void }) {
  const [nodeViews, setNodeViews] = useState<Record<string, NodeViewState>>({});
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const order = etapaOrder(graph);
  const agentByName = new Map(agents.map((agent) => [agent.name, agent]));

  const nodes: CardNode[] = graph.nodes.map((node) => {
    const stepIndex = order.findIndex((candidate) => candidate.id === node.id);
    return {
      id: node.id,
      type: "card",
      position: node.position,
      deletable: node.kind === "etapa",
      data: {
        node,
        agent: agentByName.get(node.agent) ?? null,
        stepNumber: stepIndex === -1 ? null : stepIndex + 1,
        branches: graph.links.filter((link) => link.from === node.id && link.kind === "handoff").length > 1,
      },
      ...nodeViews[node.id],
    };
  });

  const edges: LinkEdge[] = graph.links.map((link) => ({
    id: link.id,
    type: "link",
    source: link.from,
    target: link.to,
    selected: selectedLinkIds.includes(link.id),
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
    className: `workflow-link workflow-link--${link.kind}`,
    data: {
      link,
      toggleable: canToggle(graph, link),
      onToggle: () => onChange(withToggledLink(graph, link.id)),
      onRemove: () => onChange(withoutLinks(graph, new Set([link.id]))),
      onMaxReturns: (value) =>
        onChange({ ...graph, links: graph.links.map((candidate) => (candidate.id === link.id ? { ...candidate, maxReturns: value } : candidate)) }),
    },
  }));

  const applyNodes = (changes: NodeChange<CardNode>[]) => {
    const changedNodes = applyNodeChanges(changes, nodes);
    setNodeViews(Object.fromEntries(changedNodes.map((node) => [node.id, { selected: node.selected, measured: node.measured }])));
    const removedIds = new Set(changes.flatMap((change) => (change.type === "remove" ? [change.id] : [])));
    if (removedIds.size > 0) return onChange(withoutNodes(graph, removedIds));
    if (!changes.some((change) => change.type === "position")) return;
    const positionById = new Map(changedNodes.map((node) => [node.id, node.position]));
    onChange({ ...graph, nodes: graph.nodes.map((node) => ({ ...node, position: positionById.get(node.id) ?? node.position })) });
  };

  const applyEdges = (changes: EdgeChange<LinkEdge>[]) => {
    const removedIds = new Set(changes.flatMap((change) => (change.type === "remove" ? [change.id] : [])));
    if (removedIds.size > 0) onChange(withoutLinks(graph, removedIds));
    const selectionChanges = changes.flatMap((change) => (change.type === "select" ? [change] : []));
    if (selectionChanges.length === 0) return;
    setSelectedLinkIds((current) => {
      const next = new Set(current);
      for (const change of selectionChanges) {
        if (change.selected) next.add(change.id);
        else next.delete(change.id);
      }
      return [...next];
    });
  };

  return (
    <div className="workflow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={applyNodes}
        onEdgesChange={applyEdges}
        onConnect={({ source, target }) => onChange(withLink(graph, source, target))}
        colorMode="dark"
        minZoom={0.2}
        maxZoom={2}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={["Delete", "Backspace"]}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} />
        <ZoomBar onArrange={() => onChange(arranged(graph))} />
      </ReactFlow>
    </div>
  );
}

function ZoomBar({ onArrange }: { onArrange: () => void }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-left" className="zoom-bar">
      <button type="button" aria-label="Diminuir zoom" onClick={() => zoomOut({ duration: ZOOM_DURATION_MS })}>
        –
      </button>
      <span className="zoom-bar__value">{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="Aumentar zoom" onClick={() => zoomIn({ duration: ZOOM_DURATION_MS })}>
        +
      </button>
      <span className="zoom-bar__divider" />
      <button type="button" onClick={() => fitView({ padding: 0.25, duration: ZOOM_DURATION_MS })}>
        Ajustar à tela
      </button>
      <button
        type="button"
        onClick={() => {
          onArrange();
          requestAnimationFrame(() => fitView({ padding: 0.25, duration: ZOOM_DURATION_MS }));
        }}
      >
        Organizar
      </button>
    </Panel>
  );
}

function WorkflowCard({ data: { node, agent, stepNumber, branches }, selected }: NodeProps<CardNode>) {
  const isEtapa = node.kind === "etapa";
  const isMissingAgent = isEtapa && agent === null;
  const color = isEtapa ? agentColor(node.agent) : "var(--text-subtle)";
  const classes = ["workflow-card", `workflow-card--${node.kind}`, selected && "workflow-card--selected", isMissingAgent && "workflow-card--invalid"]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={{ "--card-color": color } as CSSProperties}>
      {node.kind !== "entrada" && <Handle type="target" position={Position.Left} className="workflow-card__handle" />}
      <div className="workflow-card__header">
        <span className="workflow-card__badge">{node.kind === "entrada" ? "▶" : node.kind === "fim" ? "■" : node.name.charAt(0).toUpperCase()}</span>
        <strong className="workflow-card__title">{node.name}</strong>
        {stepNumber !== null && (
          <span className="workflow-card__step">
            etapa {stepNumber}
            {branches && " · ramifica"}
          </span>
        )}
      </div>
      <div className="workflow-card__body">
        {node.kind === "entrada" && "Tarefa chega aqui"}
        {node.kind === "fim" && "Tarefa concluída"}
        {isEtapa && (isMissingAgent ? `Agente "${node.agent}" não existe` : agentSummary(agent!, node.name))}
      </div>
      {node.kind !== "fim" && <Handle type="source" position={Position.Right} className="workflow-card__handle" />}
    </div>
  );
}

function agentSummary(agent: Agent, etapaName: string) {
  return [etapaName !== agent.name && agent.name, agent.model ?? "modelo padrão", agent.maxTurns !== null && `${agent.maxTurns} turnos`]
    .filter(Boolean)
    .join(" · ");
}

function WorkflowLinkEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, data, selected }: EdgeProps<LinkEdge>) {
  const { link, toggleable, onToggle, onRemove, onMaxReturns } = data!;
  const isReturn = link.kind === "devolucao";
  const [path, labelX, labelY] = isReturn
    ? returnPath(sourceX, sourceY, targetX, targetY)
    : getBezierPath({ sourceX, sourceY, sourcePosition: Position.Right, targetX, targetY, targetPosition: Position.Left });

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} className={selected ? "workflow-link__path--selected" : undefined} />
      <EdgeLabelRenderer>
        <div
          className={`workflow-link__label workflow-link__label--${link.kind} nodrag nopan`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
        >
          <button
            type="button"
            disabled={!toggleable}
            title={toggleable ? "Alternar entre handoff e devolução" : undefined}
            onClick={onToggle}
          >
            {isReturn ? "↩ devolve" : "handoff"}
          </button>
          {isReturn && (
            <label title="Máximo de devoluções">
              máx
              <input
                type="number"
                min={1}
                value={link.maxReturns ?? 1}
                onChange={(event) => onMaxReturns(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
          )}
          <button type="button" aria-label="Remover ligação" onClick={onRemove}>
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function returnPath(sourceX: number, sourceY: number, targetX: number, targetY: number): [string, number, number] {
  const sag = 70 + Math.abs(sourceX - targetX) * 0.12;
  const bottom = Math.max(sourceY, targetY) + sag;
  const path = `M ${sourceX} ${sourceY} C ${sourceX + 60} ${bottom}, ${targetX - 60} ${bottom}, ${targetX} ${targetY}`;
  return [path, (sourceX + targetX) / 2, (sourceY + 6 * bottom + targetY) / 8];
}
