/**
 * OAuth 2.0 flow runner — SW-side orchestration that kicks off the
 * user-visible authorization flow, exchanges the code at the token
 * endpoint, and persists the result through `oauth-token-store.ts`.
 *
 * Split from the token store so the runner is testable in isolation:
 *   • the token store owns `chrome.storage.local` + `withLock`;
 *   • the runner owns `chrome.identity.launchWebAuthFlow` + `fetch`.
 *
 * Five flows implemented:
 *   • Authorization Code (± PKCE) (`launchAuthorizationCodeFlow` —
 *     PKCE by default; `grantType: 'authorization-code'` omits the
 *     challenge/verifier pair for plain RFC 6749 §4.1 providers)
 *   • Client Credentials          (`performClientCredentialsFlow`)
 *   • Password Credentials        (`performPasswordCredentialsFlow`)
 *   • JWT Bearer (RFC 7523 §2.1)  (`performJwtBearerFlow`)
 *   • Refresh Token               (`performRefresh`)
 *
 * A config on an assertion client authentication (`private-key-jwt` /
 * `client-secret-jwt`) mints its client assertion per token POST
 * before the body builds — the oracle flows' twin.
 *
 * Device Code lands next — it needs a user-facing polling UI which
 * is tracked separately.
 */

import {
  buildAuthorizationCodeTokenBody,
  buildAuthorizationUrl,
  buildClientAuthHeader,
  buildClientCredentialsTokenBody,
  buildJwtBearerTokenBody,
  buildPasswordCredentialsTokenBody,
  buildRefreshTokenBody,
  computeCodeChallenge,
  findOAuth2Preset,
  generateCodeVerifier,
  mintClientAssertion,
  mintGrantAssertion,
  nonBodyExtraParams,
  type OAuth2TokenBundle,
  parseAuthorizationRedirect,
  parseTokenResponse,
  usesPkce,
} from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { appendQueryParams } from '@openheaders/core/utils';
import { getTokenBundle, putTokenBundle } from '@openheaders/oracle/entity/oauth-token-store';
import { identity } from '@utils/browser-api';
import { logger } from '@utils/logger';
import { withHostAccess } from '@/shared/fetch/with-host-access';
// `workspaceId?` threads the editing-scope workspace through the
// browser-mediated OAuth flow so a diverged tab's authorize lands the
// resulting bundle in its own workspace's oracle (MWPT-FULL § 8.3.10).
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
export async function launchAuthorizationCodeFlow(
  config: OAuth2Auth,
  workspaceId?: string,
): Promise<AuthorizationCodeResult> {
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
  // Plain authorization-code (grantType: 'authorization-code') skips
  // the PKCE pair on both legs; the exchange is otherwise identical.
  const withPkce = usesPkce(config);
  const codeVerifier = withPkce ? generateCodeVerifier(RANDOM_SOURCE) : undefined;
  const codeChallenge = codeVerifier !== undefined ? await computeCodeChallenge(codeVerifier, sha256) : undefined;
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
    clientAssertion: await mintClientAssertionOrFail(config, 'authorization_code'),
  });

  const bundle = await exchangeForTokens(
    config.tokenEndpoint,
    body,
    'authorization_code',
    buildClientAuthHeader(config),
    nonBodyExtraParams(config.extraTokenParams),
  );
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
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
  const body = buildClientCredentialsTokenBody(config, await mintClientAssertionOrFail(config, 'client_credentials'));
  const bundle = await exchangeForTokens(
    config.tokenEndpoint,
    body,
    'client_credentials',
    buildClientAuthHeader(config),
    nonBodyExtraParams(config.extraTokenParams),
  );
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

// ── Password Credentials ──────────────────────────────────────────

