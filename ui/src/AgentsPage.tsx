import { useEffect, useState, type KeyboardEvent, type ReactNode } from "react";
import { api, type Agent } from "./api";
import { agentColor } from "./agent-color";
import { displayPath } from "./display-path";
import { InstructionsEditor } from "./InstructionsEditor";
import {
  AppShell,
  Avatar,
  Button,
  Callout,
  Chip,
  ConfirmDialog,
  EmptyState,
  Field,
  NavItem,
  PageHeader,
  Select,
  SidebarSection,
  type Navigate,
} from "./shared/design-system";

const COMMON_TOOLS = ["Read", "Grep", "Glob", "Edit", "Write", "Bash", "WebFetch", "WebSearch", "Agent"];
const MODEL_OPTIONS = [
  { value: "", label: "Padrão do Claude Code" },
  { value: "inherit", label: "Herdar da sessão" },
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "haiku", label: "Haiku" },
  { value: "fable", label: "Fable" },
];

type PageProps = { rail: ReactNode; selectedName: string | null; navigate: Navigate };

type ScreenContext = {
  rail: ReactNode;
  agents: Agent[];
  claudeDirectory: string;
  navigate: Navigate;
  reload: () => Promise<Agent[]>;
};

export function AgentsPage({ rail, selectedName, navigate }: PageProps) {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [claudeDirectory, setClaudeDirectory] = useState("~/.claude");
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = () =>
    api.listAgents().then((listed) => {
      setAgents(listed);
      return listed;
    });

  useEffect(() => {
    reload().catch((failure: Error) => setLoadError(failure.message));
    api.getConfig().then((config) => setClaudeDirectory(config.claudeDirectory)).catch(() => undefined);
  }, []);

  const context: ScreenContext = { rail, agents: agents ?? [], claudeDirectory, navigate, reload };
  const selected = agents?.find((agent) => agent.name === selectedName) ?? agents?.[0] ?? null;

  if (selected === null) {
    return (
      <AgentsScreen context={context} selectedName={null} goTo={navigate} actions={null}>
        <div className="agent-empty">
          {loadError ? (
            <Callout tone="danger">{loadError}</Callout>
          ) : (
            agents !== null && (
              <EmptyState
                title="Nenhum Agente"
                description="Cada Agente vira um subagent do Claude Code e pode ser usado como Etapa nos Workflows."
                action={<NewAgentButton context={context} goTo={navigate} variant="primary" />}
              />
            )
          )}
        </div>
      </AgentsScreen>
    );
  }
  return <AgentEditor key={selected.name} context={context} saved={selected} />;
}

function AgentsScreen({
  context,
  selectedName,
  goTo,
  actions,
  children,
}: {
  context: ScreenContext;
  selectedName: string | null;
  goTo: Navigate;
  actions: ReactNode;
  children: ReactNode;
}) {
  const list = (
    <SidebarSection title="Agentes" action={<NewAgentButton context={context} goTo={goTo} variant="secondary" />}>
      {context.agents.map((agent) => (
        <NavItem
          key={agent.name}
          href={`/agentes/${agent.name}`}
          label={agent.name}
          current={agent.name === selectedName}
          trailing={<Avatar kind="agent" name={agent.name} color={agentColor(agent.name)} size={18} />}
          onNavigate={goTo}
        />
      ))}
    </SidebarSection>
  );
  return (
    <AppShell header={<PageHeader title="Agentes" actions={actions} />} rail={context.rail} contextNav={list}>
      {children}
    </AppShell>
  );
}

function NewAgentButton({ context, goTo, variant }: { context: ScreenContext; goTo: Navigate; variant: "primary" | "secondary" }) {
  const createAgent = async () => {
    const created = await api.createBlankAgent();
    await context.reload();
    goTo(`/agentes/${created.name}`);
  };
  return (
    <Button size={variant === "primary" ? "md" : "sm"} variant={variant} icon="plus" onClick={createAgent}>
      {variant === "primary" ? "Novo Agente" : "Novo"}
    </Button>
  );
}

