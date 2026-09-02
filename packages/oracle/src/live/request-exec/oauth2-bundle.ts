/**
 * OAuth 2.0 bundle acquisition for a send — the ONE read every
 * executor shares: the per-workspace token store's bundle under the
 * config's `credentialRef`, renewed silently when it is expired,
 * renewable without a user agent (a refresh token, or a grant that
 * re-runs from the config) and the host injected a refresh hook. The
 * hook owns its failure semantics: `null` means a recoverable refresh
 * failure (the stale bundle attaches so the target's 401 is the
 * actionable signal); a throw is an unexpected error the caller
 * surfaces. No bundle at all attaches nothing — the target's 401 is
 * the signal there too (the HTTP send's law since the first OAuth
 * slice).
 *
 * The HTTP resolver folds the bundle into `Authorization` (or the
 * `access_token` query param) and hands a DPoP-bound bundle to the
 * transport for the per-hop proof; the session executors compose the
 * same header value at connect / invoke time — a DPoP binding never
 * reaches them (the per-kind mask refuses it by name).
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import { canRenewSilently, isExpired as isOAuthTokenExpired } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { getTokenBundle } from '../../entity/oauth-token-store';

/** Refresh an expired OAuth credential, returning a fresh bundle (or
 *  null when refresh is unavailable). Injected per host. */
export type OAuthRefreshFn = (auth: OAuth2Auth) => Promise<OAuth2TokenBundle | null>;

export interface OAuth2BundleOptions {
  /** The workspace whose token store holds the bundle; absent = the
   *  runtime-Active one. */
  workspaceId?: string;
  /** Host hook to refresh an expired token before attaching it. */
  refreshOAuth?: OAuthRefreshFn;
}

export async function acquireOAuth2Bundle(
  auth: OAuth2Auth,
  options: OAuth2BundleOptions,
): Promise<OAuth2TokenBundle | null> {
  let bundle = await getTokenBundle(auth.credentialRef, options.workspaceId);
  if (
    bundle &&
    isOAuthTokenExpired(bundle) &&
    canRenewSilently(auth, Boolean(bundle.refreshToken)) &&
    options.refreshOAuth
  ) {
    bundle = (await options.refreshOAuth(auth)) ?? bundle;
  }
  return bundle;
}

/** The `Authorization` value a bearer-shaped bundle rides as: a set
 *  Header Prefix wins over the bundle's `token_type` — the user's fix
 *  for providers that issue a broken or vendor value. */
export function oauth2AuthorizationValue(auth: OAuth2Auth, bundle: OAuth2TokenBundle): string {
  const prefix = auth.headerPrefix?.trim() ? auth.headerPrefix.trim() : bundle.tokenType;
  return `${prefix} ${bundle.accessToken}`;
}
