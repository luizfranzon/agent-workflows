import { timingSafeEqual } from "node:crypto";

export class AccessCredentials {
  constructor(
    readonly launchToken: string,
    readonly sessionSecret: string,
  ) {}

  acceptsLaunchToken(candidate: string | null) {
    return matchesSecret(this.launchToken, candidate);
  }

  acceptsSession(candidate: string | null) {
    return matchesSecret(this.sessionSecret, candidate);
  }
}

function matchesSecret(secret: string, candidate: string | null) {
  if (candidate === null) return false;
  const secretBytes = Buffer.from(secret);
  const candidateBytes = Buffer.from(candidate);
  return secretBytes.length === candidateBytes.length && timingSafeEqual(secretBytes, candidateBytes);
}
