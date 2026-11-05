/** Only a literal loopback address may carry short-lived Agent capabilities over
 * HTTP. Public URLs and DNS names must never select this exception. */
export function roleGatewayUrl(value: string): URL {
  const url = new URL(value);
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash
    || !['http:', 'https:'].includes(url.protocol)
    || url.protocol === 'http:' && !['127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Agent gateway requires HTTPS or literal loopback HTTP, without path, credentials, query or fragment');
  }
  return url;
}

export function configuredRoleGateway(cfg: { publicBaseUrl: string; host: string; port: number; codex: { gatewayOrigin?: string } }): URL {
  if (cfg.codex.gatewayOrigin) return roleGatewayUrl(cfg.codex.gatewayOrigin);
  const publicUrl = new URL(cfg.publicBaseUrl);
  if (publicUrl.protocol === 'https:') return roleGatewayUrl(cfg.publicBaseUrl);
  // The API must also listen on loopback. An explicit value is required for an
  // unusual deployment; the public LAN/domain origin is never sent to a role.
  if (!['127.0.0.1', 'localhost', '0.0.0.0', '::1', '::'].includes(cfg.host)) throw new Error('Set CODEX_GATEWAY_ORIGIN to a reachable loopback API origin');
  return roleGatewayUrl(`http://${['::1', '::'].includes(cfg.host) ? '[::1]' : '127.0.0.1'}:${cfg.port}`);
}