function AgentEditor({ context, saved }: { context: ScreenContext; saved: Agent }) {
  const [draft, setDraft] = useState(saved);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const filePath = `${context.claudeDirectory}/agents/${draft.name || "<nome>"}.md`;

  const change = (fields: Partial<Agent>) => setDraft((current) => ({ ...current, ...fields }));
  const goTo = (href: string) => (isDirty ? setPendingHref(href) : context.navigate(href));

  const save = async () => {
    setIsSaving(true);
    try {
      const updated = await api.updateAgent(saved.name, draft);
      await context.reload();
      if (updated.name !== saved.name) context.navigate(`/agentes/${updated.name}`);
      else setDraft(updated);
      setError(null);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.deleteAgent(saved.name);
      const remaining = await context.reload();
      context.navigate(remaining[0] ? `/agentes/${remaining[0].name}` : "/agentes");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setIsConfirmingDelete(false);
    }
  };

  const actions = (
    <>
      <span className="header-spacer" />
      <span className="save-status" data-dirty={isDirty}>
        {isDirty ? "Alterações não salvas" : "Salvo"}
      </span>
      <Button variant="ghost" onClick={() => setIsConfirmingDelete(true)}>
        Excluir
      </Button>
      <Button variant="primary" onClick={save} disabled={!isDirty || isSaving}>
        Salvar
      </Button>
    </>
  );

  return (
    <AgentsScreen context={context} selectedName={saved.name} goTo={goTo} actions={actions}>
      <div className="agent-editor">
        <aside className="agent-editor__meta">
          <div className="agent-editor__identity">
            <Avatar kind="agent" name={draft.name || "?"} color={agentColor(draft.name)} size={40} />
            <div className="agent-editor__identity-text">
              <strong>{draft.name || "sem-nome"}</strong>
              <span className="mono muted" title={filePath}>
                {displayPath(filePath)}
              </span>
            </div>
          </div>
          {error && <Callout tone="danger">{error}</Callout>}
          <Field label="Nome" hint="minúsculas, números e hífen; renomear atualiza os Workflows" mono>
            <input value={draft.name} onChange={(event) => change({ name: event.target.value.toLowerCase().replace(/\s+/g, "-") })} />
          </Field>
          <Field label="Descrição" hint="quando o Claude deve delegar a este Agente">
            <textarea rows={3} value={draft.description} onChange={(event) => change({ description: event.target.value })} />
          </Field>
          <div className="agent-editor__field">
            <span className="field__label">Modelo</span>
            <Select label="Modelo" options={modelOptionsFor(draft.model)} value={draft.model ?? ""} onChange={(model) => change({ model: model || null })} />
          </div>
          <ToolsField tools={draft.tools} onChange={(tools) => change({ tools })} />
          <Field label="Limite de turnos" hint="vazio = sem limite">
            <input
              className="agent-editor__turns"
              type="number"
              min={1}
              value={draft.maxTurns ?? ""}
              placeholder="∞"
              onChange={(event) => change({ maxTurns: event.target.value === "" ? null : Number(event.target.value) })}
            />
          </Field>
        </aside>
        <section className="agent-editor__instructions" aria-label="Instruções">
          <span className="field__label">Instruções</span>
          <InstructionsEditor markdown={saved.instructions} onChange={(instructions) => change({ instructions })} />
        </section>
      </div>
      <ConfirmDialog
        open={pendingHref !== null}
        title="Descartar alterações?"
        confirmLabel="Descartar"
        onCancel={() => setPendingHref(null)}
        onConfirm={() => {
          const href = pendingHref!;
          setPendingHref(null);
          context.navigate(href);
        }}
      >
        O Agente {saved.name} tem alterações que não foram salvas.
      </ConfirmDialog>
      <ConfirmDialog
        open={isConfirmingDelete}
        title={`Excluir ${saved.name}?`}
        confirmLabel="Excluir"
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={remove}
      >
        O arquivo do Agente é apagado.
      </ConfirmDialog>
    </AgentsScreen>
  );
}

function modelOptionsFor(model: string | null) {
  const isCustom = model !== null && !MODEL_OPTIONS.some((option) => option.value === model);
  return isCustom ? [...MODEL_OPTIONS, { value: model, label: model }] : MODEL_OPTIONS;
}

function ToolsField({ tools, onChange }: { tools: string[]; onChange: (tools: string[]) => void }) {
  const [customTool, setCustomTool] = useState("");
  const customTools = tools.filter((tool) => !COMMON_TOOLS.includes(tool));
  const toggle = (tool: string) => onChange(tools.includes(tool) ? tools.filter((current) => current !== tool) : [...tools, tool]);

  const addCustomTool = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const tool = customTool.trim();
    if (tool !== "" && !tools.includes(tool)) onChange([...tools, tool]);
    setCustomTool("");
  };

  return (
    <div className="agent-editor__field">
      <span className="field__label">Tools</span>
      <div className="agent-editor__chips">
        {COMMON_TOOLS.map((tool) => (
          <Chip key={tool} selected={tools.includes(tool)} onClick={() => toggle(tool)}>
            {tool}
          </Chip>
        ))}
        {customTools.map((tool) => (
          <Chip key={tool} variant="token" onRemove={() => toggle(tool)}>
            {tool}
          </Chip>
        ))}
      </div>
      <input
        className="agent-editor__custom-tool"
        value={customTool}
        placeholder="Outra tool (ex: mcp__github) + Enter"
        onChange={(event) => setCustomTool(event.target.value)}
        onKeyDown={addCustomTool}
      />
      <span className="field__hint">{tools.length === 0 ? "nenhuma marcada = todas as tools" : `${tools.length} selecionada(s)`}</span>
    </div>
  );
}
