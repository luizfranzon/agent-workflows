import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { createTemporaryDirectory, startTestDaemon, type TestDaemon } from "./support/daemon-harness";

let daemon: TestDaemon;

afterEach(async () => {
  await daemon?.stop();
});

describe("link inicial", () => {
  test("troca o token do link por cookie HttpOnly e SameSite=Strict e redireciona para a UI", async () => {
    daemon = await startTestDaemon();

    const response = await fetch(daemon.launchLink, { redirect: "manual" });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Strict");
    expect(setCookie).not.toContain(daemon.launchToken);
  });

  test("recusa link com token inválido sem entregar cookie", async () => {
    daemon = await startTestDaemon();

    const response = await fetch(`${daemon.origin}/?token=invalido`, { redirect: "manual" });

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("escuta só em 127.0.0.1", async () => {
    daemon = await startTestDaemon();

    expect(new URL(daemon.launchLink).hostname).toBe("127.0.0.1");
  });
});

describe("Origin e Host", () => {
  test("recusa request com Host inesperado mesmo com cookie válido", async () => {
    daemon = await startTestDaemon();

    const response = await daemon.request("/api/health", { headers: { host: `evil.example:${daemon.port}` } });

    expect(response.status).toBe(403);
  });

  test("recusa link inicial com Host inesperado", async () => {
    daemon = await startTestDaemon();

    const response = await fetch(daemon.launchLink, { headers: { host: "evil.example" }, redirect: "manual" });

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("recusa request com Origin inesperado mesmo com cookie válido", async () => {
    daemon = await startTestDaemon();

    const response = await daemon.request("/api/health", { headers: { origin: "https://evil.example" } });

    expect(response.status).toBe(403);
  });

  test("recusa escrita sem Origin mesmo com cookie válido", async () => {
    daemon = await startTestDaemon();

    const response = await daemon.request("/api/agents", { method: "POST", body: "{}" });

    expect(response.status).toBe(403);
  });

  test("aceita Origin do próprio daemon por 127.0.0.1 e localhost", async () => {
    daemon = await startTestDaemon();

    const viaLoopback = await daemon.request("/api/health", { headers: { origin: daemon.origin } });
    const viaLocalhost = await daemon.request("/api/health", {
      headers: { origin: `http://localhost:${daemon.port}`, host: `localhost:${daemon.port}` },
    });

    expect(viaLoopback.status).toBe(200);
    expect(viaLocalhost.status).toBe(200);
  });

  test("nunca responde com cabeçalhos CORS", async () => {
    daemon = await startTestDaemon();

    const preflight = await daemon.request("/api/health", {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
    });

    expect(preflight.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("cookie de sessão", () => {
  test("API recusa request sem cookie válido", async () => {
    daemon = await startTestDaemon();

    const semCookie = await fetch(`${daemon.origin}/api/health`);
    const cookieInvalido = await daemon.request("/api/health", { headers: { cookie: "agent_workflows_session=falso" } });

    expect(semCookie.status).toBe(401);
    expect(cookieInvalido.status).toBe(401);
  });

  test("UI só é servida com cookie válido e caminhos fora do diretório da UI não vazam", async () => {
    daemon = await startTestDaemon();

    const semCookie = await fetch(`${daemon.origin}/`);
    const comCookie = await daemon.request("/");
    const traversal = await daemon.request("/assets/%2e%2e/%2e%2e/%2e%2e/etc/passwd");

    expect(semCookie.status).toBe(401);
    expect(await comCookie.text()).toContain("agent-workflows-ui");
    expect(await traversal.text()).not.toContain("root:");
  });
});

describe("instância única", () => {
  test("segundo daemon no mesmo diretório de dados não sobe", async () => {
    daemon = await startTestDaemon();

    await expect(startTestDaemon({ dataDirectory: daemon.dataDirectory })).rejects.toThrow(/já está rodando/);
  });
});

describe("skill workflow", () => {
  test("instala a skill no diretório do Claude quando ela não existe", async () => {
    daemon = await startTestDaemon();

    const skill = await Bun.file(join(daemon.claudeDirectory, "skills", "workflow", "SKILL.md")).text();

    expect(daemon.skillInstallation).toBe("instalada");
    expect(skill).toContain("name: workflow");
    expect(skill).not.toContain("disable-model-invocation");
  });

  test("não sobrescreve skill workflow que o usuário escreveu", async () => {
    const claudeDirectory = await createTemporaryDirectory("claude");
    await Bun.write(join(claudeDirectory, "skills", "workflow", "SKILL.md"), "minha versão");

    daemon = await startTestDaemon({ claudeDirectory });

    expect(daemon.skillInstallation).toBe("mantida");
    expect(await Bun.file(join(claudeDirectory, "skills", "workflow", "SKILL.md")).text()).toBe("minha versão");
  });

  test("atualiza a skill que o próprio app instalou, inclusive a primeira versão sem marcador", async () => {
    const claudeDirectory = await createTemporaryDirectory("claude");
    const firstRelease = "---\nname: workflow\ndescription: Executa um Workflow de Etapas com subagents sobre uma tarefa.\ndisable-model-invocation: true\n---\nantiga";
    await Bun.write(join(claudeDirectory, "skills", "workflow", "SKILL.md"), firstRelease);

    daemon = await startTestDaemon({ claudeDirectory });
    const skill = await Bun.file(join(claudeDirectory, "skills", "workflow", "SKILL.md")).text();

    expect(daemon.skillInstallation).toBe("atualizada");
    expect(skill).toContain("gerenciado por agent-workflows");
  });
});
