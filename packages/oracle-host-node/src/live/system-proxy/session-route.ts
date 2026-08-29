/**
 * Proxy-route resolution for SESSION dials — the WS, gRPC and MQTT
 * twin of the HTTP transport's `proxy-route.ts` walk, the request
 * plane's order of precedence over the system plane turned into the
 * attempt list the transport walks:
 *
 *   1. Request plane `proxyUrl` (the `'url'` mode) → that proxy, one
 *      attempt, `plane: 'request'` — its conflicts (a socket-pinned or
 *      address-pinned dial, an unresolved credential ref, a SOCKS5 URL
 *      on a CONNECT-only dial) fail BEFORE the wire, here.
 *   2. Request plane `proxyMode: 'direct'` → direct, always, recorded.
 *   3. Request plane absent (inherit — the default) → the system plane
 *      resolves the target; its answer is a Chromium-semantics fallback
 *      chain: the first supported entry dials, a dial-level failure
 *      REACHING that proxy falls through to the next, DIRECT terminates
 *      the walk. An INHERITED proxy stands down (recorded) for the
 *      explicit asks a tunnel can't honor — `unixSocketPath`,
 *      `resolveToAddress`.
 *   4. No system plane / no answer → direct.
 *
 * SOCKS5 capability differs per session kind, so the caller declares
 * it: the WS dial rides undici dispatchers and can seat a
 * `Socks5ProxyAgent` (`'socks5-dialable'`); the gRPC session and the
 * raw MQTT socket are hand-rolled dials that tunnel HTTP CONNECT only
 * (`'connect-only'`), so ambient SOCKS5 entries skip like a failed
 * dial — the pinned-h2 posture — and an explicit one is the honest
 * pre-wire error. The SOCKS4 family stays the honest error on all.
 */

import { isSocks5ProxyUrl } from './proxy-value';
import type { SystemProxyResolver, SystemProxySource } from './types';

/**
 * Dial-level failure codes REACHING a proxy — the only failures the
 * system-plane chain walk falls through on, shared by the HTTP
 * transport's walker and the session walkers here. On a proxied dial a
 * refused / unresolved / unroutable / timed-out connect can only be
 * the proxy itself (target dialing happens at the proxy), which is
 * exactly Chromium's fall-through condition. CONNECT rejections (407
 * and friends) and target-leg failures surface instead — by then the
 * proxy answered, and the failure is meaningful.
 */
export const PROXY_DIAL_FAILURE_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
]);

/** Wire truth for one session's effective route — the seam callbacks
 *  carry it onto the session record. Absent route = plain direct. */
export interface SessionProxyRoute {
  /** The deciding plane: the request's own setting or the executing
   *  device's system plane. */
  plane: 'request' | 'system';
  /** The proxy the session actually tunneled through (credentials
   *  never ride it). Absent = the decision was direct. */
  proxyUrl?: string;
  /** Where the system plane's answer came from (system plane only). */
  source?: SystemProxySource;
  /** Present when an INHERITED proxy stood down for an explicit ask a
   *  tunnel can't honor — the session proceeded direct. */
  standDownReason?: 'unix-socket' | 'resolve-to-address';
}

/** One dial attempt the session walker runs — the effective proxy for
 *  it (absent = direct) and the route recorded when it wins. */
export interface SessionProxyAttempt {
  proxy?: { url: string; credential?: string };
  route?: SessionProxyRoute;
  /** True when this attempt came from an system-plane chain — the
   *  only attempts a proxy dial failure may fall through from. */
  environmentChain?: boolean;
}

/** What the session's dial can traverse: the WS dial seats a SOCKS5
 *  agent; the gRPC session tunnels HTTP CONNECT only. */
export type SessionDialCapability = 'socks5-dialable' | 'connect-only';