export async function performPasswordCredentialsFlow(
  config: OAuth2Auth,
  workspaceId?: string,
): Promise<OAuth2TokenBundle> {
  if (config.flow !== 'password-credentials') {
    throw new OAuth2FlowError(
      'precondition',
      `performPasswordCredentialsFlow requires flow=password-credentials, got ${config.flow}`,
    );
  }
  const body = buildPasswordCredentialsTokenBody(config, await mintClientAssertionOrFail(config, 'password'));
  const bundle = await exchangeForTokens(
    config.tokenEndpoint,
    body,
    'password',
    buildClientAuthHeader(config),
    nonBodyExtraParams(config.extraTokenParams),
  );
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

// ── JWT Bearer (RFC 7523 §2.1) ────────────────────────────────────

/**
 * The signed assertion IS the grant: no user agent, no refresh token —
 * the assertion mints fresh per exchange from the config's signing
 * key, so re-running the flow is the refresh.
 */
export async function performJwtBearerFlow(config: OAuth2Auth, workspaceId?: string): Promise<OAuth2TokenBundle> {
  if (config.flow !== 'jwt-bearer') {
    throw new OAuth2FlowError('precondition', `performJwtBearerFlow requires flow=jwt-bearer, got ${config.flow}`);
  }
  const assertion = await mintGrantAssertion(config).catch((err: Error) => {
    throw new OAuth2FlowError('precondition', err.message);
  });
  const body = buildJwtBearerTokenBody({
    config,
    assertion,
    clientAssertion: await mintClientAssertionOrFail(config, 'jwt_bearer'),
  });
  const bundle = await exchangeForTokens(
    config.tokenEndpoint,
    body,
    'jwt_bearer',
    buildClientAuthHeader(config),
    nonBodyExtraParams(config.extraTokenParams),
  );
  await putTokenBundle(config.credentialRef, bundle, config, workspaceId);
  return bundle;
}

/** The client assertion for one token POST, or `undefined` under the
 *  secret methods; a signing failure is the step's precondition error. */
async function mintClientAssertionOrFail(config: OAuth2Auth, step: string): Promise<string | undefined> {
  try {
    return await mintClientAssertion(config);
  } catch (err) {
    throw new OAuth2FlowError(step, `client assertion: ${(err as Error).message}`);
  }
}

// ── Refresh Token ─────────────────────────────────────────────────

export async function performRefresh(config: OAuth2Auth, workspaceId?: string): Promise<OAuth2TokenBundle> {
  const current = await getTokenBundle(config.credentialRef, workspaceId);
  if (!current?.refreshToken) {
    throw new OAuth2FlowError('refresh', 'No refresh_token available for this credential');
  }
  const body = buildRefreshTokenBody({
    config,
    refreshToken: current.refreshToken,
    clientAssertion: await mintClientAssertionOrFail(config, 'refresh_token'),
  });
  // Some providers (notably legacy Okta tenants) expose a separate
  // refresh endpoint; fall back to the primary token endpoint when
  // the config doesn't override.
  const refreshEndpoint = config.refreshEndpoint?.trim() ? config.refreshEndpoint : config.tokenEndpoint;
  const bundle = await exchangeForTokens(
    refreshEndpoint,
    body,
    'refresh_token',
    buildClientAuthHeader(config),
    nonBodyExtraParams(config.extraRefreshParams),
  );
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
 * Renew a credential regardless of flow: the refresh_token grant when
 * the store holds one, else the flow's own re-run for the
 * user-agent-free grants — Client Credentials, Password Credentials
 * (the config carries the resource-owner credentials), JWT Bearer (a
 * fresh assertion IS the refresh). The scheduler and the executor's
 * on-send seam both call this without branching on the config shape;
 * the oracle's `refreshCredential` is the twin.
 */
export async function refreshCredential(config: OAuth2Auth, workspaceId?: string): Promise<OAuth2TokenBundle> {
  const current = await getTokenBundle(config.credentialRef, workspaceId);
  if (current?.refreshToken) return performRefresh(config, workspaceId);
  switch (config.flow) {
    case 'client-credentials':
      return performClientCredentialsFlow(config, workspaceId);
    case 'password-credentials':
      return performPasswordCredentialsFlow(config, workspaceId);
    case 'jwt-bearer':
      return performJwtBearerFlow(config, workspaceId);
    default:
      return performRefresh(config, workspaceId);
  }
}

// ── Shared: POST to the token endpoint ────────────────────────────

async function exchangeForTokens(
  tokenEndpoint: string,
  body: URLSearchParams,
  step: string,
  clientAuthHeader: string | null = null,
  extras?: ReturnType<typeof nonBodyExtraParams>,
): Promise<OAuth2TokenBundle> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    // Accept JSON explicitly — GitHub returns urlencoded otherwise.
    Accept: 'application/json',
  };
  // Header-routed extra params ride the POST; the explicit client-auth
  // header wins over a same-key row.
  for (const h of extras?.headers ?? []) headers[h.key] = h.value;
  if (clientAuthHeader) headers.Authorization = clientAuthHeader;
  // URL-routed extra params append to the endpoint's query string.
  const url =
    extras !== undefined && extras.query.length > 0 ? appendQueryParams(tokenEndpoint, extras.query) : tokenEndpoint;
  // Per-origin rate limit shared with Live Workflow chain steps — a
  // provider that handles both OAuth token endpoints AND a token-
  // reading LV workflow (common: upstream uses its own OAuth) pays a
  // single budget across both paths.
  const response = await withRefreshRateLimit(tokenEndpoint, () =>
    withHostAccess(tokenEndpoint, () =>
      fetch(url, {
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
