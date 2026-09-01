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

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import { type nonBodyExtraParams, parseTokenResponse } from '@openheaders/core/oauth';
import { appendQueryParams } from '@openheaders/core/utils';
import { withRefreshRateLimit } from './rate-limiter';
import type { RequestTransport, TransportHeader } from './transport';

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
}

export async function exchangeForTokens(
  transport: RequestTransport,
  input: TokenExchangeInput,
): Promise<OAuth2TokenBundle> {
  const { endpoint, body, step, clientAuthHeader, extras } = input;
  // Accept JSON explicitly — some providers answer urlencoded otherwise.
  const headers: TransportHeader[] = [{ key: 'Accept', value: 'application/json' }];
  // Header-routed extra params ride the POST; the explicit client-auth
  // header wins over a same-key row.
  for (const h of extras?.headers ?? []) headers.push({ key: h.key, value: h.value });
  if (clientAuthHeader) headers.push({ key: 'Authorization', value: clientAuthHeader });
  // URL-routed extra params append to the endpoint's query string.
  const url = extras !== undefined && extras.query.length > 0 ? appendQueryParams(endpoint, extras.query) : endpoint;
  const response = await withRefreshRateLimit(endpoint, () =>
    transport.send({
      method: 'POST',
      url,
      headers,
      body: { kind: 'urlencoded', fields: [...body.entries()].map(([name, value]) => ({ name, value })) },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: MAX_BODY_BYTES,
    }),
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
  try {
    return parseTokenResponse(json);
  } catch (err) {
    throw new OAuth2FlowError(step, `Failed to parse token response: ${(err as Error).message}`);
  }
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
