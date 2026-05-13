/**
 * OAuth 2.0 / OIDC — provider presets + cross-platform helpers.
 * ARCHITECTURE §18.
 *
 * This module is platform-agnostic: no chrome.* APIs, no DOM, no
 * crypto.subtle touches. Extension + desktop both consume it.
 *
 * What lives here:
 *   • The provider preset library (Google, GitHub, Auth0, Okta, Azure
 *     AD, AWS Cognito, GitLab).
 *   • Pure helpers that turn `OAuth2Auth` + runtime state into the
 *     strings the caller needs to hit the wire (authorization URL,
 *     token-endpoint POST body, device-code polling).
 *   • The `OAuth2TokenBundle` shape — access + refresh token + expiry
 *     — that the extension's token store reads/writes through Vault.
 *
 * What does NOT live here:
 *   • Actually running the flow (chrome.identity.launchWebAuthFlow,
 *     fetch) — those cross the platform boundary; see the extension's
 *     `background/modules/oauth-flow.ts` for the runner.
 *   • Persistence of tokens — the Vault interface (§10) in the
 *     extension's `shared/vault/` is the store.
 *
 * Design rule: every helper here is a PURE function over arguments,
 * so a unit test can exercise it without mocks. PKCE verifier /
 * challenge generation takes a `randomBytes` injection so tests stay
 * deterministic without having to reach for `crypto.getRandomValues`.
 */

import type { OAuth2Auth, OAuth2Flow } from '../types/request';

// ── Runtime state shape ────────────────────────────────────────────

/**
 * Persisted token bundle for an oauth2-authed request. Written by the
 * flow runner after every token-endpoint exchange (initial flow,
 * refresh); read by the executor before every fetch to decide whether
 * to refresh or attach `Authorization: Bearer <access>`.
 *
 * `expiresAt` is an absolute wall-clock timestamp in ms since epoch —
 * the executor's "is this expired?" check doesn't care about the
 * original `expires_in` semantics (a relative seconds value that
 * varies by provider). `issuedAt` is stamped at exchange time so the
 * UI can show "refreshed 3 min ago."
 *
 * `scope` is the *effective* scope the provider granted — sometimes a
 * subset of the requested `scopes`, which the UI surfaces so the user
 * knows what they really got.
 */
export interface OAuth2TokenBundle {
  /** The current access token (short-lived, the one sent on every request). */
  accessToken: string;
  /**
   * The refresh token (long-lived, used to silently swap expired
   * access tokens). Absent when the provider doesn't issue one
   * (e.g. client-credentials flows usually omit it).
   */
  refreshToken?: string;
  /** `Bearer` is the only value Chrome OAuth providers send in practice. */
  tokenType: string;
  /** Absolute expiry wall-clock ms. `null` = provider didn't say. */
  expiresAt: number | null;
  /** Absolute issued-at wall-clock ms (local machine time). */
  issuedAt: number;
  /** Space-joined scope actually granted by the provider. */
  scope: string;
  /** Optional OIDC id_token (JWT). Not used by the executor today — preserved for inspection. */
  idToken?: string;
  /** Raw extra fields the provider returned (e.g. `ext_expires_in`). Preserved verbatim. */
  extra?: Record<string, string>;
}

/** Seconds-to-expiry snapshot used by the UI "expires in Nmin" pill. */
export function secondsUntilExpiry(bundle: OAuth2TokenBundle, nowMs: number = Date.now()): number | null {
  if (bundle.expiresAt == null) return null;
  return Math.round((bundle.expiresAt - nowMs) / 1000);
}

/**
 * Is this token expired (or close enough that the executor should
 * refresh preemptively)? The 30-second skew matches what most
 * OAuth clients use — covers clock drift between machine and provider.
 */
export function isExpired(bundle: OAuth2TokenBundle, nowMs: number = Date.now(), skewSeconds = 30): boolean {
  if (bundle.expiresAt == null) return false;
  return nowMs >= bundle.expiresAt - skewSeconds * 1000;
}

