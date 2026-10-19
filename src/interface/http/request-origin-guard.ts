const LOOPBACK_HOSTNAMES = ["127.0.0.1", "localhost"];
const SAFE_METHODS = ["GET", "HEAD"];

export function isFromTrustedOrigin(request: Request, port: number) {
  const trustedHosts = LOOPBACK_HOSTNAMES.map((hostname) => `${hostname}:${port}`);
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");

  if (host === null || !trustedHosts.includes(host)) return false;
  if (origin === null) return SAFE_METHODS.includes(request.method);
  return trustedHosts.some((trustedHost) => origin === `http://${trustedHost}`);
}
