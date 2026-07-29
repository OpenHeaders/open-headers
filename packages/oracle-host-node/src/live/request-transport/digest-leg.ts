/**
 * HTTP digest second leg — a hop answering 401 with an answerable
 * `Digest` challenge (RFC 7616 / 2617) gets ONE authorized resend when
 * the request carries `digestAuth` credentials, computed per hop over
 * that hop's method + target, riding the same wire pipeline, deadline,
 * and jar as the challenged hop.
 */

import { createHash, randomBytes } from 'node:crypto';
import {
  buildDigestAuthorization,
  DigestError,
  type DigestHashFn,
  parseDigestChallenges,
  selectDigestChallenge,
} from '@openheaders/core/auth-signing';
import {
  type TransportBody,
  TransportError,
  type TransportHeader,
  type TransportRequest,
} from '@openheaders/oracle/live/request-exec/transport';
import type { Dispatcher } from 'undici';
import type { CookieJar } from '../cookie-jar';
import { captureJarCookies, withJarCookie } from './jar-leg';
import type { Deadline, H2Leg, HopResponse, HopState, NodeFetchFn, NodeRequestFn } from './seam';
import { wireHop } from './wire-hops';

/** MD5 availability, probed once — `node:crypto` refuses the algorithm
 *  under FIPS policy, in which case MD5(-sess) challenges read as
 *  unsupported and only the SHA-256 family is answerable. */
let md5Supported: boolean | undefined;
function md5HashFn(): DigestHashFn | undefined {
  if (md5Supported === undefined) {
    try {
      createHash('md5');
      md5Supported = true;
    } catch {
      md5Supported = false;
    }
  }
  if (!md5Supported) return undefined;
  return (text) => createHash('md5').update(text, 'utf8').digest('hex');
}

/**
 * Wire body text for `qop=auth-int` — only bodies whose bytes are
 * deterministic ahead of dispatch (the same discipline as SigV4's
 * payload hash). Multipart returns `undefined`: the runtime picks the
 * boundary, so the entity bytes are unknowable and an auth-int-only
 * challenge fails with a clear error instead of a wrong hash.
 */
function digestBodyText(body: TransportBody): string | undefined {
  switch (body.kind) {
    case 'none':
      return '';
    case 'raw':
      return body.content;
    case 'urlencoded': {
      const params = new URLSearchParams();
      for (const f of body.fields) params.append(f.name, f.value);
      return params.toString();
    }
    case 'multipart':
      return undefined;
    default: {
      const _exhaustive: never = body;
      void _exhaustive;
      return undefined;
    }
  }
}

/**
 * Compute the `Authorization` answer to a 401's `Digest` challenges for
 * THIS hop, or `null` when the response carries nothing answerable (no
 * challenge, unsupported algorithms) — the 401 then surfaces verbatim.
 * An answerable-but-unsatisfiable challenge (auth-int-only against a
 * multipart body, MD5-only under FIPS) throws a {@link TransportError}
 * naming the reason.
 */
async function digestAuthorizationFor(
  digestAuth: { username: string; password: string },
  hop: HopState,
  response: HopResponse,
): Promise<string | null> {
  const headerValue = response.headers.get('www-authenticate');
  if (headerValue === null) return null;
  const md5 = md5HashFn();
  const challenge = selectDigestChallenge(parseDigestChallenges(headerValue), { md5Available: md5 !== undefined });
  if (challenge === null) return null;
  const url = new URL(hop.url);
  const body = digestBodyText(hop.body);
  try {
    return await buildDigestAuthorization(
      digestAuth,
      challenge,
      {
        method: hop.method,
        uri: `${url.pathname}${url.search}`,
        cnonce: randomBytes(16).toString('hex'),
        nonceCount: 1,
        ...(body !== undefined ? { body } : {}),
      },
      md5,
    );
  } catch (err) {
    if (err instanceof DigestError) {
      throw new TransportError(`Digest authentication with ${url.hostname} failed: ${err.message}`);
    }
    throw err;
  }
}

/** `hop.headers` with the digest `Authorization` set replace-not-append
 *  — a stale user-set value would combine into garbage on the wire. */
function withDigestAuthorization(headers: ReadonlyArray<TransportHeader>, value: string): TransportHeader[] {
  return [...headers.filter((h) => h.key.toLowerCase() !== 'authorization'), { key: 'Authorization', value }];
}

/**
 * The digest exchange for one hop: when the hop's response is a 401
 * with an answerable `Digest` challenge and the request carries digest
 * credentials, cancel the challenge body and resend THAT hop once with
 * the computed `Authorization` (fresh jar contribution included — the
 * challenge response may have set a session cookie). Returns the
 * authorized hop + its response, or `null` when no retry applies. The
 * caller continues from the returned hop, so a 401 on the authorized
 * resend is final by construction — it flows on as a normal response.
 */
export async function digestRetryHop(
  fetchFn: NodeFetchFn,
  requestFn: NodeRequestFn,
  request: TransportRequest,
  hop: HopState,
  response: HopResponse,
  deadline: Deadline,
  dispatcher: Dispatcher | undefined,
  jar: CookieJar | undefined,
  h2: H2Leg | null,
): Promise<{ hop: HopState; response: HopResponse; jarAttached?: string; jarCaptured: string[] } | null> {
  if (request.digestAuth === undefined || response.status !== 401) return null;
  const authorization = await digestAuthorizationFor(request.digestAuth, hop, response);
  if (authorization === null) return null;
  await response.body?.cancel();
  const authorizedHop: HopState = { ...hop, headers: withDigestAuthorization(hop.headers, authorization) };
  let sendHop = authorizedHop;
  let jarAttached: string | undefined;
  if (jar !== undefined) {
    const { headers, attached } = withJarCookie(jar, authorizedHop);
    sendHop = { ...authorizedHop, headers };
    jarAttached = attached;
  }
  const retryResponse = await wireHop(fetchFn, requestFn, request, sendHop, deadline, dispatcher, h2);
  const jarCaptured = jar !== undefined ? captureJarCookies(jar, authorizedHop.url, retryResponse.headers) : [];
  return {
    hop: authorizedHop,
    response: retryResponse,
    ...(jarAttached !== undefined ? { jarAttached } : {}),
    jarCaptured,
  };
}
