/**
 * Auth injection — folds the request's `AuthConfig` into the resolved
 * headers / structured params (basic, bearer, api-key, oauth2 with
 * silent refresh-on-expiry).
 */

import { isExpired as isOAuthTokenExpired } from '@openheaders/core/oauth';
import type { AuthConfig } from '@openheaders/core/types';
import { getTokenBundle as getOAuthTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { logger } from '@utils/logger';
import { OAuth2FlowError, performRefresh as performOAuthRefresh } from '../oauth-flow';

export async function applyAuth(
  auth: AuthConfig,
  headers: Array<{ key: string; value: string }>,
  params: Array<{ key: string; value: string }>,
  resolveStr: (s: string) => string,
): Promise<void> {
  // `disabled` suspends the contribution without discarding the config
  // (the Headers table's auth-row checkbox drives it) — twin of the
  // oracle resolver's check.
  if (auth.disabled || auth.type === 'none' || auth.type === 'inherit') return;
  if (auth.type === 'basic') {
    const u = resolveStr(auth.username);
    const p = resolveStr(auth.password);
    // RFC 7617 mandates UTF-8. `btoa` throws on non-ASCII, so we
    // encode the credential pair as UTF-8 bytes first, then base64 the
    // byte string. Without this, a password like `pässwörd` crashes
    // the executor with `InvalidCharacterError` before fetch is even
    // called.
    const bytes = new TextEncoder().encode(`${u}:${p}`);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const token = btoa(binary);
    headers.push({ key: 'Authorization', value: `Basic ${token}` });
    return;
  }
  if (auth.type === 'bearer') {
    headers.push({ key: 'Authorization', value: `Bearer ${resolveStr(auth.token)}` });
    return;
  }
  if (auth.type === 'api-key') {
    const k = resolveStr(auth.key);
    const v = resolveStr(auth.value);
    if (auth.in === 'header') headers.push({ key: k, value: v });
    else params.push({ key: k, value: v });
    return;
  }
  if (auth.type === 'oauth2') {
    // OAuth2 access tokens live in the SW's per-workspace token
    // store (ARCHITECTURE §18). We fetch the bundle, refresh if
    // expired + a refresh token is available, then attach the
    // `Authorization: Bearer <access_token>` header.
    //
    // Silent failures on the send path are the right default here:
    // a missing/expired token surfaces in the response panel as a
    // 401 from the target API, which is more actionable for the
    // user than an extension-generated error. The Status pill +
    // observability log capture the detail either way.
    let bundle = await getOAuthTokenBundle(auth.credentialRef);
    if (bundle && isOAuthTokenExpired(bundle) && bundle.refreshToken) {
      try {
        bundle = await performOAuthRefresh(auth);
      } catch (err) {
        if (err instanceof OAuth2FlowError) {
          logger.info('RequestExecutor', `OAuth refresh failed for ${auth.credentialRef}: ${err.message}`);
        } else {
          throw err;
        }
      }
    }
    if (bundle) {
      if (auth.sendAs === 'query') {
        // Legacy URI Query Parameter method (RFC 6750 §2.3) — the UI
        // warns the user this is deprecated; we still honor it for
        // providers that require it.
        params.push({ key: 'access_token', value: bundle.accessToken });
      } else {
        headers.push({ key: 'Authorization', value: `${bundle.tokenType} ${bundle.accessToken}` });
      }
    }
  }
}
