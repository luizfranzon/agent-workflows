import { resolve, sep } from "node:path";

export async function serveUiFile(uiDirectory: string, pathname: string) {
  const uiRoot = resolve(uiDirectory);
  const requestedPath = resolve(uiRoot, `.${safelyDecode(pathname)}`);
  const isInsideUiRoot = requestedPath.startsWith(uiRoot + sep);

  if (isInsideUiRoot) {
    const requestedFile = Bun.file(requestedPath);
    if (await requestedFile.exists()) return new Response(requestedFile);
  }

  const indexFile = Bun.file(resolve(uiRoot, "index.html"));
  if (await indexFile.exists()) return new Response(indexFile);
  return new Response("UI não compilada. Rode `bun run build:ui`.", { status: 503 });
}

function safelyDecode(pathname: string) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
