/**
 * The dial policy → wire — ONE mapping for every dial the node host
 * makes, the TLS policy bag's sibling: the resolve-to-address pin as a
 * `lookup` seat (the HTTP dispatcher's connect bag, the WebSocket
 * connector, the gRPC HTTP/2 session, the MQTT socket), and the
 * failure prose a pinned or proxied dial classifies with, so a
 * refused connect names the setting that sent it there on every
 * request kind. Pure — testable without a live socket.
 */

import { isIP, type LookupFunction } from 'node:net';
import { proxyConnectRejectedStatus } from './request-transport/connect-tunnel';
import type { SessionProxyAttempt } from './system-proxy/session-route';

/**
 * Resolver pinned to one address: answers EVERY hostname it is asked
 * about with `address`, in both callback shapes Node's `net.connect`
 * uses (`all: true` Happy-Eyeballs mode expects an address list; the
 * family-pinned path expects `(err, address, family)`). The dial
 * derives `servername` from the URL's hostname BEFORE connecting, so
 * SNI, the Host header, and certificate verification all keep the
 * original name — the pin only changes where the socket goes.
 */
export function pinnedLookup(address: string): LookupFunction {
  const family = isIP(address);
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

/** The `lookup` seat a request's pin maps to — an empty bag without
 *  one, so every dial spreads it beside its own fields. */
export function pinnedLookupOptionsFor(request: { resolveToAddress?: string }): { lookup?: LookupFunction } {
  return request.resolveToAddress !== undefined ? { lookup: pinnedLookup(request.resolveToAddress) } : {};
}

/** `host[:port]` of a proxy URL, for error messages. */
function proxyHostOf(proxyUrl: string): string {
  try {
    return new URL(proxyUrl).host;
  } catch {
    return proxyUrl;
  }
}

/** The failure's meaningful code, walking the `cause` chain. */
function failureCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current !== null && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === 'string') return record.code;
    current = record.cause;
  }
  return undefined;
}

/** What the session dial is called in the prose — the WS / MQTT
 *  session, the gRPC call. */
export type SessionDialNoun = 'session' | 'call';

/**
 * Classify a failure on a PROXIED session dial against the proxy leg —
 * the attempt's route names the plane, so the prose names what sent
 * the dial there: the request's own proxy setting (and its credential
 * ref on a 407), or this machine's proxy configuration. A rejected
 * CONNECT is the proxy's own answer; a dial-level failure can only be
 * the proxy itself (target dialing happens at the proxy). `undefined`
 * when the attempt is direct or the failure is past the tunnel — by
 * then the proxy is a transparent pipe and the target-leg prose
 * applies.
 */
export function classifyProxyLegFailure(
  target: string,
  err: unknown,
  attempt: SessionProxyAttempt | undefined,
  noun: SessionDialNoun,
  credentialRef?: string,
): string | undefined {
  if (attempt?.proxy === undefined) return undefined;
  const proxyHost = proxyHostOf(attempt.proxy.url);
  const requestPlane = attempt.route?.plane === 'request';
  const via = requestPlane
    ? `the request's proxy setting routes this ${noun} through it`
    : `this machine's proxy configuration routes this ${noun} through it`;
  const rejected = proxyConnectRejectedStatus(err);
  if (rejected === 407) {
    if (!requestPlane) {
      return `The proxy at ${proxyHost} requires authentication (407) — ${via}. Check the system plane's proxy credentials in the app settings.`;
    }
    return credentialRef !== undefined
      ? `The proxy at ${proxyHost} rejected the credentials (407). Check the request's proxy-credentials setting — the vault entry "${credentialRef}" may hold the wrong user:password.`
      : `The proxy at ${proxyHost} requires authentication (407). Set the request's proxy-credentials setting to a vault string entry holding user:password.`;
  }
  if (rejected !== undefined) {
    return `The proxy at ${proxyHost} could not open a tunnel to ${target} (HTTP ${rejected}). The proxy is reachable — the failure is between the proxy and the target.`;
  }
  switch (failureCode(err)) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not resolve the proxy host ${proxyHost} (DNS lookup failed) — ${via}.`;
    case 'ECONNREFUSED':
      return `Connection refused by the proxy at ${proxyHost} — ${via}. Is the proxy running?`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `No route to the proxy at ${proxyHost} (${failureCode(err)}) — ${via}.`;
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
      return `Connection to the proxy at ${proxyHost} timed out — ${via}.`;
    default:
      return undefined;
  }
}

/**
 * Classify a dial-level failure on an ADDRESS-PINNED direct dial —
 * the refused / unroutable / timed-out connect happened at the pinned
 * address, so the prose names the resolve-to-address setting that sent
 * it there (the HTTP classifier's pinned prose). `undefined` without a
 * pin or for codes outside the dial set.
 */
export function classifyPinnedDialFailure(host: string, pinned: string | undefined, err: unknown): string | undefined {
  if (pinned === undefined) return undefined;
  const code = failureCode(err);
  switch (code) {
    case 'ECONNREFUSED':
      return `Connection refused at ${pinned} — the request's resolve-to-address setting points ${host} there. Is the service listening on that address and the URL's port?`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `No route to ${pinned} (${code}) — the request's resolve-to-address setting points ${host} there.`;
    case 'ETIMEDOUT':
    case 'UND_ERR_CONNECT_TIMEOUT':
      return `Connection to ${host} timed out — the request's resolve-to-address setting points it at ${pinned}.`;
    default:
      return undefined;
  }
}
