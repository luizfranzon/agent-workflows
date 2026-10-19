import type { Server } from "bun";
import type { BrowserAuthentication } from "../../application/browser-authentication";
import { errorResponse, notFound, type ApiRoute } from "./api-responses";
import { isFromTrustedOrigin } from "./request-origin-guard";
import { serveUiFile } from "./ui-files";

const SESSION_COOKIE_NAME = "agent_workflows_session";

export type DaemonServerDependencies = {
  authentication: BrowserAuthentication;
  uiDirectory: string;
  apiRoutes: ApiRoute[];
};

export function createDaemonRequestHandler({ authentication, uiDirectory, apiRoutes }: DaemonServerDependencies) {
  return async (request: Request, server: Server<undefined>) => {
    const url = new URL(request.url);

    if (!isFromTrustedOrigin(request, server.port!)) return forbidden();
    const launchToken = url.searchParams.get("token");

    if (url.pathname === "/" && launchToken !== null) return exchangeLaunchToken(authentication, launchToken);

    const sessionSecret = new Bun.CookieMap(request.headers.get("cookie") ?? "").get(SESSION_COOKIE_NAME);
    if (!authentication.isAuthenticated(sessionSecret)) return unauthorized();

    if (url.pathname === "/api/health") return Response.json({ status: "ok" });
    if (url.pathname.startsWith("/api/")) return routeApiRequest(apiRoutes, request, url);

    return serveUiFile(uiDirectory, url.pathname);
  };
}

async function routeApiRequest(apiRoutes: ApiRoute[], request: Request, url: URL) {
  try {
    for (const route of apiRoutes) {
      const response = await route(request, url);
      if (response !== null) return response;
    }
    return notFound();
  } catch (error) {
    return errorResponse(error);
  }
}

function exchangeLaunchToken(authentication: BrowserAuthentication, launchToken: string) {
  const sessionSecret = authentication.exchangeLaunchToken(launchToken);
  if (sessionSecret === null) return unauthorized();
  return new Response(null, {
    status: 303,
    headers: {
      location: "/",
      "set-cookie": `${SESSION_COOKIE_NAME}=${sessionSecret}; HttpOnly; SameSite=Strict; Path=/`,
    },
  });
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

function forbidden() {
  return new Response("Forbidden", { status: 403 });
}
