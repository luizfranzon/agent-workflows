import type { AccessCredentials } from "../domain/access-credentials";

export class BrowserAuthentication {
  constructor(private readonly credentials: AccessCredentials) {}

  exchangeLaunchToken(launchToken: string | null) {
    return this.credentials.acceptsLaunchToken(launchToken) ? this.credentials.sessionSecret : null;
  }

  isAuthenticated(sessionSecret: string | null) {
    return this.credentials.acceptsSession(sessionSecret);
  }
}
