/**
 * Ambient proxy-route resolution for SESSION dials — the WS and gRPC
 * twins of the HTTP transport's `proxy-route.ts` walk. These dials
 * carry NO request-plane proxy knobs (the H5 ruling: their editors
 * stay knob-free), so the system plane is the only plane that
 * can answer, and every recorded route is `plane: 'system'`.
 *
 * Same chain semantics as HTTP sends: the resolved answer is a
 * Chromium-style fallback chain; the first supported entry dials, a
 * dial-level failure REACHING that proxy falls through to the next,
 * DIRECT terminates the walk. The one stand-down analog these dials
 * have is `unixSocketPath` (a socket-pinned dial never opens a TCP
 * connection, so a tunnel has nowhere to run) — recorded, like HTTP,
 * only when the plane actually answered a proxy.
 *
 * SOCKS5 capability differs per session kind, so the caller declares
 * it: the WS dial rides undici dispatchers and can seat a
 * `Socks5ProxyAgent` (`'socks5-dialable'`); the gRPC session is a
 * hand-rolled `node:http2` dial that tunnels HTTP CONNECT only
 * (`'connect-only'`), so SOCKS5 entries skip like a failed dial — the
 * pinned-h2 posture. The SOCKS4 family stays the honest error on both.
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
 *  carry it onto the session record (`plane: 'system'` implied:
 *  these dials have no request plane). Absent route = plain direct. */
export interface SessionProxyRoute {
  /** The proxy the session actually tunneled through (credentials
   *  never ride it). Absent = the decision was direct. */
  proxyUrl?: string;
  source: SystemProxySource;
  /** Present when the ambient proxy stood down for a socket-pinned
   *  dial — the session proceeded direct. */
  standDownReason?: 'unix-socket';
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
  /** The target as a resolvable URL (`wss://…`, or the gRPC channel's
   *  synthesized `http(s)://authority`). */
  url: string;
  unixSocketPath?: string;
  capability: SessionDialCapability;
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

/**
 * Resolve the attempt list for one session dial. Always answers at
 * least one attempt unless the chain is honestly undialable — that
 * comes back as `errorMessage`, never a throw (the seams' error types
 * differ, so the caller wraps).
 */
export async function resolveSessionProxyAttempts(
  request: SessionRouteRequest,
  resolver: SystemProxyResolver | null,
): Promise<SessionRouteResult> {
  if (resolver === null) return { attempts: DIRECT_ATTEMPT };
  const selection = await resolver.resolve(request.url).catch(() => null);
  if (selection === null || selection.entries.length === 0) return { attempts: DIRECT_ATTEMPT };
  const proxyish = selection.entries.some((entry) => entry.kind !== 'direct');
  if (!proxyish) return { attempts: DIRECT_ATTEMPT };
  if (request.unixSocketPath !== undefined) {
    return { attempts: [{ route: { source: selection.source, standDownReason: 'unix-socket' } }] };
  }
  const attempts: SessionProxyAttempt[] = [];
  let sawSocks4: string | null = null;
  let sawBlockedSocks5: string | null = null;
  for (const entry of selection.entries) {
    if (entry.kind === 'direct') {
      // Nothing falls past a DIRECT entry. A chain that OPENS with one
      // is a plain direct answer (no route); direct as a fallback after
      // proxies is a real system-plane decision and says so.
      attempts.push(attempts.length === 0 ? {} : { route: { source: selection.source } });
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
      route: { proxyUrl: entry.url, source: selection.source },
      environmentChain: true,
    });
  }
  if (attempts.length === 0) {
    // These dials have no request-plane Direct — the escape hatch is
    // the system plane itself (Off, or a supported proxy).
    if (sawBlockedSocks5 !== null) {
      return {
        errorMessage: `This machine's proxy configuration resolves ${request.url} to a SOCKS5 proxy (${sawBlockedSocks5}), which this connection can't traverse — it tunnels through HTTP CONNECT only. Set the system-plane proxy to Off, or point it at an HTTP(S) proxy.`,
      };
    }
    if (sawSocks4 !== null) {
      return {
        errorMessage: `This machine's proxy configuration resolves ${request.url} to a SOCKS4 proxy (${sawSocks4}), which the engine doesn't dial — SOCKS5 and HTTP(S) proxies are supported. Set the system-plane proxy to Off, or point it at a SOCKS5 or HTTP(S) proxy.`,
      };
    }
    return { attempts: DIRECT_ATTEMPT };
  }
  return { attempts };
}