export interface SessionRouteRequest {
  /** The target as a resolvable URL (`wss://…`, `mqtts://…`, or the
   *  gRPC channel's synthesized `http(s)://authority`). */
  url: string;
  unixSocketPath?: string;
  resolveToAddress?: string;
  /** The request plane — see the module doc. A set `proxyUrl` is
   *  explicit routing regardless of the mode field (the executor keeps
   *  the pair consistent). */
  proxyMode?: 'direct' | 'url';
  proxyUrl?: string;
  proxyCredentialRef?: string;
  proxyCredential?: string;
  capability: SessionDialCapability;
}

/** The route-relevant slice of a transport request, defined keys only
 *  — every session transport hands the walker the same fields. */
export function sessionRouteFieldsOf(request: {
  url: string;
  unixSocketPath?: string;
  resolveToAddress?: string;
  proxyMode?: 'direct' | 'url';
  proxyUrl?: string;
  proxyCredentialRef?: string;
  proxyCredential?: string;
}): Omit<SessionRouteRequest, 'capability'> {
  return {
    url: request.url,
    ...(request.unixSocketPath !== undefined ? { unixSocketPath: request.unixSocketPath } : {}),
    ...(request.resolveToAddress !== undefined ? { resolveToAddress: request.resolveToAddress } : {}),
    ...(request.proxyMode !== undefined ? { proxyMode: request.proxyMode } : {}),
    ...(request.proxyUrl !== undefined ? { proxyUrl: request.proxyUrl } : {}),
    ...(request.proxyCredentialRef !== undefined ? { proxyCredentialRef: request.proxyCredentialRef } : {}),
    ...(request.proxyCredential !== undefined ? { proxyCredential: request.proxyCredential } : {}),
  };
}

/** Resolution outcome: the attempt list to walk, or the honest
 *  pre-wire error when the chain resolves only to proxies this dial
 *  cannot traverse. The caller wraps `errorMessage` in its own seam
 *  error type. */
export type SessionRouteResult = { attempts: SessionProxyAttempt[] } | { errorMessage: string };

const DIRECT_ATTEMPT: SessionProxyAttempt[] = [{}];

/** Whether a failure's code chain marks a dial-level failure reaching
 *  the proxy — the session walkers' fall-through predicate (the HTTP
 *  walker tests its classified error's cause code instead). */
export function isSessionProxyDialFailure(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 8 && current !== null && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === 'string' && PROXY_DIAL_FAILURE_CODES.has(record.code)) return true;
    current = record.cause;
  }
  return false;
}

/** The stand-down reason for an inherited proxy against this request's
 *  explicit asks, or null when nothing conflicts. */
function standDownReasonFor(request: SessionRouteRequest): 'unix-socket' | 'resolve-to-address' | null {
  if (request.unixSocketPath !== undefined) return 'unix-socket';
  if (request.resolveToAddress !== undefined) return 'resolve-to-address';
  return null;
}

/**
 * The request plane's own contradictions, failed BEFORE the wire with
 * the HTTP transport's prose — an explicit contradiction is the user's
 * to resolve (an ambient one is ours to yield on).
 */
function explicitProxyError(request: SessionRouteRequest, proxyUrl: string): string | null {
  if (request.unixSocketPath !== undefined) {
    return "The request sets both a proxy and a Unix socket target, but a proxy tunnel can't dial a local socket. Clear one of the two settings.";
  }
  if (request.resolveToAddress !== undefined) {
    return "The request sets both a proxy and resolve-to-address, but a proxy resolves the hostname itself — the address pin can't apply. Clear one of the two settings.";
  }
  if (request.proxyCredentialRef !== undefined && request.proxyCredential === undefined) {
    return `The request's proxy-credentials setting references the vault entry "${request.proxyCredentialRef}", which doesn't exist on this device. Add a string entry with that name (holding user:password) to the vault, or clear the setting.`;
  }
  if (request.capability === 'connect-only' && isSocks5ProxyUrl(proxyUrl)) {
    return `The request routes through a SOCKS5 proxy (${proxyUrl}), which this connection can't traverse — it tunnels through HTTP CONNECT only. Use an http:// or https:// proxy, or set the request's proxy setting to Direct.`;
  }
  return null;
}