// ── Provider presets ───────────────────────────────────────────────

/**
 * A minimal preset — endpoints + default scope set + any quirks we
 * know about. The UI rehydrates the authorization endpoint / token
 * endpoint / default scopes from here when a preset is picked. Stored
 * values always win over preset values (users can customize
 * post-selection).
 *
 * Adding a new preset: fill in `authorizationEndpoint`,
 * `tokenEndpoint`, any `deviceAuthorizationEndpoint` / default scopes
 * / default flow. `redirectUriNote` is free-form copy surfaced in the
 * UI (e.g. "Register this redirect URI at https://console.cloud.google.com/").
 */
export interface OAuth2ProviderPreset {
  id: string;
  label: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  deviceAuthorizationEndpoint?: string;
  /** Default scopes pre-populated when the user picks this preset. */
  defaultScopes: readonly string[];
  /** Default flow (usually `authorization-code-pkce`). */
  defaultFlow: OAuth2Flow;
  /**
   * Free-form note shown under the redirect-URI field. Providers often
   * have weird rules (Google requires whole-origin match; GitHub
   * accepts wildcards; Auth0 wants a trailing slash). This is the
   * friend-of-a-friend wisdom that lives in docs, rarely in the spec.
   */
  redirectUriNote?: string;
  /** Extra auth params baked into the URL (e.g. Google's `access_type=offline`). */
  extraAuthParams?: ReadonlyArray<{ key: string; value: string }>;
}

/**
 * Known providers. The list is deliberately curated — only entries
 * we've actually tested end-to-end land here so users don't fall into
 * subtle misconfigurations. "Custom" (no preset) is always available
 * as an escape hatch.
 */
