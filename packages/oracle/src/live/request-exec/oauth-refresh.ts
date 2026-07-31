/**
 * OAuth 2.0 refresh runner — the host-neutral refresh_token leg of the
 * token lifecycle: rebuild the refresh POST from the request's oauth2
 * config, exchange it at the (refresh-or-token) endpoint, and persist
 * the fresh bundle through the token store. Node hosts inject
 * {@link buildRefreshOAuthHook} as the executor's `refreshOAuth` seam;
 * the extension keeps its own runner (its refresh rides the browser's
 * host-permission fetch wrapper) with identical semantics.
 *
 * Everything here is platform-agnostic: the POST body / client-auth
 * header / response parsing come from `@openheaders/core/oauth`, the
 * exchange rides the host's injected {@link RequestTransport} — the
 * same seam every request-engine send dispatches through, so the
 * node hosts' system-plane proxy resolution covers the token
 * leg too — and the per-origin token bucket is the same
 * `withRefreshRateLimit` every refresh-subsystem fetch pays into.
 *
 * Failure semantics (the executor contract): a recoverable exchange
 * failure ({@link OAuth2RefreshError}) maps to `null` in the hook — the
 * stale bundle attaches and the target's 401 is the actionable signal;
 * anything else (transport failures, store faults, programmer errors)
 * propagates as a fetch-phase failure.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import { buildClientAuthHeader, buildRefreshTokenBody, parseTokenResponse } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { getTokenBundle, putTokenBundle } from '../../entity/oauth-token-store';
import { withRefreshRateLimit } from './rate-limiter';
import type { OAuthRefreshFn } from './resolve-request';
import type { RequestTransport, TransportHeader } from './transport';

/** Same streamed-read cap the request executor rides — a token
 *  response never nears it; the cap bounds a hostile endpoint. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/** A recoverable refresh failure — the token endpoint refused or
 *  answered garbage. The hook maps it to "attach the stale bundle". */
export class OAuth2RefreshError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OAuth2RefreshError';
  }
}

/**
 * Run one refresh_token exchange for `config` and persist the resulting
 * bundle under `config.credentialRef`. Providers sometimes omit
 * `refresh_token` on refresh — the prior one is carried forward so the
 * next refresh still works.
 */
export async function performRefresh(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
): Promise<OAuth2TokenBundle> {
  const current = await getTokenBundle(config.credentialRef, workspaceId);
  if (!current?.refreshToken) {
    throw new OAuth2RefreshError('No refresh_token available for this credential');
  }
  const body = buildRefreshTokenBody({ config, refreshToken: current.refreshToken });
  // Some providers (notably legacy Okta tenants) expose a separate
  // refresh endpoint; fall back to the primary token endpoint when the
  // config doesn't override.
  const endpoint = config.refreshEndpoint?.trim() ? config.refreshEndpoint : config.tokenEndpoint;
  const bundle = await exchangeRefreshToken(transport, endpoint, body, buildClientAuthHeader(config));
  if (!bundle.refreshToken && current.refreshToken) {
    bundle.refreshToken = current.refreshToken;
  }
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

/**
 * The executor injection: an {@link OAuthRefreshFn} bound to the run's
 * workspace pin. Recoverable exchange failures log + return `null` (the
 * seam attaches the stale bundle); unexpected errors propagate.
 */
export function buildRefreshOAuthHook(workspaceId: string | undefined, transport: RequestTransport): OAuthRefreshFn {
  return async (auth) => {
    try {
      return await performRefresh(auth, workspaceId, transport);
    } catch (err) {
      if (err instanceof OAuth2RefreshError) {
        logger.info('RequestExecutor', `OAuth refresh failed for ${auth.credentialRef}: ${err.message}`);
        return null;
      }
      throw err;
    }
  };
}

async function exchangeRefreshToken(
  transport: RequestTransport,
  endpoint: string,
  body: URLSearchParams,
  clientAuthHeader: string | null,
): Promise<OAuth2TokenBundle> {
  // Accept JSON explicitly — GitHub returns urlencoded otherwise. The
  // urlencoded body kind sets the Content-Type on the wire.
  const headers: TransportHeader[] = [{ key: 'Accept', value: 'application/json' }];
  if (clientAuthHeader) headers.push({ key: 'Authorization', value: clientAuthHeader });
  // Per-origin token bucket shared with chain-step fetches — a provider
  // handling both OAuth token endpoints AND a token-reading workflow
  // pays a single budget across both paths.
  const response = await withRefreshRateLimit(endpoint, () =>
    transport.send({
      method: 'POST',
      url: endpoint,
      headers,
      body: { kind: 'urlencoded', fields: [...body.entries()].map(([name, value]) => ({ name, value })) },
      redirect: 'follow',
      credentials: 'omit',
      maxBodyBytes: MAX_BODY_BYTES,
    }),
  );
  const text = response.body;
  if (response.status < 200 || response.status >= 300) {
    throw new OAuth2RefreshError(
      `Token endpoint returned ${response.status} ${response.statusText}: ${truncate(text, 200)}`,
    );
  }
  const json = safeJsonParse(text);
  if (!json) {
    throw new OAuth2RefreshError(`Token endpoint returned non-JSON body: ${truncate(text, 200)}`);
  }
  try {
    return parseTokenResponse(json);
  } catch (err) {
    throw new OAuth2RefreshError(`Failed to parse token response: ${(err as Error).message}`);
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
