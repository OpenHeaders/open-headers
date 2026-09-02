/**
 * The DPoP leg of the redirect loop (RFC 9449): when the request
 * carries proof material, every hop that still carries its
 * `Authorization: DPoP` header gets a proof minted for THAT hop —
 * `htm` / `htu` are the hop's method and target, `ath` the token's
 * hash, the nonce the origin last issued — and a 401
 * `use_dpop_nonce` challenge is answered by one resend of the hop
 * with the issued nonce (§9). A hop whose Authorization the
 * cross-origin strip removed sends no proof either. Every hop
 * response's `DPoP-Nonce` feeds the per-origin cache, so the next
 * send to that origin carries it up front (§9: the server may rotate
 * on any answer).
 */

import {
  DPOP_HEADER,
  dpopNonceOf,
  isDpopNonceChallengeFromResource,
  mintDpopProof,
  type OAuth2DpopProofMaterial,
} from '@openheaders/core/oauth';
import { dpopNonceFor, rememberDpopNonce } from '@openheaders/oracle/live/request-exec/dpop-nonces';
import type { TransportHeader, TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import type { Dispatcher } from 'undici';
import type { CookieJar } from '../cookie-jar';
import { captureJarCookies, withJarCookie } from './jar-leg';
import type { Deadline, HopResponse, HopState, NodeFetchFn, NodeRequestFn, WireLeg } from './seam';
import { wireHop } from './wire-hops';

const hasAuthorization = (headers: ReadonlyArray<TransportHeader>): boolean =>
  headers.some((h) => h.key.toLowerCase() === 'authorization');

/** `headers` with the `DPoP` proof set replace-not-append, or without one. */
function withDpopHeader(headers: ReadonlyArray<TransportHeader>, proof: string | null): TransportHeader[] {
  const rest = headers.filter((h) => h.key.toLowerCase() !== 'dpop');
  return proof === null ? rest : [...rest, { key: DPOP_HEADER, value: proof }];
}

async function proofFor(dpop: OAuth2DpopProofMaterial, hop: HopState, nonce: string | undefined): Promise<string> {
  return mintDpopProof(dpop.key, { method: hop.method, url: hop.url, accessToken: dpop.accessToken, nonce });
}

/**
 * The hop with its proof for the wire: a fresh `DPoP` header when the
 * request proves possession and the hop still carries its
 * Authorization; the hop untouched when the request does not prove;
 * the proof dropped when a redirect stripped the Authorization.
 */
export async function withDpopProof(request: TransportRequest, hop: HopState): Promise<HopState> {
  if (request.dpop === undefined) return hop;
  if (!hasAuthorization(hop.headers)) return { ...hop, headers: withDpopHeader(hop.headers, null) };
  const proof = await proofFor(request.dpop, hop, dpopNonceFor(hop.url));
  return { ...hop, headers: withDpopHeader(hop.headers, proof) };
}

/**
 * The nonce exchange for one hop: remember the nonce the response
 * issued, and when the response is the resource's `use_dpop_nonce`
 * challenge, cancel its body and resend THAT hop once with a proof
 * carrying the nonce (fresh jar contribution included). Returns the
 * resent hop + its response, or `null` when no retry applies — the
 * caller continues from the returned hop, so a second challenge flows
 * on as a normal response.
 */
export async function dpopRetryHop(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  response: HopResponse,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  jar: CookieJar | undefined,
  leg: WireLeg | null,
): Promise<{ hop: HopState; response: HopResponse; jarAttached?: string; jarCaptured: string[] } | null> {
  if (request.dpop === undefined) return null;
  const issued = dpopNonceOf(headerPairs(response));
  rememberDpopNonce(hop.url, issued);
  if (issued === undefined || !hasAuthorization(hop.headers)) return null;
  if (!isDpopNonceChallengeFromResource(response.status, response.headers.get('www-authenticate'))) return null;
  await response.body?.cancel();
  const provenHop: HopState = {
    ...hop,
    headers: withDpopHeader(hop.headers, await proofFor(request.dpop, hop, issued)),
  };
  let sendHop = provenHop;
  let jarAttached: string | undefined;
  if (jar !== undefined) {
    const { headers, attached } = withJarCookie(jar, provenHop);
    sendHop = { ...provenHop, headers };
    jarAttached = attached;
  }
  const retryResponse = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher, leg);
  rememberDpopNonce(hop.url, dpopNonceOf(headerPairs(retryResponse)));
  const jarCaptured = jar !== undefined ? captureJarCookies(jar, provenHop.url, retryResponse.headers) : [];
  return {
    hop: provenHop,
    response: retryResponse,
    ...(jarAttached !== undefined ? { jarAttached } : {}),
    jarCaptured,
  };
}

function headerPairs(response: HopResponse): TransportHeader[] {
  const out: TransportHeader[] = [];
  for (const [key, value] of response.headers) out.push({ key, value });
  return out;
}
