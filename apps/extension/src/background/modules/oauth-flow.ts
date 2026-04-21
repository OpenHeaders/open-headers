/**
 * OAuth 2.0 flow runner — SW-side orchestration that kicks off the
 * user-visible authorization flow, exchanges the code at the token
 * endpoint, and persists the result through `oauth-token-store.ts`.
 *
 * Split from the token store so the runner is testable in isolation:
 *   • the token store owns `chrome.storage.local` + `withLock`;
 *   • the runner owns `chrome.identity.launchWebAuthFlow` + `fetch`.
 *
 * Three flows implemented:
 *   • Authorization Code + PKCE (`launchAuthorizationCodeFlow`)
 *   • Client Credentials          (`performClientCredentialsFlow`)
 *   • Refresh Token               (`performRefresh`)
 *
 * Device Code lands next — it needs a user-facing polling UI which
 * is tracked separately.
 */

import {
  buildAuthorizationCodeTokenBody,
  buildAuthorizationUrl,
  buildClientAuthHeader,
  buildClientCredentialsTokenBody,
  buildRefreshTokenBody,
  computeCodeChallenge,
  findOAuth2Preset,
  generateCodeVerifier,
  type OAuth2TokenBundle,
  parseTokenResponse,
} from '@openheaders/core/oauth';
import type { V5 } from '@openheaders/core/types';

type OAuth2Auth = V5.OAuth2Auth;

import { identity } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { withHostAccess } from '@/shared/fetch/with-host-access';
import { getTokenBundle, putTokenBundle } from './oauth-token-store';
import { withRefreshRateLimit } from './refresh-scheduler';

export class OAuth2FlowError extends Error {
  readonly step: string;
  constructor(step: string, message: string) {
    super(message);
    this.name = 'OAuth2FlowError';
    this.step = step;
  }
}

// ── Runtime helpers ───────────────────────────────────────────────

const RANDOM_SOURCE = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
};

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  // Copy into a dedicated ArrayBuffer so the WebCrypto type guard is
  // happy (Uint8Array<ArrayBufferLike> isn't assignable to ArrayBuffer
  // under strict DOM typings).
  const buf = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buf).set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

/**
 * Return the canonical redirect URI chrome will intercept. The
 * trailing slash matters — Chrome's launchWebAuthFlow redirects back
 * to `https://<extension-id>.chromiumapp.org/` (with the slash) and
 * rejects prefixed paths. Most providers normalize to include or omit
 * the slash consistently.
 */
export function getOAuthRedirectUri(): string {
  const url = identity.getRedirectURL('');
  // `getRedirectURL('')` already includes the trailing slash; keep it.
  return url;
}

// ── Authorization Code + PKCE ─────────────────────────────────────

export interface AuthorizationCodeResult {
  bundle: OAuth2TokenBundle;
  /** The redirect URI the flow used — echoed back so the UI can display it. */
  redirectUri: string;
}

/**
 * Run the full Authorization Code + PKCE flow for `config` and
 * persist the resulting token bundle under `config.credentialRef`.
 * Returns the bundle so UI surfaces can show "connected" state
 * immediately without a follow-up read.
 */
export async function launchAuthorizationCodeFlow(config: OAuth2Auth): Promise<AuthorizationCodeResult> {
  if (config.flow !== 'authorization-code-pkce') {
    throw new OAuth2FlowError(
      'precondition',
      `launchAuthorizationCodeFlow requires flow=authorization-code-pkce, got ${config.flow}`,
    );
  }
  if (!identity.isAvailable()) {
    throw new OAuth2FlowError('precondition', 'chrome.identity is not available in this browser build');
  }

  const redirectUri = getOAuthRedirectUri();
  const state = base64UrlRandom(RANDOM_SOURCE(16));
  const codeVerifier = generateCodeVerifier(RANDOM_SOURCE);
  const codeChallenge = await computeCodeChallenge(codeVerifier, sha256);
  const preset = findOAuth2Preset(config.providerPresetId);

  const authUrl = buildAuthorizationUrl({
    config,
    redirectUri,
    state,
    codeChallenge,
    presetExtras: preset?.extraAuthParams ?? [],
  });

  logger.info('OAuthFlow', `Launching auth flow for ${config.credentialRef}`);

  const responseUrl = await identity.launchWebAuthFlow({ url: authUrl, interactive: true }).catch((err: Error) => {
    throw new OAuth2FlowError('authorize', `Authorization window closed without completing: ${err.message}`);
  });
  if (!responseUrl) {
    throw new OAuth2FlowError('authorize', 'Authorization flow cancelled before redirect');
  }

  const parsed = parseAuthorizationRedirect(responseUrl);
  if (parsed.error) {
    throw new OAuth2FlowError(
      'authorize',
      `Provider returned error: ${parsed.error} ${parsed.errorDescription ?? ''}`.trim(),
    );
  }
  if (parsed.state !== state) {
    throw new OAuth2FlowError('authorize', 'state parameter did not round-trip (possible CSRF attack)');
  }
  if (!parsed.code) {
    throw new OAuth2FlowError('authorize', 'Redirect did not include an authorization code');
  }

  const body = buildAuthorizationCodeTokenBody({
    config,
    code: parsed.code,
    codeVerifier,
    redirectUri,
  });

  const bundle = await exchangeForTokens(
    config.tokenEndpoint,
    body,
    'authorization_code',
    buildClientAuthHeader(config),
  );
  await putTokenBundle(config.credentialRef, bundle, config);
  return { bundle, redirectUri };
}

