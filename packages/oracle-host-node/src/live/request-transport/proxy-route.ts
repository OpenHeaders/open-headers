/**
 * Per-send proxy-route resolution — the request plane's order of
 * precedence over the environment plane, turned into the attempt list
 * the transport walks (docs/REQUEST_ENGINE_PROXY_DESIGN.md):
 *
 *   1. Request plane `proxyMode: 'url'` / a set `proxyUrl` → that
 *      proxy, exactly today's behavior (guards and errors included).
 *   2. Request plane `proxyMode: 'direct'` → direct, always.
 *   3. Request plane absent (inherit — the default) → the environment
 *      plane resolves the target; its answer is a Chromium-semantics
 *      fallback chain the transport walks (first supported entry
 *      dials, a dial failure falls through, DIRECT means direct).
 *   4. No environment plane / no answer → direct.
 *
 * The STAND-DOWN rule lives here too: an INHERITED proxy never breaks
 * a request that explicitly asked for something a tunnel can't honor —
 * `unixSocketPath`, `resolveToAddress`, or a pinned `'3'` make the
 * ambient proxy yield for that send, recorded with the reason.
 * Explicit request-plane proxies in the same conflicts keep their
 * pre-wire errors (an explicit contradiction is the user's to
 * resolve; an ambient one is ours to yield on).
 *
 * SOCKS5 entries are dialable like HTTP(S) ones (P5) — with one gate:
 * a pinned `'2'`/`'2-prior-knowledge'` send can't ride the SOCKS5
 * dial (its hand-rolled h2 pipeline speaks HTTP CONNECT only), so
 * those sends skip SOCKS5 entries like a failed dial. SOCKS4-family
 * answers stay ungated honesty: a chain whose only usable entries the
 * send can't traverse fails honestly, naming what the machine
 * resolved and both escape hatches.
 */

import {
  TransportError,
  type TransportProxyRoute,
  type TransportRequest,
} from '@openheaders/oracle/live/request-exec/transport';
import { isSocks5ProxyUrl } from '../environment-proxy/proxy-value';
import type { EnvironmentProxyResolver } from '../environment-proxy/types';

/** One send attempt the transport runs — the effective proxy for it
 *  (absent = direct) and the wire truth recorded when it wins. */
export interface ProxyAttempt {
  proxy?: { url: string; credential?: string };
  meta?: TransportProxyRoute;
  /** True when this attempt came from an environment-plane chain — the
   *  only attempts a proxy dial failure may fall through from. */
  environmentChain?: boolean;
}

/** The stand-down reason for an inherited proxy against this request's
 *  explicit asks, or null when nothing conflicts. */
function standDownReasonFor(request: TransportRequest): 'unix-socket' | 'resolve-to-address' | 'http-version-3' | null {
  if (request.unixSocketPath !== undefined) return 'unix-socket';
  if (request.resolveToAddress !== undefined) return 'resolve-to-address';
  if (request.httpVersion === '3') return 'http-version-3';
  return null;
}

const DIRECT_ATTEMPT: ProxyAttempt[] = [{}];

/**
 * Resolve the attempt list for one send. Always returns at least one
 * attempt; throws only the honest SOCKS gate.
 */
export async function resolveProxyAttempts(
  request: TransportRequest,
  resolver: EnvironmentProxyResolver | null,
): Promise<ProxyAttempt[]> {
  // Request plane first — an explicit setting never consults the
  // environment. A set proxyUrl is explicit routing regardless of the
  // mode field (the executor keeps the pair consistent).
  if (request.proxyUrl !== undefined) {
    return [{ proxy: { url: request.proxyUrl }, meta: { plane: 'request', proxyUrl: request.proxyUrl } }];
  }
  if (request.proxyMode === 'direct') {
    return [{ meta: { plane: 'request' } }];
  }
  if (resolver === null) return DIRECT_ATTEMPT;
  const selection = await resolver.resolve(request.url).catch(() => null);
  if (selection === null || selection.entries.length === 0) return DIRECT_ATTEMPT;
  const proxyish = selection.entries.some((entry) => entry.kind !== 'direct');
  if (!proxyish) return DIRECT_ATTEMPT;
  const standDown = standDownReasonFor(request);
  if (standDown !== null) {
    return [{ meta: { plane: 'environment', source: selection.source, standDownReason: standDown } }];
  }
  const pinnedH2 = request.httpVersion === '2' || request.httpVersion === '2-prior-knowledge';
  const attempts: ProxyAttempt[] = [];
  let sawSocks4: string | null = null;
  let sawPinBlockedSocks5: string | null = null;
  for (const entry of selection.entries) {
    if (entry.kind === 'direct') {
      // Nothing falls past a DIRECT entry. A chain that OPENS with one
      // is a plain direct answer (no meta); direct as a fallback after
      // proxies is a real environment-plane decision and says so.
      attempts.push(attempts.length === 0 ? {} : { meta: { plane: 'environment', source: selection.source } });
      break;
    }
    if (entry.kind === 'socks') {
      sawSocks4 ??= entry.raw;
      continue;
    }
    if (pinnedH2 && isSocks5ProxyUrl(entry.url)) {
      // The pinned h2 pipelines tunnel through HTTP CONNECT only — a
      // SOCKS5 entry is undialable for THIS send, skipped like a
      // failed dial so a supported fallback behind it still serves.
      sawPinBlockedSocks5 ??= entry.url;
      continue;
    }
    attempts.push({
      proxy: { url: entry.url, ...(entry.credential !== undefined ? { credential: entry.credential } : {}) },
      meta: { plane: 'environment', proxyUrl: entry.url, source: selection.source },
      environmentChain: true,
    });
  }
  if (attempts.length === 0) {
    if (sawPinBlockedSocks5 !== null) {
      throw new TransportError(
        `This machine's proxy configuration resolves ${request.url} to a SOCKS5 proxy (${sawPinBlockedSocks5}), but the request pins HTTP/2, which rides an HTTP CONNECT tunnel the SOCKS5 dial can't carry. Set the HTTP version to Auto, set the request's proxy setting to Direct, or point the environment plane at an HTTP(S) proxy.`,
      );
    }
    if (sawSocks4 !== null) {
      throw new TransportError(
        `This machine's proxy configuration resolves ${request.url} to a SOCKS4 proxy (${sawSocks4}), which the engine doesn't dial — SOCKS5 and HTTP(S) proxies are supported. Set the request's proxy setting to Direct to bypass it, or point the environment plane at a SOCKS5 or HTTP(S) proxy.`,
      );
    }
    return DIRECT_ATTEMPT;
  }
  return attempts;
}

/**
 * The request as the wire layers see it for one attempt: an
 * environment-plane proxy materializes onto the same seam fields the
 * explicit knob uses, so every layer below (guards, dispatcher tuple,
 * tunnel legs, error classification) honors the effective route with
 * zero special cases. The vault ref never rides along — an inline
 * environment credential has no vault identity.
 */
export function materializeProxyAttempt(request: TransportRequest, attempt: ProxyAttempt): TransportRequest {
  if (attempt.proxy === undefined || attempt.proxy.url === request.proxyUrl) return request;
  const { proxyCredentialRef: _ref, proxyCredential: _credential, ...rest } = request;
  return {
    ...rest,
    proxyUrl: attempt.proxy.url,
    ...(attempt.proxy.credential !== undefined ? { proxyCredential: attempt.proxy.credential } : {}),
  };
}
