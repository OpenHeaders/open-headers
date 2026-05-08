/**
 * OAuth 2.0 core helpers — provider presets + authorization-URL
 * construction + token-body builders + PKCE + token-response parsing.
 * Everything platform-agnostic lives here; the extension's flow
 * runner owns the chrome.identity + fetch glue.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  base64UrlEncode,
  buildAuthorizationCodeTokenBody,
  buildAuthorizationUrl,
  buildClientCredentialsTokenBody,
  buildDeviceAuthorizationBody,
  buildDeviceCodeTokenBody,
  buildRefreshTokenBody,
  computeCodeChallenge,
  findOAuth2Preset,
  generateCodeVerifier,
  generateCredentialRef,
  isExpired,
  OAUTH2_PROVIDER_PRESETS,
  type OAuth2TokenBundle,
  parseTokenResponse,
  secondsUntilExpiry,
} from '../../src/oauth';
import type { OAuth2Auth } from '../../src/types/v5/request';

// ── Test factories ────────────────────────────────────────────────

function makeConfig(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abcdefgh',
    providerPresetId: 'custom',
    flow: 'authorization-code-pkce',
    authorizationEndpoint: 'https://auth.openheaders.io/authorize',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-123',
    scopes: ['read', 'write'],
    ...overrides,
  };
}

function deterministicRandom(byte = 42): (n: number) => Uint8Array {
  return (n: number) => {
    const buf = new Uint8Array(n);
    for (let i = 0; i < n; i++) buf[i] = (byte + i) & 0xff;
    return buf;
  };
}

function nodeSha256(bytes: Uint8Array): Promise<Uint8Array> {
  const d = createHash('sha256').update(Buffer.from(bytes)).digest();
  return Promise.resolve(new Uint8Array(d.buffer, d.byteOffset, d.byteLength));
}

// ── Provider presets ──────────────────────────────────────────────

describe('OAUTH2_PROVIDER_PRESETS', () => {
  it('contains the major providers with unique ids', () => {
    const ids = OAUTH2_PROVIDER_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['google', 'github', 'auth0', 'okta', 'azure-ad', 'aws-cognito', 'gitlab']) {
      expect(ids).toContain(id);
    }
  });

  it('every preset has both required endpoints', () => {
    for (const p of OAUTH2_PROVIDER_PRESETS) {
      expect(p.authorizationEndpoint.length).toBeGreaterThan(0);
      expect(p.tokenEndpoint.length).toBeGreaterThan(0);
    }
  });

  it('findOAuth2Preset returns null for unknown / empty ids', () => {
    expect(findOAuth2Preset(undefined)).toBeNull();
    expect(findOAuth2Preset('')).toBeNull();
    expect(findOAuth2Preset('unknown-provider')).toBeNull();
  });

  it('findOAuth2Preset locates known providers by id', () => {
    expect(findOAuth2Preset('google')?.label).toBe('Google');
    expect(findOAuth2Preset('github')?.label).toBe('GitHub');
  });
});

// ── Authorization URL ─────────────────────────────────────────────

describe('buildAuthorizationUrl', () => {
  it('includes response_type=code + redirect_uri + scope + state + PKCE', () => {
    const url = buildAuthorizationUrl({
      config: makeConfig(),
      redirectUri: 'https://abc123.chromiumapp.org/',
      state: 'nonce-1',
      codeChallenge: 'challenge-xyz',
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://auth.openheaders.io/authorize');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('client-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://abc123.chromiumapp.org/');
    expect(parsed.searchParams.get('scope')).toBe('read write');
    expect(parsed.searchParams.get('state')).toBe('nonce-1');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-xyz');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('threads preset + config extraAuthParams', () => {
    const url = buildAuthorizationUrl({
      config: makeConfig({
        extraAuthParams: [{ uid: 'extauth01', key: 'custom', value: 'config-value' }],
      }),
      redirectUri: 'https://x.chromiumapp.org/',
      state: 's',
      codeChallenge: 'c',
      presetExtras: [{ key: 'access_type', value: 'offline' }],
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('custom')).toBe('config-value');
  });

  it('honors an authorization endpoint that already has query params', () => {
    const url = buildAuthorizationUrl({
      config: makeConfig({
        authorizationEndpoint: 'https://auth.openheaders.io/authorize?tenant=acme',
      }),
      redirectUri: 'https://x.chromiumapp.org/',
      state: 's',
      codeChallenge: 'c',
    });
    expect(url).toContain('?tenant=acme&');
    // Both the tenant + the OAuth params survive.
    expect(url).toContain('response_type=code');
  });

  it('throws when the flow needs an authorization endpoint but none is set', () => {
    expect(() =>
      buildAuthorizationUrl({
        config: makeConfig({ authorizationEndpoint: undefined }),
        redirectUri: 'https://x.chromiumapp.org/',
        state: 's',
        codeChallenge: 'c',
      }),
    ).toThrow(/authorizationEndpoint/);
  });
});

// ── Token body builders ───────────────────────────────────────────

describe('buildAuthorizationCodeTokenBody', () => {
  it('emits grant_type=authorization_code with code_verifier', () => {
    const body = buildAuthorizationCodeTokenBody({
      config: makeConfig(),
      code: 'auth-code-xyz',
      codeVerifier: 'verifier-abc',
      redirectUri: 'https://x.chromiumapp.org/',
    });
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code-xyz');
    expect(body.get('code_verifier')).toBe('verifier-abc');
    expect(body.get('redirect_uri')).toBe('https://x.chromiumapp.org/');
    expect(body.get('client_id')).toBe('client-123');
    // Public clients (no clientSecret) omit the field entirely.
    expect(body.has('client_secret')).toBe(false);
  });

  it('includes client_secret when the config carries one', () => {
    const body = buildAuthorizationCodeTokenBody({
      config: makeConfig({ clientSecret: 'shhh' }),
      code: 'c',
      codeVerifier: 'v',
      redirectUri: 'https://x/',
    });
    expect(body.get('client_secret')).toBe('shhh');
  });

  it('threads extraTokenParams', () => {
    const body = buildAuthorizationCodeTokenBody({
      config: makeConfig({
        extraTokenParams: [
          { uid: 'exttok001', key: 'audience', value: 'https://api.openheaders.io' },
          { uid: 'exttok002', key: 'resource', value: 'https://resource.io' },
        ],
      }),
      code: 'c',
      codeVerifier: 'v',
      redirectUri: 'https://x/',
    });
    expect(body.get('audience')).toBe('https://api.openheaders.io');
    expect(body.get('resource')).toBe('https://resource.io');
  });
});

describe('buildClientCredentialsTokenBody', () => {
  it('emits grant_type=client_credentials + client_id + client_secret', () => {
    const body = buildClientCredentialsTokenBody(
      makeConfig({ flow: 'client-credentials', clientSecret: 'shhh', scopes: ['api.read'] }),
    );
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('client_secret')).toBe('shhh');
    expect(body.get('scope')).toBe('api.read');
  });

  it('throws when client_secret is missing', () => {
    expect(() => buildClientCredentialsTokenBody(makeConfig({ flow: 'client-credentials' }))).toThrow(/clientSecret/);
  });

  it('omits scope when scopes array is empty', () => {
    const body = buildClientCredentialsTokenBody(
      makeConfig({ flow: 'client-credentials', clientSecret: 's', scopes: [] }),
    );
    expect(body.has('scope')).toBe(false);
  });
});

describe('buildDeviceAuthorizationBody + buildDeviceCodeTokenBody', () => {
  it('device auth request carries client_id + scope', () => {
    const body = buildDeviceAuthorizationBody(makeConfig({ flow: 'device-code' }));
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('scope')).toBe('read write');
  });

  it('device token poll carries the RFC 8628 grant_type + device_code', () => {
    const body = buildDeviceCodeTokenBody({
      config: makeConfig({ flow: 'device-code' }),
      deviceCode: 'device-abc',
    });
    expect(body.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code');
    expect(body.get('device_code')).toBe('device-abc');
    expect(body.get('client_id')).toBe('client-123');
  });
});

describe('buildRefreshTokenBody', () => {
  it('emits grant_type=refresh_token + the supplied refresh_token', () => {
    const body = buildRefreshTokenBody({
      config: makeConfig(),
      refreshToken: 'rf-xyz',
    });
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rf-xyz');
    expect(body.get('client_id')).toBe('client-123');
  });

  it('preserves scopes so the refresh scope matches the original grant', () => {
    const body = buildRefreshTokenBody({
      config: makeConfig({ scopes: ['read', 'write'] }),
      refreshToken: 'rf',
    });
    expect(body.get('scope')).toBe('read write');
  });

  it('folds extraRefreshParams into the body so per-refresh knobs survive', () => {
    const body = buildRefreshTokenBody({
      config: makeConfig({ extraRefreshParams: [{ uid: 'extref001', key: 'audience', value: 'api.openheaders.io' }] }),
      refreshToken: 'rf',
    });
    expect(body.get('audience')).toBe('api.openheaders.io');
  });
});

// ── Client authentication mode ────────────────────────────────────

describe('clientAuthentication = basic-header', () => {
  it('drops client_id + client_secret from the authorization-code body', () => {
    const body = buildAuthorizationCodeTokenBody({
      config: makeConfig({ clientSecret: 'shh', clientAuthentication: 'basic-header' }),
      code: 'auth',
      codeVerifier: 'cv',
      redirectUri: 'https://cb',
    });
    expect(body.has('client_id')).toBe(false);
    expect(body.has('client_secret')).toBe(false);
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('drops client_id + client_secret from the refresh body', () => {
    const body = buildRefreshTokenBody({
      config: makeConfig({ clientSecret: 'shh', clientAuthentication: 'basic-header' }),
      refreshToken: 'rf',
    });
    expect(body.has('client_id')).toBe(false);
    expect(body.has('client_secret')).toBe(false);
    expect(body.get('refresh_token')).toBe('rf');
  });

  it('drops client_id + client_secret from the client-credentials body', () => {
    const body = buildClientCredentialsTokenBody(
      makeConfig({ flow: 'client-credentials', clientSecret: 'shh', clientAuthentication: 'basic-header' }),
    );
    expect(body.has('client_id')).toBe(false);
    expect(body.has('client_secret')).toBe(false);
    expect(body.get('grant_type')).toBe('client_credentials');
  });
});

describe('buildClientAuthHeader', () => {
  it('returns null when clientAuthentication is body (the default)', async () => {
    const { buildClientAuthHeader } = await import('@openheaders/core/oauth');
    expect(buildClientAuthHeader(makeConfig({ clientSecret: 'shh' }))).toBeNull();
  });

  it('returns null when basic-header is selected but clientSecret is missing', async () => {
    const { buildClientAuthHeader } = await import('@openheaders/core/oauth');
    expect(buildClientAuthHeader(makeConfig({ clientAuthentication: 'basic-header' }))).toBeNull();
  });

  it('emits RFC 6749 §2.3.1 Basic header when basic-header is selected + secret exists', async () => {
    const { buildClientAuthHeader } = await import('@openheaders/core/oauth');
    const header = buildClientAuthHeader(
      makeConfig({ clientSecret: 'super-secret', clientAuthentication: 'basic-header' }),
    );
    // base64("client-123:super-secret") = Y2xpZW50LTEyMzpzdXBlci1zZWNyZXQ=
    expect(header).toBe('Basic Y2xpZW50LTEyMzpzdXBlci1zZWNyZXQ=');
  });
});

// ── Token response parsing ────────────────────────────────────────

describe('parseTokenResponse', () => {
  it('maps the canonical fields and derives expiresAt from expires_in', () => {
    const issuedAt = 1_700_000_000_000;
    const bundle = parseTokenResponse(
      {
        access_token: 'at-xyz',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'rf-xyz',
        scope: 'read write',
        id_token: 'jwt-id',
      },
      issuedAt,
    );
    expect(bundle.accessToken).toBe('at-xyz');
    expect(bundle.refreshToken).toBe('rf-xyz');
    expect(bundle.tokenType).toBe('Bearer');
    expect(bundle.scope).toBe('read write');
    expect(bundle.idToken).toBe('jwt-id');
    expect(bundle.issuedAt).toBe(issuedAt);
    expect(bundle.expiresAt).toBe(issuedAt + 3600 * 1000);
  });

  it('defaults tokenType to Bearer when absent', () => {
    const bundle = parseTokenResponse({ access_token: 'at' });
    expect(bundle.tokenType).toBe('Bearer');
  });

  it('sets expiresAt=null when the provider omits expires_in', () => {
    const bundle = parseTokenResponse({ access_token: 'at' });
    expect(bundle.expiresAt).toBeNull();
  });

  it('throws when access_token is missing', () => {
    expect(() => parseTokenResponse({})).toThrow(/access_token/);
  });

  it('folds provider-specific extras into the extra map', () => {
    const bundle = parseTokenResponse({
      access_token: 'at',
      ext_expires_in: 7200,
      trace_id: 'abc',
    });
    expect(bundle.extra).toEqual({ ext_expires_in: '7200', trace_id: 'abc' });
  });

  it('coerces a string expires_in to milliseconds', () => {
    const issuedAt = 1_000_000;
    const bundle = parseTokenResponse({ access_token: 'at', expires_in: '300' }, issuedAt);
    expect(bundle.expiresAt).toBe(issuedAt + 300_000);
  });
});

// ── Lifecycle helpers ─────────────────────────────────────────────

describe('secondsUntilExpiry + isExpired', () => {
  const base: OAuth2TokenBundle = {
    accessToken: 'at',
    tokenType: 'Bearer',
    scope: '',
    issuedAt: 1_000_000,
    expiresAt: 1_000_000 + 3600_000,
  };

  it('secondsUntilExpiry returns remaining seconds', () => {
    expect(secondsUntilExpiry(base, 1_000_000)).toBe(3600);
    expect(secondsUntilExpiry(base, 1_000_000 + 1800_000)).toBe(1800);
  });

  it('secondsUntilExpiry returns null when expiresAt is missing', () => {
    expect(secondsUntilExpiry({ ...base, expiresAt: null })).toBeNull();
  });

  it('isExpired honors a skew window before the wall-clock expiry', () => {
    // 30s before expiry — still considered expired by the default skew.
    expect(isExpired(base, base.expiresAt! - 10_000, 30)).toBe(true);
    // 31s before expiry — not yet.
    expect(isExpired(base, base.expiresAt! - 31_000, 30)).toBe(false);
  });

  it('isExpired returns false when expiresAt is null', () => {
    expect(isExpired({ ...base, expiresAt: null })).toBe(false);
  });
});

// ── PKCE ──────────────────────────────────────────────────────────

describe('PKCE generators', () => {
  it('generateCodeVerifier returns 43-character base64url-alphabet string', () => {
    const verifier = generateCodeVerifier(deterministicRandom());
    expect(verifier).toHaveLength(43);
    expect(/^[A-Za-z0-9_-]+$/.test(verifier)).toBe(true);
  });

  it('computeCodeChallenge returns SHA-256 base64url of the verifier', async () => {
    const verifier = 'fixed-verifier-string';
    const challenge = await computeCodeChallenge(verifier, nodeSha256);
    // Recompute manually to prove the wiring.
    const expected = base64UrlEncode(new Uint8Array(createHash('sha256').update(verifier).digest()));
    expect(challenge).toBe(expected);
    // And the output contains only the base64url alphabet — no padding.
    expect(/^[A-Za-z0-9_-]+$/.test(challenge)).toBe(true);
  });

  it('base64UrlEncode strips padding and maps +// to -/_', () => {
    // 0xfb 0xef 0xfe → base64 "++/+", base64url "-_", zero-padding stripped.
    const bytes = new Uint8Array([0xfb, 0xef, 0xfe]);
    expect(base64UrlEncode(bytes)).toBe('--_-');
  });

  it('generateCredentialRef prefixes with oauth2-cred-', () => {
    const ref = generateCredentialRef(deterministicRandom());
    expect(ref.startsWith('oauth2-cred-')).toBe(true);
    expect(ref.length).toBe('oauth2-cred-'.length + 8);
  });
});
