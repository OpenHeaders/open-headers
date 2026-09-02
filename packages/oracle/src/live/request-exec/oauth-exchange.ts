/**
 * OAuth 2.0 token-endpoint exchange — the one POST every grant ends
 * in (authorization_code, client_credentials, password,
 * refresh_token), host-neutral: the body / client-auth header / extra
 * params come from `@openheaders/core/oauth`, the POST rides the host's
 * injected {@link RequestTransport} — the same seam every request-engine
 * send dispatches through, so the node hosts' proxy resolution and
 * trust store cover the token leg too — and the per-origin token
 * bucket is the same `withRefreshRateLimit` every refresh-subsystem
 * fetch pays into.
 *
 * A refused or malformed exchange is an {@link OAuth2FlowError} naming
 * the step; transport failures propagate as they are.
 */

import type { OAuth2DpopKey, OAuth2TokenBundle } from '@openheaders/core/oauth';
import {
  DPOP_HEADER,
  dpopNonceOf,
  isDpopNonceChallengeFromTokenEndpoint,
  mintDpopProof,
  type nonBodyExtraParams,
  parseTokenResponse,
} from '@openheaders/core/oauth';
import { appendQueryParams, logger } from '@openheaders/core/utils';
import { dpopNonceFor, rememberDpopNonce } from './dpop-nonces';
import { withRefreshRateLimit } from './rate-limiter';
import type { RequestTransport, TransportHeader, TransportResponse } from './transport';

/** Same streamed-read cap the request executor rides — a token
 *  response never nears it; the cap bounds a hostile endpoint. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** A recoverable OAuth step failure — the provider refused, answered
 *  garbage, or the flow's own precondition failed. `step` names the
 *  leg (`authorize` / `authorization_code` / `client_credentials` /
 *  `password` / `refresh` / `precondition`). */
export class OAuth2FlowError extends Error {
  readonly step: string;
  constructor(step: string, message: string) {
    super(message);
    this.name = 'OAuth2FlowError';
    this.step = step;
  }
}

export interface TokenExchangeInput {
  endpoint: string;
  body: URLSearchParams;
  /** Names the leg in the error the exchange raises. */
  step: string;
  clientAuthHeader: string | null;
  extras?: ReturnType<typeof nonBodyExtraParams>;
  /**
   * The DPoP key to bind the token to (RFC 9449 §5): the POST carries
   * a proof under it, a `use_dpop_nonce` answer is retried ONCE with
   * the issued nonce (inside the same bucket payment), and a token the
   * provider issues as `DPoP` comes back with the key on the bundle. A
   * provider that answers a plain bearer token ignored the binding —
   * the bundle stays plain and the send stays a bearer send.
   */
  dpopKey?: OAuth2DpopKey;
}

export async function exchangeForTokens(
  transport: RequestTransport,
  input: TokenExchangeInput,
): Promise<OAuth2TokenBundle> {
  const { endpoint, body, step, clientAuthHeader, extras, dpopKey } = input;
  // Accept JSON explicitly — some providers answer urlencoded otherwise.
  const headers: TransportHeader[] = [{ key: 'Accept', value: 'application/json' }];
  // Header-routed extra params ride the POST; the explicit client-auth
  // header wins over a same-key row.
  for (const h of extras?.headers ?? []) headers.push({ key: h.key, value: h.value });
  if (clientAuthHeader) headers.push({ key: 'Authorization', value: clientAuthHeader });
  // URL-routed extra params append to the endpoint's query string.
  const url = extras !== undefined && extras.query.length > 0 ? appendQueryParams(endpoint, extras.query) : endpoint;
  const send = async (nonce: string | undefined): Promise<TransportResponse> =>
    transport.send({
      method: 'POST',
      url,
      headers:
        dpopKey !== undefined
          ? [...headers, { key: DPOP_HEADER, value: await tokenProof(dpopKey, url, nonce) }]
          : headers,
      body: { kind: 'urlencoded', fields: [...body.entries()].map(([name, value]) => ({ name, value })) },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: MAX_BODY_BYTES,
    });
  const response = await withRefreshRateLimit(endpoint, () =>
    dpopKey === undefined ? send(undefined) : sendWithDpopNonceRetry(url, send),
  );
  const text = response.body;
  if (response.status < 200 || response.status >= 300) {
    throw new OAuth2FlowError(
      step,
      `Token endpoint returned ${response.status} ${response.statusText}: ${truncate(text, 200)}`,
    );
  }
  const json = safeJsonParse(text);
  if (!json) {
    throw new OAuth2FlowError(step, `Token endpoint returned non-JSON body: ${truncate(text, 200)}`);
  }
  let bundle: OAuth2TokenBundle;
  try {
    bundle = parseTokenResponse(json);
  } catch (err) {
    throw new OAuth2FlowError(step, `Failed to parse token response: ${(err as Error).message}`);
  }
  if (dpopKey !== undefined) bindDpopKey(bundle, dpopKey, step);
  return bundle;
}

/**
 * Attach the key the POST proved possession of to the bundle it
 * produced — when the provider issued the token as `DPoP`. A plain
 * bearer answer means the provider ignored the binding (§5 allows it);
 * the bundle stays plain and the token sends as a bearer.
 */
export function bindDpopKey(bundle: OAuth2TokenBundle, dpopKey: OAuth2DpopKey, step: string): void {
  if (bundle.tokenType.toLowerCase() === 'dpop') {
    bundle.dpop = dpopKey;
    return;
  }
  logger.info(
    'OAuthExchange',
    `${step}: the provider issued a ${bundle.tokenType} token, not DPoP — sending it as one`,
  );
}

/** The proof a token POST carries (§5) — no `ath`, the endpoint's nonce when one was issued. */
function tokenProof(key: OAuth2DpopKey, url: string, nonce: string | undefined): Promise<string> {
  return mintDpopProof(key, { method: 'POST', url, nonce });
}

/**
 * One token POST under DPoP: the first attempt carries the origin's
 * cached nonce (if any); a 400 `use_dpop_nonce` answer with a fresh
 * `DPoP-Nonce` is repeated ONCE with it. Every response's nonce feeds
 * the cache (§8: the server may rotate on any answer). Shared by the
 * exchange and the device poll.
 */
export async function sendWithDpopNonceRetry(
  url: string,
  send: (nonce: string | undefined) => Promise<TransportResponse>,
): Promise<TransportResponse> {
  const first = await send(dpopNonceFor(url));
  const issued = dpopNonceOf(first.headers);
  rememberDpopNonce(url, issued);
  if (issued === undefined || !isDpopNonceChallengeFromTokenEndpoint(first.status, safeJsonParse(first.body))) {
    return first;
  }
  const second = await send(issued);
  rememberDpopNonce(url, dpopNonceOf(second.headers));
  return second;
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(s);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}