export const OAUTH2_PROVIDER_PRESETS: readonly OAuth2ProviderPreset[] = [
  {
    id: 'google',
    label: 'Google',
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    deviceAuthorizationEndpoint: 'https://oauth2.googleapis.com/device/code',
    defaultScopes: ['openid', 'email', 'profile'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'Register the redirect URI at https://console.cloud.google.com/apis/credentials. Google requires the redirect URI to match your extension’s chromiumapp.org URL exactly.',
    // `access_type=offline` prompts Google to issue a refresh_token alongside the access_token.
    extraAuthParams: [{ key: 'access_type', value: 'offline' }],
  },
  {
    id: 'github',
    label: 'GitHub',
    // GitHub doesn't speak PKCE on the web flow; client credentials
    // and device-code are the first-class paths. We still default to
    // authorization-code-pkce so custom users benefit — GitHub treats
    // code_verifier/challenge as harmless extra params.
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    deviceAuthorizationEndpoint: 'https://github.com/login/device/code',
    defaultScopes: ['read:user'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'Register the redirect URI on your OAuth app at https://github.com/settings/developers. GitHub returns tokens as URL-encoded bodies by default — the extension requests JSON via Accept: application/json.',
  },
  {
    id: 'auth0',
    label: 'Auth0',
    authorizationEndpoint: 'https://YOUR-TENANT.auth0.com/authorize',
    tokenEndpoint: 'https://YOUR-TENANT.auth0.com/oauth/token',
    deviceAuthorizationEndpoint: 'https://YOUR-TENANT.auth0.com/oauth/device/code',
    defaultScopes: ['openid', 'profile', 'email', 'offline_access'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'Replace YOUR-TENANT with your Auth0 tenant. Add the redirect URI to the application’s Allowed Callback URLs list.',
  },
  {
    id: 'okta',
    label: 'Okta',
    authorizationEndpoint: 'https://YOUR-OKTA-DOMAIN/oauth2/default/v1/authorize',
    tokenEndpoint: 'https://YOUR-OKTA-DOMAIN/oauth2/default/v1/token',
    deviceAuthorizationEndpoint: 'https://YOUR-OKTA-DOMAIN/oauth2/default/v1/device/authorize',
    defaultScopes: ['openid', 'profile', 'email', 'offline_access'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'Replace YOUR-OKTA-DOMAIN with your Okta org URL. Add the redirect URI to the application’s Sign-in redirect URIs list.',
  },
  {
    id: 'azure-ad',
    label: 'Azure AD / Entra ID',
    authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    deviceAuthorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode',
    defaultScopes: ['openid', 'profile', 'email', 'offline_access'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'For a single-tenant app replace `/common/` with `/<your-tenant-id>/`. Register the redirect URI as a "Single-page application" redirect on the app page.',
  },
  {
    id: 'aws-cognito',
    label: 'AWS Cognito',
    authorizationEndpoint: 'https://YOUR-DOMAIN.auth.REGION.amazoncognito.com/oauth2/authorize',
    tokenEndpoint: 'https://YOUR-DOMAIN.auth.REGION.amazoncognito.com/oauth2/token',
    defaultScopes: ['openid', 'profile', 'email'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'Replace YOUR-DOMAIN + REGION with your Cognito user-pool hosted UI domain. Add the redirect URI under App client → Hosted UI.',
  },
  {
    id: 'gitlab',
    label: 'GitLab',
    authorizationEndpoint: 'https://gitlab.com/oauth/authorize',
    tokenEndpoint: 'https://gitlab.com/oauth/token',
    defaultScopes: ['read_user', 'api'],
    defaultFlow: 'authorization-code-pkce',
    redirectUriNote:
      'Works against a self-hosted GitLab too — swap gitlab.com for your instance host. Register the redirect URI on the OAuth application page.',
  },
];

/** Look up a preset by id; returns `null` for unknown / `"custom"`. */
export function findOAuth2Preset(id: string | undefined): OAuth2ProviderPreset | null {
  if (!id) return null;
  return OAUTH2_PROVIDER_PRESETS.find((p) => p.id === id) ?? null;
}

// ── Authorization URL construction ────────────────────────────────

/**
 * Build the authorization endpoint URL the SW will open with
 * `chrome.identity.launchWebAuthFlow`. Caller supplies the runtime
 * values (PKCE challenge, state, redirect URI) since those live
 * outside the config.
 *
 * Per RFC 6749 / RFC 7636, required params:
 *   - response_type=code
 *   - client_id
 *   - redirect_uri
 *   - scope (space-joined)
 *   - state (caller-supplied nonce; verified against the redirect)
 *   - code_challenge + code_challenge_method=S256 (PKCE)
 *
 * Plus any `extraAuthParams` from the config.
 */
export function buildAuthorizationUrl(input: {
  config: OAuth2Auth;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  presetExtras?: ReadonlyArray<{ key: string; value: string }>;
}): string {
  const { config, redirectUri, state, codeChallenge, presetExtras } = input;
  if (!config.authorizationEndpoint) {
    throw new Error('authorization-code-pkce flow requires an authorizationEndpoint');
  }
  const params = new URLSearchParams();
  params.set('response_type', 'code');
  params.set('client_id', config.clientId);
  params.set('redirect_uri', redirectUri);
  params.set('scope', config.scopes.join(' '));
  params.set('state', state);
  params.set('code_challenge', codeChallenge);
  params.set('code_challenge_method', 'S256');
  for (const { key, value } of presetExtras ?? []) {
    params.set(key, value);
  }
  for (const { key, value } of config.extraAuthParams ?? []) {
    params.set(key, value);
  }
  // Some authorization endpoints already have query params (rare, but
  // Azure's AD v2.0 endpoints carry a tenant path — still fine).
  const joiner = config.authorizationEndpoint.includes('?') ? '&' : '?';
  return `${config.authorizationEndpoint}${joiner}${params.toString()}`;
}

// ── Token endpoint body builders ──────────────────────────────────

/**
 * Build the form-encoded body for the token-endpoint exchange after a
 * successful authorization-code redirect. RFC 6749 §4.1.3 plus PKCE
 * §4.5. Most providers reject the request if `code_verifier` is
 * missing, even for public clients.
 *
 * When `clientAuthentication === 'basic-header'`, the `client_id` +
 * `client_secret` are dropped from the body so the caller can attach
 * them as an `Authorization: Basic` header instead (see
 * {@link buildClientAuthHeader}).
 */
export function buildAuthorizationCodeTokenBody(input: {
  config: OAuth2Auth;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): URLSearchParams {
  const { config, code, codeVerifier, redirectUri } = input;
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  body.set('code_verifier', codeVerifier);
  if (config.clientAuthentication !== 'basic-header') {
    body.set('client_id', config.clientId);
    if (config.clientSecret) body.set('client_secret', config.clientSecret);
  }
  for (const { key, value } of config.extraTokenParams ?? []) {
    body.set(key, value);
  }
  return body;
}

/**
 * Client Credentials token POST — RFC 6749 §4.4. Same
 * `clientAuthentication` switch as the authorization-code body.
 */
export function buildClientCredentialsTokenBody(config: OAuth2Auth): URLSearchParams {
  if (!config.clientSecret) {
    throw new Error('client-credentials flow requires clientSecret');
  }
  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  if (config.clientAuthentication !== 'basic-header') {
    body.set('client_id', config.clientId);
    body.set('client_secret', config.clientSecret);
  }
  if (config.scopes.length > 0) body.set('scope', config.scopes.join(' '));
  for (const { key, value } of config.extraTokenParams ?? []) {
    body.set(key, value);
  }
  return body;
}

/** Device Code authorization POST — RFC 8628 §3.1. */
export function buildDeviceAuthorizationBody(config: OAuth2Auth): URLSearchParams {
  const body = new URLSearchParams();
  body.set('client_id', config.clientId);
  if (config.scopes.length > 0) body.set('scope', config.scopes.join(' '));
  return body;
}

/** Device Code token POST (polled) — RFC 8628 §3.4. */
export function buildDeviceCodeTokenBody(input: { config: OAuth2Auth; deviceCode: string }): URLSearchParams {
  const { config, deviceCode } = input;
  const body = new URLSearchParams();
  body.set('grant_type', 'urn:ietf:params:oauth:grant-type:device_code');
  body.set('device_code', deviceCode);
  body.set('client_id', config.clientId);
  if (config.clientSecret) body.set('client_secret', config.clientSecret);
  return body;
}

/**
 * Refresh token POST — RFC 6749 §6. Honors `clientAuthentication` for
 * parity with the initial exchange + folds `extraRefreshParams` in so
 * providers that require per-refresh knobs (e.g. `audience` rotation)
 * can be accommodated without a schema churn.
 */
export function buildRefreshTokenBody(input: { config: OAuth2Auth; refreshToken: string }): URLSearchParams {
  const { config, refreshToken } = input;
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  if (config.clientAuthentication !== 'basic-header') {
    body.set('client_id', config.clientId);
    if (config.clientSecret) body.set('client_secret', config.clientSecret);
  }
  if (config.scopes.length > 0) body.set('scope', config.scopes.join(' '));
  for (const { key, value } of config.extraRefreshParams ?? []) {
    body.set(key, value);
  }
  return body;
}

/**
 * Build the `Authorization: Basic <base64(client_id:client_secret)>`
 * header value when the config opts into `clientAuthentication:
 * 'basic-header'`. Returns `null` when the header shouldn't be
 * attached (body-auth, or missing client secret).
 */
export function buildClientAuthHeader(config: OAuth2Auth): string | null {
  if (config.clientAuthentication !== 'basic-header') return null;
  if (!config.clientSecret) return null;
  const encoded = base64UrlSafeBasic(`${config.clientId}:${config.clientSecret}`);
  return `Basic ${encoded}`;
}

function base64UrlSafeBasic(input: string): string {
  // Basic auth uses STANDARD base64 (with `+/=`), not url-safe. We still
  // use platform primitives — btoa in browsers, Buffer on node.
  if (typeof btoa === 'function') return btoa(input);
  return Buffer.from(input, 'utf-8').toString('base64');
}

// ── Token response parsing ────────────────────────────────────────

/**
 * Fold a token-endpoint JSON response into our `OAuth2TokenBundle`.
 * `issuedAt` stamps the local machine's wall clock; `expiresAt` is
 * derived from the provider's relative `expires_in`.
 *
 * Unknown fields flow into `extra` so inspection UIs can surface
 * provider-specific keys (e.g. Azure's `ext_expires_in`). Strict
 * field shapes are intentionally loose — OAuth providers vary in
 * casing and presence; the executor only needs `access_token` +
 * `token_type` to function.
 */
export function parseTokenResponse(json: Record<string, unknown>, issuedAt: number = Date.now()): OAuth2TokenBundle {
  const accessToken = asString(json.access_token);
  if (!accessToken) {
    throw new Error('Token response missing access_token');
  }
  const tokenType = asString(json.token_type) ?? 'Bearer';
  const refreshToken = asString(json.refresh_token) ?? undefined;
  const scope = asString(json.scope) ?? '';
  const idToken = asString(json.id_token) ?? undefined;
  const expiresIn = asNumber(json.expires_in);
  const expiresAt = expiresIn != null ? issuedAt + expiresIn * 1000 : null;
  const extra: Record<string, string> = {};
  const reserved = new Set(['access_token', 'token_type', 'refresh_token', 'scope', 'id_token', 'expires_in']);
  for (const [k, v] of Object.entries(json)) {
    if (reserved.has(k)) continue;
    if (typeof v === 'string') extra[k] = v;
    else if (typeof v === 'number' || typeof v === 'boolean') extra[k] = String(v);
  }
  return {
    accessToken,
    tokenType,
    refreshToken,
    scope,
    idToken,
    issuedAt,
    expiresAt,
    extra: Object.keys(extra).length > 0 ? extra : undefined,
  };
}

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ── PKCE code verifier / challenge ─────────────────────────────────

/**
 * RFC 7636 §4.1 — verifier is a 43-to-128 character unreserved string
 * drawn from `[A-Z/a-z/0-9/-._~]`. We base64url-encode 32 bytes of
 * entropy so the output is exactly 43 characters (the minimum legal
 * length with maximum entropy).
 */
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function generateCodeVerifier(randomBytes: (n: number) => Uint8Array): string {
  return base64UrlEncode(randomBytes(32));
}

/**
 * SHA-256 of the verifier, base64url-encoded. Callers provide the
 * platform's SHA-256 function (WebCrypto.subtle.digest on the
 * extension; Node `crypto` in tests) so this module stays pure.
 */
export async function computeCodeChallenge(
  verifier: string,
  sha256: (bytes: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  const digest = await sha256(new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

/** Base64url WITHOUT trailing `=` padding per RFC 4648 §5. */
export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  // `btoa` isn't in the Node test env but is everywhere browsers run.
  // Fall back to Buffer when present.
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── credentialRef generator ───────────────────────────────────────

/**
 * Build a fresh, stable credentialRef. Request YAML persists this
 * value; the token store keys by it. We prefix with `oauth2-cred-`
 * so ad-hoc grep over a workspace instantly finds every OAuth binding.
 *
 * Callers supply the random source so the core module stays
 * platform-agnostic (extension uses crypto.getRandomValues; tests can
 * stub).
 */
export function generateCredentialRef(randomBytes: (n: number) => Uint8Array): string {
  const bytes = randomBytes(8);
  let s = '';
  for (const b of bytes) s += BASE64URL_ALPHABET[b % BASE64URL_ALPHABET.length];
  return `oauth2-cred-${s}`;
}
