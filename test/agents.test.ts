import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { startTestDaemon, type TestDaemon } from "./support/daemon-harness";

let daemon: TestDaemon;

afterEach(async () => {
  await daemon?.stop();
});

const planner = {
  name: "planner",
  description: "Etapa de planejamento: escreve o plano",
  model: "opus",
  tools: ["Read", "Grep"],
  maxTurns: 30,
  instructions: "Escreva o plano.",
};

function agentFile(name: string) {
  return Bun.file(join(daemon.claudeDirectory, "agents", `${name}.md`));
}

describe("CRUD de Agentes", () => {
  test("cria o Agente como subagent do Claude Code em agents/<nome>.md", async () => {
    daemon = await startTestDaemon();

    const response = await daemon.sendJson("POST", "/api/agents", planner);

    expect(response.status).toBe(201);
    expect(await agentFile("planner").text()).toBe(
      [
        "---",
        "name: planner",
        'description: "Etapa de planejamento: escreve o plano"',
        "model: opus",
        "tools: Read, Grep",
        "maxTurns: 30",
        "---",
        "Escreva o plano.",
        "",
      ].join("\n"),
    );
  });

  test("lista os Agentes lidos dos arquivos", async () => {
    daemon = await startTestDaemon();
    await daemon.sendJson("POST", "/api/agents", planner);

    const agents = await (await daemon.request("/api/agents")).json();

    expect(agents).toEqual([planner]);
  });

  test("lê tools em lista YAML e preserva campos de frontmatter que não edita", async () => {
    daemon = await startTestDaemon();
    await Bun.write(
      agentFile("legado"),
      ["---", "name: legado", "description: Antigo", "tools:", "  - Read", "  - Bash", "skills:", "  - padroes", "color: blue", "---", "Corpo", ""].join("\n"),
    );

    const response = await daemon.sendJson("PUT", "/api/agents/legado", { ...planner, name: undefined, tools: ["Read"] });
    const document = await agentFile("legado").text();

    expect(response.status).toBe(200);
    expect(document).toContain("skills:\n  - padroes\ncolor: blue\n---");
    expect(document).toContain("tools: Read\n");
    expect(document).not.toContain("  - Bash");
  });

  test("recusa criar Agente com nome já usado ou fora do padrão", async () => {
    daemon = await startTestDaemon();
    await daemon.sendJson("POST", "/api/agents", planner);

    const duplicated = await daemon.sendJson("POST", "/api/agents", planner);
    const badName = await daemon.sendJson("POST", "/api/agents", { ...planner, name: "Planner Bom" });

    expect(duplicated.status).toBe(409);
    expect(badName.status).toBe(422);
  });

  test("recusa Agente sem descrição", async () => {
    daemon = await startTestDaemon();

    const response = await daemon.sendJson("POST", "/api/agents", { ...planner, description: " " });

    expect(response.status).toBe(422);
  });

  test("apaga o arquivo do Agente", async () => {
    daemon = await startTestDaemon();
    await daemon.sendJson("POST", "/api/agents", planner);

    const response = await daemon.sendJson("DELETE", "/api/agents/planner");

    expect(response.status).toBe(204);
    expect(await agentFile("planner").exists()).toBe(false);
  });

  test("recusa apagar Agente usado por um Workflow", async () => {
    daemon = await startTestDaemon();
    await daemon.sendJson("POST", "/api/agents", planner);
    await daemon.sendJson("POST", "/api/workflows", {
      name: "simples",
      entry: "Planejar",
      etapas: [{ name: "Planejar", agent: "planner", exits: [{ kind: "handoff", to: "Fim" }] }],
    });

    const response = await daemon.sendJson("DELETE", "/api/agents/planner");

    expect(response.status).toBe(409);
    expect(await agentFile("planner").exists()).toBe(true);
  });

  test("cria Agentes em branco numerados em sequência", async () => {
    daemon = await startTestDaemon();

    const first = (await (await daemon.sendJson("POST", "/api/agent-drafts")).json()) as { name: string };
    const second = (await (await daemon.sendJson("POST", "/api/agent-drafts")).json()) as { name: string };

    expect([first.name, second.name]).toEqual(["agente-01", "agente-02"]);
    expect(await agentFile("agente-02").exists()).toBe(true);
  });

  test("renomear move o arquivo, preserva o frontmatter extra e atualiza os Workflows que usam o Agente", async () => {
    daemon = await startTestDaemon();
    await Bun.write(agentFile("agente-01"), ["---", "name: agente-01", "description: Velho", "color: blue", "---", "Corpo", ""].join("\n"));
    await daemon.sendJson("POST", "/api/workflows", {
      name: "simples",
      entry: "Etapa",
      etapas: [{ name: "Etapa", agent: "agente-01", exits: [{ kind: "handoff", to: "Fim" }] }],
    });

    const response = await daemon.sendJson("PUT", "/api/agents/agente-01", { ...planner, name: "tradutor" });
    const [workflow] = (await (await daemon.request("/api/workflows")).json()) as { etapas: { agent: string }[]; problems: string[] }[];

    expect(response.status).toBe(200);
    expect(await agentFile("agente-01").exists()).toBe(false);
    expect(await agentFile("tradutor").text()).toContain("color: blue");
    expect(workflow!.etapas[0]!.agent).toBe("tradutor");
    expect(workflow!.problems).toEqual([]);
  });

  test("recusa renomear para o nome de outro Agente sem mexer em nenhum dos dois", async () => {
    daemon = await startTestDaemon();
    await daemon.sendJson("POST", "/api/agents", planner);
    await daemon.sendJson("POST", "/api/agents", { ...planner, name: "reviewer", instructions: "Revise." });

    const response = await daemon.sendJson("PUT", "/api/agents/reviewer", { ...planner, name: "planner", instructions: "Sobrescreveu" });

    expect(response.status).toBe(409);
    expect(await agentFile("planner").text()).toContain("Escreva o plano.");
    expect(await agentFile("reviewer").text()).toContain("Revise.");
  });

  test("editar um Agente não altera outro", async () => {
    daemon = await startTestDaemon();
    await daemon.sendJson("POST", "/api/agents", planner);
    await daemon.sendJson("POST", "/api/agents", { ...planner, name: "reviewer", instructions: "Revise." });

    await daemon.sendJson("PUT", "/api/agents/reviewer", { ...planner, name: "reviewer", instructions: "Revise com calma." });

    expect(await agentFile("planner").text()).toContain("Escreva o plano.");
    expect(await agentFile("reviewer").text()).toContain("Revise com calma.");
  });

  test("atualizar ou apagar Agente inexistente responde 404", async () => {
    daemon = await startTestDaemon();

    expect((await daemon.sendJson("PUT", "/api/agents/nada", planner)).status).toBe(404);
    expect((await daemon.sendJson("DELETE", "/api/agents/nada")).status).toBe(404);
  });
});
