/**
 * The hand-rolled redirect follower. Fetches each hop with
 * `redirect: 'manual'`, applies the fetch spec's method/body demotion
 * and cross-origin Authorization strip (each relaxable by its knob),
 * resolves relative `Location`s against the current hop, and caps the
 * chain at the request's `maxRedirects` (default 20; 0 = fail on any
 * redirect). Intermediate 3xx bodies are canceled so their connections
 * return to the pool; only the FINAL response's body is read.
 */

import {
  TransportError,
  type TransportRedirectHop,
  type TransportRequest,
  type TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import type { Dispatcher } from 'undici';
import type { CookieJar } from '../cookie-jar';
import type { ConnectionRecord } from '../instrumented-connector';
import { digestRetryHop } from './digest-leg';
import { finalizeResponse } from './finalize';
import { captureJarCookies, type JarActivity, withJarCookie } from './jar-leg';
import type { Deadline, HopState, NodeFetchFn, NodeRequestFn, StreamingLeg, WireLeg } from './seam';
import { wireHop } from './wire-hops';

/** Redirect-hop ceiling when the request carries no `maxRedirects`. */
const DEFAULT_MAX_REDIRECTS = 20;

/** 3xx statuses that redirect. 304 (and any 3xx without a `Location`
 *  header) is a final response, per the fetch spec. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Request-body metadata headers dropped alongside the body when a
 *  301/302/303 hop demotes the method to GET (fetch-spec behavior). */
const BODY_HEADERS = new Set([
  'content-length',
  'content-type',
  'content-encoding',
  'content-language',
  'content-location',
]);

export async function followRedirectChain(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  jar: CookieJar | undefined,
  sentAt: number,
  streaming: StreamingLeg | null,
  capture: ReadonlyArray<ConnectionRecord> | undefined,
  negotiated: ReadonlyMap<string, string> | undefined,
  leg: WireLeg | null,
): Promise<TransportResponse> {
  const maxRedirects = request.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let hop: HopState = { url: request.url, method: request.method, headers: request.headers, body: request.body };
  let authorizationForwarded = false;
  let redirects = 0;
  let jarActivity: JarActivity | undefined = jar !== undefined ? { cookiesCaptured: [] } : undefined;
  // Per-hop attribution for the snapshot — one record per hop that
  // REDIRECTED (the final response is the snapshot itself). The loop
  // owns the chain, so only this transport can record it.
  const redirectChain: TransportRedirectHop[] = [];
  while (true) {
    // The jar contributes per hop, computed fresh against the CURRENT
    // hop's URL — a cookie set mid-chain rides the next hop, and a
    // cookie that doesn't domain/path-match a cross-origin hop stays
    // home (the jar's matching IS the cross-origin discipline). The
    // contribution never joins the persistent hop state, so it can't
    // masquerade as a user-set header on later hops.
    let sendHop = hop;
    if (jar !== undefined && jarActivity !== undefined) {
      const { headers, attached } = withJarCookie(jar, hop);
      sendHop = { ...hop, headers };
      if (redirects === 0 && attached !== undefined) jarActivity = { ...jarActivity, cookieHeaderAttached: attached };
    }
    // Marked per iteration so the surviving value is the FINAL hop's
    // dispatch instant — the boundary between the redirect and waiting
    // phases (a digest second leg stays inside this hop's wait).
    const hopSentAt = performance.now();
    let response = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher, leg);
    if (jar !== undefined && jarActivity !== undefined) {
      jarActivity.cookiesCaptured.push(...captureJarCookies(jar, hop.url, response.headers));
    }
    // Digest second leg — per hop, so a challenge behind a redirect is
    // answered for THAT hop's method + target. The authorized hop
    // replaces the current one, and a 401 on the resend flows on as a
    // normal (final) response — at most one auth retry per hop by
    // construction.
    const retry = await digestRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar, leg);
    if (retry !== null) {
      response = retry.response;
      hop = retry.hop;
      if (jarActivity !== undefined) {
        if (redirects === 0 && jarActivity.cookieHeaderAttached === undefined && retry.jarAttached !== undefined) {
          jarActivity = { ...jarActivity, cookieHeaderAttached: retry.jarAttached };
        }
        jarActivity.cookiesCaptured.push(...retry.jarCaptured);
      }
    }
    const location = REDIRECT_STATUSES.has(response.status) ? response.headers.get('location') : null;
    if (location === null)
      return finalizeResponse(
        response,
        request,
        hop.url,
        deadline,
        authorizationForwarded,
        jarActivity,
        redirectChain,
        { sentAt, finalHopSentAt: hopSentAt },
        streaming,
        capture,
        negotiated,
      );
    await response.body?.cancel();
    if (redirects >= maxRedirects) {
      throw new TransportError(`Stopped after ${maxRedirects} redirects — the request's redirect limit.`);
    }
    redirects++;
    const next = nextHop(hop, response.status, location, request);
    authorizationForwarded ||= next.authorization === 'forwarded';
    redirectChain.push({
      url: hop.url,
      method: hop.method,
      status: response.status,
      statusText: response.statusText,
      location,
      ...(next.methodChangedTo !== undefined ? { methodChangedTo: next.methodChangedTo } : {}),
      ...(next.authorization !== undefined ? { authorization: next.authorization } : {}),
    });
    hop = next.hop;
  }
}

/**
 * Derive the next hop from a redirect response: resolve the (possibly
 * relative) `Location` against the current URL, apply the spec's
 * method/body demotion (301/302 POST→GET, 303 any-non-GET/HEAD→GET;
 * 307/308 always preserve) unless `followOriginalHttpMethod` keeps it,
 * and strip `Authorization` when the hop crosses origin unless
 * `followAuthorizationHeader` keeps it. What the derivation DID —
 * method demotion, Authorization strip/forward — is reported alongside
 * so the caller can record the hop and mark the response.
 */
function nextHop(
  prev: HopState,
  status: number,
  location: string,
  request: TransportRequest,
): { hop: HopState; methodChangedTo?: string; authorization?: 'stripped' | 'forwarded' } {
  let nextUrl: URL;
  try {
    nextUrl = new URL(location, prev.url);
  } catch {
    throw new TransportError(`Redirect points to an invalid URL: "${location}".`);
  }
  let method = prev.method;
  let body = prev.body;
  let headers = prev.headers;
  const demoteToGet =
    request.followOriginalHttpMethod !== true &&
    ((status === 303 && method !== 'GET' && method !== 'HEAD') ||
      ((status === 301 || status === 302) && method === 'POST'));
  if (demoteToGet) {
    method = 'GET';
    body = { kind: 'none' };
    headers = headers.filter((h) => !BODY_HEADERS.has(h.key.toLowerCase()));
  }
  let authorization: 'stripped' | 'forwarded' | undefined;
  const crossOrigin = new URL(prev.url).origin !== nextUrl.origin;
  if (crossOrigin && headers.some((h) => h.key.toLowerCase() === 'authorization')) {
    if (request.followAuthorizationHeader === true) {
      authorization = 'forwarded';
    } else {
      authorization = 'stripped';
      headers = headers.filter((h) => h.key.toLowerCase() !== 'authorization');
    }
  }
  return {
    hop: { url: nextUrl.toString(), method, headers, body },
    ...(demoteToGet ? { methodChangedTo: method } : {}),
    ...(authorization !== undefined ? { authorization } : {}),
  };
}
