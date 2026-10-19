import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon, type RunningDaemon } from "../../src/composition-root";

export const PREFERRED_TEST_PORT = 47_400;

export async function createTemporaryDirectory(prefix: string) {
  return mkdtemp(join(tmpdir(), `agent-workflows-${prefix}-`));
}

async function createUiDirectory() {
  const uiDirectory = await createTemporaryDirectory("ui");
  await writeFile(join(uiDirectory, "index.html"), "<!doctype html><div id=root>agent-workflows-ui</div>");
  await mkdir(join(uiDirectory, "assets"));
  await writeFile(join(uiDirectory, "assets", "app.js"), "console.log('agent-workflows')");
  return uiDirectory;
}

export type TestDaemon = RunningDaemon & {
  dataDirectory: string;
  claudeDirectory: string;
  origin: string;
  launchToken: string;
  sessionCookie: () => Promise<string>;
  request: (path: string, init?: RequestInit) => Promise<Response>;
  sendJson: (method: string, path: string, body?: unknown) => Promise<Response>;
};

export async function startTestDaemon(options: { dataDirectory?: string; claudeDirectory?: string } = {}): Promise<TestDaemon> {
  const dataDirectory = options.dataDirectory ?? (await createTemporaryDirectory("home"));
  const claudeDirectory = options.claudeDirectory ?? (await createTemporaryDirectory("claude"));
  const daemon = await startDaemon({
    dataDirectory,
    claudeDirectory,
    uiDirectory: await createUiDirectory(),
    preferredPort: PREFERRED_TEST_PORT,
  });
  const launchLink = new URL(daemon.launchLink);
  const origin = launchLink.origin;

  const sessionCookie = async () => {
    const response = await fetch(daemon.launchLink, { redirect: "manual" });
    return (response.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  };

  const request = async (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has("cookie")) headers.set("cookie", await sessionCookie());
    return fetch(`${origin}${path}`, { ...init, headers, redirect: "manual" });
  };

  const sendJson = (method: string, path: string, body?: unknown) =>
    request(path, {
      method,
      headers: { origin, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  return {
    ...daemon,
    dataDirectory,
    claudeDirectory,
    origin,
    launchToken: launchLink.searchParams.get("token") ?? "",
    sessionCookie,
    request,
    sendJson,
  };
}