/**
 * Resolve the attempt list for one session dial. Always answers at
 * least one attempt unless the route is honestly undialable — that
 * comes back as `errorMessage`, never a throw (the seams' error types
 * differ, so the caller wraps).
 */
export async function resolveSessionProxyAttempts(
  request: SessionRouteRequest,
  resolver: SystemProxyResolver | null,
): Promise<SessionRouteResult> {
  // Request plane first — an explicit setting never consults the
  // system plane.
  if (request.proxyUrl !== undefined) {
    const error = explicitProxyError(request, request.proxyUrl);
    if (error !== null) return { errorMessage: error };
    return {
      attempts: [
        {
          proxy: {
            url: request.proxyUrl,
            ...(request.proxyCredential !== undefined ? { credential: request.proxyCredential } : {}),
          },
          route: { plane: 'request', proxyUrl: request.proxyUrl },
        },
      ],
    };
  }
  if (request.proxyMode === 'direct') return { attempts: [{ route: { plane: 'request' } }] };
  if (resolver === null) return { attempts: DIRECT_ATTEMPT };
  const selection = await resolver.resolve(request.url).catch(() => null);
  if (selection === null || selection.entries.length === 0) return { attempts: DIRECT_ATTEMPT };
  const proxyish = selection.entries.some((entry) => entry.kind !== 'direct');
  if (!proxyish) return { attempts: DIRECT_ATTEMPT };
  const standDown = standDownReasonFor(request);
  if (standDown !== null) {
    return { attempts: [{ route: { plane: 'system', source: selection.source, standDownReason: standDown } }] };
  }
  const attempts: SessionProxyAttempt[] = [];
  let sawSocks4: string | null = null;
  let sawBlockedSocks5: string | null = null;
  for (const entry of selection.entries) {
    if (entry.kind === 'direct') {
      // Nothing falls past a DIRECT entry. A chain that OPENS with one
      // is a plain direct answer (no route); direct as a fallback after
      // proxies is a real system-plane decision and says so.
      attempts.push(attempts.length === 0 ? {} : { route: { plane: 'system', source: selection.source } });
      break;
    }
    if (entry.kind === 'socks') {
      sawSocks4 ??= entry.raw;
      continue;
    }
    if (request.capability === 'connect-only' && isSocks5ProxyUrl(entry.url)) {
      // This dial tunnels HTTP CONNECT only — a SOCKS5 entry is
      // undialable for it, skipped like a failed dial so a supported
      // fallback behind it still serves.
      sawBlockedSocks5 ??= entry.url;
      continue;
    }
    attempts.push({
      proxy: { url: entry.url, ...(entry.credential !== undefined ? { credential: entry.credential } : {}) },
      route: { plane: 'system', proxyUrl: entry.url, source: selection.source },
      environmentChain: true,
    });
  }
  if (attempts.length === 0) {
    if (sawBlockedSocks5 !== null) {
      return {
        errorMessage: `This machine's proxy configuration resolves ${request.url} to a SOCKS5 proxy (${sawBlockedSocks5}), which this connection can't traverse — it tunnels through HTTP CONNECT only. Set the request's proxy setting to Direct to bypass it, or point the system plane at an HTTP(S) proxy.`,
      };
    }
    if (sawSocks4 !== null) {
      return {
        errorMessage: `This machine's proxy configuration resolves ${request.url} to a SOCKS4 proxy (${sawSocks4}), which the engine doesn't dial — SOCKS5 and HTTP(S) proxies are supported. Set the request's proxy setting to Direct to bypass it, or point the system plane at a SOCKS5 or HTTP(S) proxy.`,
      };
    }
    return { attempts: DIRECT_ATTEMPT };
  }
  return { attempts };
}