// ── Client Credentials ────────────────────────────────────────────

export async function performClientCredentialsFlow(
  config: OAuth2Auth,
  workspaceId?: string,
): Promise<OAuth2TokenBundle> {
  if (config.flow !== 'client-credentials') {
    throw new OAuth2FlowError(
      'precondition',
      `performClientCredentialsFlow requires flow=client-credentials, got ${config.flow}`,
    );
  }
  const body = buildClientCredentialsTokenBody(config);
  const bundle = await exchangeForTokens(
    config.tokenEndpoint,
    body,
    'client_credentials',
    buildClientAuthHeader(config),
  );
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

// ── Refresh Token ─────────────────────────────────────────────────

export async function performRefresh(config: OAuth2Auth, workspaceId?: string): Promise<OAuth2TokenBundle> {
  const current = await getTokenBundle(config.credentialRef, workspaceId);
  if (!current?.refreshToken) {
    throw new OAuth2FlowError('refresh', 'No refresh_token available for this credential');
  }
  const body = buildRefreshTokenBody({ config, refreshToken: current.refreshToken });
  // Some providers (notably legacy Okta tenants) expose a separate
  // refresh endpoint; fall back to the primary token endpoint when
  // the config doesn't override.
  const refreshEndpoint = config.refreshEndpoint?.trim() ? config.refreshEndpoint : config.tokenEndpoint;
  const bundle = await exchangeForTokens(refreshEndpoint, body, 'refresh_token', buildClientAuthHeader(config));
  // Providers sometimes omit refresh_token on refresh — carry the prior
  // one forward so the next refresh still works.
  if (!bundle.refreshToken && current.refreshToken) {
    bundle.refreshToken = current.refreshToken;
  }
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

// ── Flow-agnostic refresh dispatch (scheduler entry-point) ────────

/**
 * Refresh a credential regardless of flow. Authorization Code / Device
 * Code flows use the refresh_token grant; Client Credentials re-runs
 * the full client_credentials exchange (no refresh token exists for
 * that flow). The scheduler calls this from its alarm handler without
 * having to branch on the config shape.
 */
export async function refreshCredential(config: OAuth2Auth, workspaceId?: string): Promise<OAuth2TokenBundle> {
  if (config.flow === 'client-credentials') {
    return performClientCredentialsFlow(config, workspaceId);
  }
  return performRefresh(config, workspaceId);
}

// ── Shared: POST to the token endpoint ────────────────────────────

async function exchangeForTokens(
  tokenEndpoint: string,
  body: URLSearchParams,
  step: string,
  clientAuthHeader: string | null = null,
): Promise<OAuth2TokenBundle> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    // Accept JSON explicitly — GitHub returns urlencoded otherwise.
    Accept: 'application/json',
  };
  if (clientAuthHeader) headers.Authorization = clientAuthHeader;
  // Per-origin rate limit shared with Live Workflow chain steps — a
  // provider that handles both OAuth token endpoints AND a token-
  // reading LV workflow (common: upstream uses its own OAuth) pays a
  // single budget across both paths.
  const response = await withRefreshRateLimit(tokenEndpoint, () =>
    withHostAccess(tokenEndpoint, () =>
      fetch(tokenEndpoint, {
        method: 'POST',
        credentials: 'omit',
        headers,
        body,
      }),
    ),
  );
  const text = await response.text();
  if (!response.ok) {
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

// ── Helpers ───────────────────────────────────────────────────────

interface ParsedAuthorizationRedirect {
  code: string | null;
  state: string | null;
  error: string | null;
  errorDescription: string | null;
}

function parseAuthorizationRedirect(url: string): ParsedAuthorizationRedirect {
  try {
    const parsed = new URL(url);
    // Providers split between query-string (?code=...) and fragment
    // (#code=...). Check both so we tolerate either convention.
    const search = parsed.searchParams;
    const hash = new URLSearchParams(parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash);
    const pick = (k: string) => search.get(k) ?? hash.get(k);
    return {
      code: pick('code'),
      state: pick('state'),
      error: pick('error'),
      errorDescription: pick('error_description'),
    };
  } catch {
    return { code: null, state: null, error: null, errorDescription: null };
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

function base64UrlRandom(bytes: Uint8Array): string {
  // Small helper duplicated from the core `base64UrlEncode` so we
  // don't pay a cross-module import on the hot path. Output is
  // base64url-without-padding.
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
