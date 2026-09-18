/**
 * The hand-rolled redirect follower. Fetches each hop with
 * `redirect: 'manual'` and applies the shared redirect policy
 * (`@openheaders/oracle/live/request-exec/redirect-policy` — the one
 * source the delegating transport's loop applies too): the fetch
 * spec's method/body demotion and cross-origin Authorization strip
 * (each relaxable by its knob), relative `Location`s resolved against
 * the current hop, the chain capped at the request's `maxRedirects`
 * (default 20; 0 = fail on any redirect). Intermediate 3xx bodies are
 * canceled so their connections return to the pool; only the FINAL
 * response's body is read.
 */

import {
  DEFAULT_MAX_REDIRECTS,
  nextRedirectHop,
  REDIRECT_STATUSES,
  redirectHopRecord,
  redirectLimitError,
} from '@openheaders/oracle/live/request-exec/redirect-policy';
import type {
  TransportRedirectHop,
  TransportRequest,
  TransportResponse,
} from '@openheaders/oracle/live/request-exec/transport';
import type { Dispatcher } from 'undici';
import type { CookieJar } from '../cookie-jar';
import type { ConnectionRecord } from '../instrumented-connector';
import { withHostUserAgent } from '../user-agent';
import { digestRetryHop } from './digest-leg';
import { dpopRetryHop, withDpopProof } from './dpop-leg';
import { finalizeResponse } from './finalize';
import { captureJarCookies, type JarActivity, withJarCookie } from './jar-leg';
import type { Deadline, HopState, NodeFetchFn, NodeRequestFn, StreamingLeg, WireLeg } from './seam';
import { wireHop } from './wire-hops';

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
  let hop: HopState = {
    url: request.url,
    method: request.method,
    headers: withHostUserAgent(request.headers),
    body: request.body,
  };
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
    // The DPoP proof is per hop too — this hop's method + target under
    // the origin's nonce, and none once a cross-origin strip took the
    // Authorization with it. Like the jar, it never joins the hop state.
    sendHop = await withDpopProof(request, sendHop);
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
    // DPoP nonce leg — per hop as well: the resource's `use_dpop_nonce`
    // challenge is answered once with a proof carrying the issued nonce;
    // the proof stays out of the hop state (the next hop mints its own).
    const dpopRetry = await dpopRetryHop(fetchFn, requestFn, request, hop, response, deadline, dispatcher, jar, leg);
    if (dpopRetry !== null) {
      response = dpopRetry.response;
      if (jarActivity !== undefined) {
        if (redirects === 0 && jarActivity.cookieHeaderAttached === undefined && dpopRetry.jarAttached !== undefined) {
          jarActivity = { ...jarActivity, cookieHeaderAttached: dpopRetry.jarAttached };
        }
        jarActivity.cookiesCaptured.push(...dpopRetry.jarCaptured);
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
    if (redirects >= maxRedirects) throw redirectLimitError(maxRedirects);
    redirects++;
    const next = nextRedirectHop(hop, response.status, location, request);
    authorizationForwarded ||= next.authorization === 'forwarded';
    redirectChain.push(redirectHopRecord(hop, response.status, response.statusText, location, next));
    hop = next.hop;
  }
}
