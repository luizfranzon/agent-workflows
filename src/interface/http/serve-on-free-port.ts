import type { Server } from "bun";

const FALLBACK_PORT_ATTEMPTS = 10;
const ANY_FREE_PORT = 0;

export function serveOnFreePort<WebSocketData>(
  preferredPort: number,
  serveOnPort: (port: number) => Server<WebSocketData>,
): Server<WebSocketData> {
  for (let offset = 0; offset < FALLBACK_PORT_ATTEMPTS; offset++) {
    try {
      return serveOnPort(preferredPort + offset);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    }
  }
  return serveOnPort(ANY_FREE_PORT);
}
