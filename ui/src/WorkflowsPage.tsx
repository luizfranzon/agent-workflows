import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { api, type Agent, type ListedWorkflow, type WorkflowValidation } from "./api";
import { agentColor } from "./agent-color";
import { displayPath } from "./display-path";
import { AppShell, Avatar, Badge, Button, Callout, ConfirmDialog, Field, PageHeader, type Navigate } from "./shared/design-system";
import { WorkflowCanvas } from "./WorkflowCanvas";
import { blankGraph, etapaOrder, graphOf, withEtapa, workflowOf, type Graph } from "./workflow-graph";

const VALIDATION_DELAY_MS = 250;
const NEW_WORKFLOW_ROUTE = "novo";
const NEW_CARD_GAP = 140;
const CARD_CENTER_OFFSET = { x: 110, y: 32 };
const FIT_DURATION_MS = 300;
const AGENT_DRAG_TYPE = "application/x-agent-workflows-agent";

type PageProps = { rail: ReactNode; selectedName: string | null; navigate: Navigate };

export function WorkflowsPage(props: PageProps) {
  return (
    <ReactFlowProvider>
      <WorkflowsEditor {...props} />
    </ReactFlowProvider>
  );
}

function WorkflowsEditor({ rail, selectedName: routeName, navigate }: PageProps) {
  const [workflows, setWorkflows] = useState<ListedWorkflow[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentQuery, setAgentQuery] = useState("");
  const [claudeDirectory, setClaudeDirectory] = useState("~/.claude");
  const [graph, setGraph] = useState<Graph | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [validation, setValidation] = useState<WorkflowValidation | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getZoom } = useReactFlow();

  const selectedName = routeName ?? workflows?.[0]?.name ?? NEW_WORKFLOW_ROUTE;
  const isNew = selectedName === NEW_WORKFLOW_ROUTE;
  const snapshot = graph === null ? null : JSON.stringify(workflowOf(graph));
  const isDirty = graph !== null && snapshot !== savedSnapshot;
  const problems = validation?.problems ?? [];

  const reload = () =>
    Promise.all([api.listWorkflows(), api.listAgents()]).then(([listedWorkflows, listedAgents]) => {
      setWorkflows(listedWorkflows);
      setAgents(listedAgents);
      return listedWorkflows;
    });

  useEffect(() => {
    reload().catch((failure: Error) => setError(failure.message));
    api.getConfig().then((config) => setClaudeDirectory(config.claudeDirectory)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (workflows === null) return;
    const selected = workflows.find((workflow) => workflow.name === selectedName);
    const nextGraph = selected ? graphOf(selected) : blankGraph();
    setGraph(nextGraph);
    setSavedSnapshot(selected ? JSON.stringify(workflowOf(nextGraph)) : null);
    setError(null);
    requestAnimationFrame(() => fitView({ padding: 0.25 }));
  }, [workflows === null, selectedName]);

  useEffect(() => {
    if (graph === null) return;
    const timer = setTimeout(() => {
      api.validateWorkflow(workflowOf(graph)).then(setValidation).catch((failure: Error) => setValidation({ problems: [failure.message], document: "" }));
    }, VALIDATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [snapshot]);

  const goTo = (href: string) => (isDirty ? setPendingHref(href) : navigate(href));

  const addAgent = (agent: Agent) => {
    if (graph === null) return;
    const bounds = canvasRef.current?.getBoundingClientRect();
    const center = bounds ? screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }) : { x: 0, y: 0 };
    const lowestCardY = Math.max(...graph.nodes.map((node) => node.position.y));
    setGraph(withEtapa(graph, agent.name, { x: center.x - CARD_CENTER_OFFSET.x, y: lowestCardY + NEW_CARD_GAP }));
    const zoomBeforeAdding = getZoom();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => fitView({ padding: 0.25, duration: FIT_DURATION_MS, maxZoom: zoomBeforeAdding })),
    );
  };

  const dropAgent = (event: DragEvent<HTMLDivElement>) => {
    const agentName = event.dataTransfer.getData(AGENT_DRAG_TYPE);
    if (graph === null || agentName === "") return;
    event.preventDefault();
    const dropPoint = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setGraph(withEtapa(graph, agentName, { x: dropPoint.x - CARD_CENTER_OFFSET.x, y: dropPoint.y - CARD_CENTER_OFFSET.y }));
  };

  const allowAgentDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(AGENT_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const save = async () => {
    if (graph === null) return;
    const workflow = workflowOf(graph);
    try {
      const saved = isNew ? await api.createWorkflow(workflow) : await api.updateWorkflow(workflow);
      setSavedSnapshot(JSON.stringify(workflowOf(graphOf(saved))));
      await reload();
      if (isNew) navigate(`/workflows/${saved.name}`);
      setError(null);
    } catch (failure) {
      setError((failure as Error).message);
    }
  };

  const remove = async () => {
    if (graph === null) return;
    try {
      await api.deleteWorkflow(graph.name);
      setIsConfirmingDelete(false);
      setSavedSnapshot(null);
      const remaining = await reload();
      navigate(remaining[0] ? `/workflows/${remaining[0].name}` : `/workflows/${NEW_WORKFLOW_ROUTE}`);
    } catch (failure) {
      setIsConfirmingDelete(false);
      setError((failure as Error).message);
    }
  };

  const tabs = (
    <div className="workflow-tabs" role="tablist" aria-label="Workflows">
      {(workflows ?? []).map((workflow) => (
        <button
          key={workflow.name}
          type="button"
          role="tab"
          aria-selected={workflow.name === selectedName}
          className="workflow-tabs__tab"
          onClick={() => goTo(`/workflows/${workflow.name}`)}
        >
          {workflow.name}
          {workflow.problems.length > 0 && <span className="workflow-tabs__warning" title="Workflow com problemas" />}
        </button>
      ))}
      {isNew && (
        <button type="button" role="tab" aria-selected className="workflow-tabs__tab">
          {graph?.name || "novo"}
        </button>
      )}
      <button type="button" className="workflow-tabs__add" aria-label="Novo Workflow" onClick={() => goTo(`/workflows/${NEW_WORKFLOW_ROUTE}`)}>
        +
      </button>
    </div>
  );

  const validity =
    graph === null || validation === null ? null : problems.length === 0 ? (
      <Badge tone="success">✓ Fluxo válido</Badge>
    ) : (
      <Badge tone="warning">{problems.length === 1 ? "1 problema" : `${problems.length} problemas`}</Badge>
    );

  const header = (
    <PageHeader
      title="Workflows"
      actions={
        <>
          {tabs}
          <span className="validity-slot">{validity}</span>
          <span className="header-spacer" />
          {graph !== null && (
            <>
              <span className="save-status" data-dirty={isDirty}>
                {isNew ? "Novo Workflow" : isDirty ? "Alterações não salvas" : "Salvo"}
              </span>
              <Button
                variant="primary"
                onClick={save}
                disabled={!isDirty || problems.length > 0}
                title={problems.length > 0 ? "Corrija o Workflow antes de salvar" : undefined}
              >
                {isNew ? "Criar Workflow" : "Salvar"}
              </Button>
            </>
          )}
        </>
      }
    />
  );

  const normalizedQuery = agentQuery.trim().toLocaleLowerCase();
  const visibleAgents = agents.filter((agent) =>
    [agent.name, agent.description, agent.model ?? ""].some((text) => text.toLocaleLowerCase().includes(normalizedQuery)),
  );

  const palette = (
    <div className="agent-palette">
      <input
        type="search"
        className="agent-palette__search"
        value={agentQuery}
        placeholder="Buscar agente…"
        aria-label="Buscar agente"
        onChange={(event) => setAgentQuery(event.target.value)}
      />
      <div className="agent-palette__heading">
        <h2 className="overline">Agentes</h2>
        <span className="muted">clique ou arraste</span>
      </div>
      <ul>
        {visibleAgents.map((agent) => (
          <li key={agent.name}>
            <button
              type="button"
              className="agent-palette__item"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(AGENT_DRAG_TYPE, agent.name);
                event.dataTransfer.effectAllowed = "copy";
              }}
              title={agent.description}
              onClick={(event) => {
                event.currentTarget.blur();
                addAgent(agent);
              }}
            >
              <Avatar kind="agent" name={agent.name} color={agentColor(agent.name)} size={32} />
              <span className="agent-palette__text">
                <strong>{agent.name}</strong>
                <small>{agent.model ?? "modelo padrão"}</small>
              </span>
              <span className="agent-palette__add" aria-hidden="true">
                +
              </span>
            </button>
          </li>
        ))}
      </ul>
      {agents.length === 0 && <p className="muted">Nenhum Agente ainda.</p>}
      {agents.length > 0 && visibleAgents.length === 0 && <p className="muted">Nenhum agente com "{agentQuery}".</p>}
      <a
        className="link"
        href="/agentes"
        onClick={(event) => {
          event.preventDefault();
          goTo("/agentes");
        }}
      >
        Criar ou editar agentes
      </a>
    </div>
  );

  const order = graph === null ? [] : etapaOrder(graph);
  const filePath = `${claudeDirectory}/workflows/${graph?.name || "<nome>"}.md`;
  const detail = graph !== null && (
    <div className="workflow-detail">
      {isNew && (
        <Field label="Nome do Workflow" hint="minúsculas, números e hífen">
          <input value={graph.name} placeholder="feature" onChange={(event) => setGraph({ ...graph, name: event.target.value })} />
        </Field>
      )}
      <section>
        <h2>Verificação</h2>
        {problems.length === 0 ? (
          <Callout tone="success">Fluxo válido: a Entrada chega no Fim</Callout>
        ) : (
          <Callout tone="warning">
            <ul>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Callout>
        )}
        {error && <Callout tone="danger">{error}</Callout>}
      </section>
      <section>
        <h2>Ordem do fluxo</h2>
        <ol className="flow-order">
          {["Entrada", ...order.map((node) => node.name), "Fim"].map((name, index) => (
            <li key={`${name}-${index}`}>{name}</li>
          ))}
        </ol>
      </section>
      {!isNew && (
        <section>
          <h2>Executar</h2>
          <code className="workflow-detail__command">/workflow {graph.name} "&lt;tarefa&gt;"</code>
        </section>
      )}
      <section>
        <h2>Arquivo</h2>
        <span className="workflow-detail__path mono" title={filePath}>
          {displayPath(filePath)}
        </span>
        <pre className="workflow-detail__document">{validation?.document ?? ""}</pre>
      </section>
      {!isNew && (
        <Button variant="ghost" size="sm" onClick={() => setIsConfirmingDelete(true)}>
          Excluir Workflow
        </Button>
      )}
    </div>
  );

  return (
    <AppShell header={header} rail={rail} contextNav={palette} detailPanel={detail}>
      <div className="workflow-main" ref={canvasRef} onDragOver={allowAgentDrop} onDrop={dropAgent}>
        {graph !== null && <WorkflowCanvas graph={graph} agents={agents} onChange={setGraph} />}
      </div>
      <ConfirmDialog
        open={pendingHref !== null}
        title="Descartar alterações?"
        confirmLabel="Descartar"
        onCancel={() => setPendingHref(null)}
        onConfirm={() => {
          const href = pendingHref!;
          setPendingHref(null);
          setSavedSnapshot(snapshot);
          navigate(href);
        }}
      >
        O Workflow tem alterações que não foram salvas.
      </ConfirmDialog>
      <ConfirmDialog
        open={isConfirmingDelete}
        title={`Excluir ${graph?.name ?? "Workflow"}?`}
        confirmLabel="Excluir"
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={remove}
      >
        O arquivo do Workflow é apagado.
      </ConfirmDialog>
    </AppShell>
  );
}
