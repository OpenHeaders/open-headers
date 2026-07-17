/**
 * SSO (OIDC) login support for the web tab (Phase 5 slice 3).
 *
 * The heavy lifting lives daemon-side (`/auth/oidc/*`): the gate's SSO
 * button is a plain top-level navigation to `/auth/oidc/start`, the IdP
 * round-trip ends in a redirect back to `/#oidc=<claim-code>` (or
 * `/#oidc-error=<reason>`), and this module is the SPA's side of that
 * contract — probe whether SSO is configured, pull the one-shot result
 * out of the URL fragment before anything else reads it, and swap the
 * claim code for the session token. The token then rides the exact
 * pasted-token path: candidate in memory, real HELLO, persist only on
 * WELCOME accept.
 */

import { hostLogger as logger } from '@openheaders/core/logger';
import type { MessageKey } from '@openheaders/i18n';

const SCOPE = 'OidcLogin';

const META_PATH = '/auth/oidc/meta';
const CLAIM_PATH = '/auth/oidc/claim';
const CLAIM_HASH_PREFIX = '#oidc=';
const ERROR_HASH_PREFIX = '#oidc-error=';
const META_PROBE_TIMEOUT_MS = 1500;

export interface OidcMeta {
  readonly enabled: boolean;
  readonly provider?: string;
}

/**
 * Is SSO configured on the serving daemon? A daemon without OIDC has no
 * `/auth/oidc/*` routes, so the SPA fallback answers this path with the
 * app HTML — only a JSON `{ enabled: true }` counts.
 */
export async function fetchOidcMeta(): Promise<OidcMeta> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), META_PROBE_TIMEOUT_MS);
    const response = await fetch(META_PATH, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) {
      return { enabled: false };
    }
    const payload = (await response.json()) as { enabled?: unknown; provider?: unknown };
    return {
      enabled: payload.enabled === true,
      ...(typeof payload.provider === 'string' ? { provider: payload.provider } : {}),
    };
  } catch {
    return { enabled: false };
  }
}

export type OidcHashResult = { kind: 'claim'; code: string } | { kind: 'error'; reason: string };

/**
 * Pull the callback's one-shot result out of `location.hash` and strip
 * it from the URL (and browser history) immediately — the claim code is
 * single-use, and a reload must not retry a spent one.
 */
export function consumeOidcHash(
  location: Pick<Location, 'hash'> = window.location,
  replaceUrl: (url: string) => void = (url) => window.history.replaceState(null, '', url),
): OidcHashResult | null {
  const hash = location.hash;
  if (hash.startsWith(CLAIM_HASH_PREFIX)) {
    const code = decodeURIComponent(hash.slice(CLAIM_HASH_PREFIX.length));
    replaceUrl('/');
    return code ? { kind: 'claim', code } : { kind: 'error', reason: 'state-mismatch' };
  }
  if (hash.startsWith(ERROR_HASH_PREFIX)) {
    const reason = decodeURIComponent(hash.slice(ERROR_HASH_PREFIX.length));
    replaceUrl('/');
    return { kind: 'error', reason: reason || 'unknown' };
  }
  return null;
}

/** Swap the one-shot claim code for the session token. Null = spent/expired/offline. */
export async function claimOidcToken(code: string): Promise<string | null> {
  try {
    const response = await fetch(CLAIM_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: unknown; secret?: unknown };
    return payload.ok === true && typeof payload.secret === 'string' ? payload.secret : null;
  } catch (err) {
    logger.warn(SCOPE, 'claim failed', err);
    return null;
  }
}

/** Message key for the gate's error line when an SSO attempt failed. */
export function oidcErrorKey(reason: string): MessageKey {
  switch (reason) {
    case 'unknown-user':
      return 'web.oidcError.unknownUser';
    case 'user-deactivated':
      return 'web.oidcError.userDeactivated';
    case 'email-unverified':
      return 'web.oidcError.emailUnverified';
    case 'provider-unavailable':
      return 'web.oidcError.providerUnavailable';
    case 'seat-limit-reached':
      return 'web.oidcError.seatLimitReached';
    case 'personal-seats-disabled':
      return 'web.oidcError.personalSeatsDisabled';
    case 'personal-license-invalid':
      return 'web.oidcError.personalLicenseInvalid';
    case 'personal-license-identity-mismatch':
      return 'web.oidcError.personalLicenseIdentityMismatch';
    case 'personal-license-no-identity':
      return 'web.oidcError.personalLicenseNoIdentity';
    default:
      return 'web.oidcError.failed';
  }
}

/** The refusal reasons where offering the personal-seat redeem path makes sense. */
export function isSeatRefusalReason(reason: string | null | undefined): boolean {
  return (
    reason === 'seat-limit-reached' ||
    reason === 'personal-license-invalid' ||
    reason === 'personal-license-identity-mismatch'
  );
}

/**
 * Kick off the SSO round-trip — a full-page navigation, by design. A
 * personal-seat key pasted at the seat-limit refusal rides along and
 * is redeemed at auto-provision (it is not a bearer secret — it only
 * admits the identity it names).
 */
export function startOidcLogin(
  navigate: (url: string) => void = (url) => window.location.assign(url),
  options?: { personalLicense?: string },
): void {
  const key = options?.personalLicense?.trim();
  navigate(key ? `/auth/oidc/start?individual_license=${encodeURIComponent(key)}` : '/auth/oidc/start');
}
