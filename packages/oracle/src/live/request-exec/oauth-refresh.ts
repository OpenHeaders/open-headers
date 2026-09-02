/**
 * OAuth 2.0 refresh runner — the host-neutral refresh_token leg of the
 * token lifecycle: rebuild the refresh POST from the request's oauth2
 * config, exchange it at the (refresh-or-token) endpoint, and persist
 * the fresh bundle through the token store. Node hosts inject
 * {@link buildRefreshOAuthHook} as the executor's `refreshOAuth` seam;
 * the extension keeps its own runner (its refresh rides the browser's
 * host-permission fetch wrapper) with identical semantics.
 *
 * A grant that never gets a refresh token still expires: client
 * credentials, password (when the provider issued none) and the JWT
 * bearer grant re-acquire by re-running their flow — no user agent is
 * involved, so the executor may do it silently on send
 * ({@link refreshCredential}, the flow-agnostic entry the hook calls).
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
import {
  boundDpopKeyOf,
  buildClientAuthHeader,
  buildRefreshTokenBody,
  nonBodyExtraParams,
} from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { getTokenBundle, putTokenBundle } from '../../entity/oauth-token-store';
import { exchangeForTokens, OAuth2FlowError } from './oauth-exchange';
import {
  dpopKeyForExchange,
  mintClientAssertionOrFail,
  performClientCredentialsFlow,
  performJwtBearerFlow,
  performPasswordCredentialsFlow,
} from './oauth-flows';
import type { OAuthRefreshFn } from './resolve-request';
import type { RequestTransport } from './transport';

/** A recoverable refresh failure — the token endpoint refused or
 *  answered garbage. The hook maps it to "attach the stale bundle". */
export class OAuth2RefreshError extends OAuth2FlowError {
  constructor(message: string) {
    super('refresh', message);
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
  const body = buildRefreshTokenBody({
    config,
    refreshToken: current.refreshToken,
    clientAssertion: await mintClientAssertionOrFail(config, 'refresh'),
  });
  // Some providers (notably legacy Okta tenants) expose a separate
  // refresh endpoint; fall back to the primary token endpoint when the
  // config doesn't override.
  const endpoint = config.refreshEndpoint?.trim() ? config.refreshEndpoint : config.tokenEndpoint;
  // RFC 9449 §5 binds the refresh token to the key the exchange used —
  // the refresh proves possession with the SAME key. A bearer bundle
  // under a config that turned the binding on binds from here on.
  const dpopKey = boundDpopKeyOf(current) ?? (await dpopKeyForExchange(config, 'refresh'));
  const bundle = await exchangeForTokens(transport, {
    endpoint,
    body,
    step: 'refresh',
    clientAuthHeader: buildClientAuthHeader(config),
    extras: nonBodyExtraParams(config.extraRefreshParams),
    dpopKey,
  });
  if (!bundle.refreshToken && current.refreshToken) {
    bundle.refreshToken = current.refreshToken;
  }
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

/**
 * Renew a credential regardless of flow: the refresh_token grant when
 * the store holds one, else the flow's own re-run for the user-agent-
 * free grants (client credentials, password, JWT bearer). The
 * extension's scheduler runs the same dispatch under the same name.
 */
export async function refreshCredential(
  config: OAuth2Auth,
  workspaceId: string | undefined,
  transport: RequestTransport,
): Promise<OAuth2TokenBundle> {
  const current = await getTokenBundle(config.credentialRef, workspaceId);
  if (current?.refreshToken) return performRefresh(config, workspaceId, transport);
  switch (config.flow) {
    case 'client-credentials':
      return performClientCredentialsFlow(config, workspaceId, transport);
    case 'password-credentials':
      return performPasswordCredentialsFlow(config, workspaceId, transport);
    case 'jwt-bearer':
      return performJwtBearerFlow(config, workspaceId, transport);
    default:
      return performRefresh(config, workspaceId, transport);
  }
}

/**
 * The executor injection: an {@link OAuthRefreshFn} bound to the run's
 * workspace pin. Recoverable exchange failures log + return `null` (the
 * seam attaches the stale bundle); unexpected errors propagate.
 */
export function buildRefreshOAuthHook(workspaceId: string | undefined, transport: RequestTransport): OAuthRefreshFn {
  return async (auth) => {
    try {
      return await refreshCredential(auth, workspaceId, transport);
    } catch (err) {
      if (err instanceof OAuth2FlowError) {
        logger.info('RequestExecutor', `OAuth refresh failed for ${auth.credentialRef}: ${err.message}`);
        return null;
      }
      throw err;
    }
  };
}
