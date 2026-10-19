import { methodNotAllowed, type ApiRoute } from "./api-responses";

export function createConfigRoutes(claudeDirectory: string): ApiRoute {
  return async (request, url) => {
    if (url.pathname !== "/api/config") return null;
    if (request.method !== "GET") return methodNotAllowed();
    return Response.json({ claudeDirectory });
  };
}
