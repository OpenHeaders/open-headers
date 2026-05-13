/**
 * oauth-flow — Authorization Code + PKCE, Client Credentials,
 * Refresh Token runners. We mock `chrome.identity.launchWebAuthFlow`
 * + `fetch` + the token-store's `putTokenBundle` + `getTokenBundle`
 * so each flow is exercised end-to-end without touching real network
 * or storage.
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const launchMock = vi.fn();
const getRedirectUrlMock = vi.fn(() => 'https://test-ext.chromiumapp.org/');
const putTokenBundleMock = vi.fn();
const getTokenBundleMock = vi.fn();

vi.mock('@utils/browser-api', () => ({
  identity: {
    isAvailable: () => true,
    launchWebAuthFlow: launchMock,
    getRedirectURL: getRedirectUrlMock,
  },
  runtime: { lastError: null },
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  putTokenBundle: putTokenBundleMock,
  getTokenBundle: getTokenBundleMock,
}));

vi.mock('@/shared/fetch/with-host-access', () => ({
  withHostAccess: (_url: string, fn: () => Promise<Response>) => fn(),
}));

// The shared refresh rate limiter is module-state; without a reset it
// leaks its minute-window across every test in this file and the 6th
// refresh against auth.openheaders.io waits the full 60s for budget.
// Import the limiter DIRECTLY from its submodule so we don't pull in
// `scheduler.ts`'s `@utils/browser-api` import chain at test-file load
// — that chain hits the hoisted mock factory before `launchMock` is
// bound.
import { __resetRateLimiterForTests } from '@/background/modules/refresh-scheduler/rate-limiter';

vi.stubGlobal('fetch', fetchMock);

const makeConfig = (overrides: Partial<OAuth2Auth> = {}): OAuth2Auth => ({
  type: 'oauth2',
  credentialRef: 'oauth2-cred-test',
  flow: 'authorization-code-pkce',
  authorizationEndpoint: 'https://auth.openheaders.io/authorize',
  tokenEndpoint: 'https://auth.openheaders.io/token',
  clientId: 'client-123',
  scopes: ['read'],
  ...overrides,
});

// ── ArrayBuffer → Response helper ────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  launchMock.mockReset();
  putTokenBundleMock.mockReset();
  getTokenBundleMock.mockReset();
  __resetRateLimiterForTests();
  // Default: return a successful token response.
  fetchMock.mockResolvedValue(
    jsonResponse({ access_token: 'at-new', token_type: 'Bearer', expires_in: 3600, refresh_token: 'rf-new' }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Authorization Code + PKCE ────────────────────────────────────

describe('launchAuthorizationCodeFlow', () => {
  it('exchanges the redirect code for a token bundle and persists it', async () => {
    launchMock.mockImplementation(async (options: { url: string }) => {
      // Pull state out of the authorization URL and echo it back
      // alongside a code in the redirect — the runner verifies
      // state round-trip to reject CSRF.
      const url = new URL(options.url);
      const state = url.searchParams.get('state') ?? '';
      return `https://test-ext.chromiumapp.org/?code=auth-code-xyz&state=${state}`;
    });

    const { launchAuthorizationCodeFlow } = await import('@/background/modules/oauth-flow');
    const result = await launchAuthorizationCodeFlow(makeConfig());

    expect(result.bundle.accessToken).toBe('at-new');
    expect(result.bundle.refreshToken).toBe('rf-new');
    expect(result.redirectUri).toBe('https://test-ext.chromiumapp.org/');
    expect(putTokenBundleMock).toHaveBeenCalledWith(
      'oauth2-cred-test',
      expect.objectContaining({ accessToken: 'at-new' }),
      expect.objectContaining({ type: 'oauth2', credentialRef: 'oauth2-cred-test' }),
      undefined,
    );

    // Verify the token-endpoint POST carried the PKCE verifier.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [tokenUrl, init] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe('https://auth.openheaders.io/token');
    expect((init as RequestInit).method).toBe('POST');
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('auth-code-xyz');
    expect(body.get('code_verifier')).toBeTruthy();
  });

  it('rejects when the redirect omits the code', async () => {
    launchMock.mockResolvedValue('https://test-ext.chromiumapp.org/?state=anything');
    const { launchAuthorizationCodeFlow, OAuth2FlowError } = await import('@/background/modules/oauth-flow');
    await expect(launchAuthorizationCodeFlow(makeConfig())).rejects.toBeInstanceOf(OAuth2FlowError);
    expect(putTokenBundleMock).not.toHaveBeenCalled();
  });

  it('rejects when state does not round-trip (CSRF guard)', async () => {
    launchMock.mockResolvedValue('https://test-ext.chromiumapp.org/?code=c&state=stale');
    const { launchAuthorizationCodeFlow } = await import('@/background/modules/oauth-flow');
    await expect(launchAuthorizationCodeFlow(makeConfig())).rejects.toThrow(/state parameter did not round-trip/);
    expect(putTokenBundleMock).not.toHaveBeenCalled();
  });

  it('rejects when the provider returned error in the redirect', async () => {
    launchMock.mockResolvedValue(
      'https://test-ext.chromiumapp.org/?error=access_denied&error_description=user%20cancelled',
    );
    const { launchAuthorizationCodeFlow } = await import('@/background/modules/oauth-flow');
    await expect(launchAuthorizationCodeFlow(makeConfig())).rejects.toThrow(/access_denied/);
  });

  it('bubbles up a descriptive error when the token endpoint returns non-2xx', async () => {
    launchMock.mockImplementation(async (options: { url: string }) => {
      const url = new URL(options.url);
      const state = url.searchParams.get('state') ?? '';
      return `https://test-ext.chromiumapp.org/?code=abc&state=${state}`;
    });
    fetchMock.mockResolvedValue(new Response('invalid client', { status: 400, statusText: 'Bad Request' }));
    const { launchAuthorizationCodeFlow } = await import('@/background/modules/oauth-flow');
    await expect(launchAuthorizationCodeFlow(makeConfig())).rejects.toThrow(/Token endpoint returned 400/);
  });
});

// ── Client Credentials ───────────────────────────────────────────

describe('performClientCredentialsFlow', () => {
  it('POSTs grant_type=client_credentials + client_secret and stores the bundle', async () => {
    const { performClientCredentialsFlow } = await import('@/background/modules/oauth-flow');
    const result = await performClientCredentialsFlow(makeConfig({ flow: 'client-credentials', clientSecret: 'shhh' }));
    expect(result.accessToken).toBe('at-new');
    expect(putTokenBundleMock).toHaveBeenCalledWith(
      'oauth2-cred-test',
      expect.objectContaining({ accessToken: 'at-new' }),
      expect.objectContaining({ type: 'oauth2', flow: 'client-credentials' }),
      undefined,
    );
    const [, init] = fetchMock.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get('grant_type')).toBe('client_credentials');
    expect(body.get('client_secret')).toBe('shhh');
  });

  it('rejects when flow !== client-credentials', async () => {
    const { performClientCredentialsFlow } = await import('@/background/modules/oauth-flow');
    await expect(performClientCredentialsFlow(makeConfig())).rejects.toThrow(/flow=client-credentials/);
  });
});

// ── Refresh Token ────────────────────────────────────────────────

describe('performRefresh', () => {
  it('POSTs grant_type=refresh_token using the stored refresh token', async () => {
    const current: OAuth2TokenBundle = {
      accessToken: 'at-old',
      refreshToken: 'rf-old',
      tokenType: 'Bearer',
      scope: 'read',
      issuedAt: 1,
      expiresAt: 2,
    };
    getTokenBundleMock.mockResolvedValue(current);
    const { performRefresh } = await import('@/background/modules/oauth-flow');
    const result = await performRefresh(makeConfig());
    expect(result.accessToken).toBe('at-new');
    const [, init] = fetchMock.mock.calls[0];
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rf-old');
  });

  it('carries the old refresh_token forward when the provider omits it on refresh', async () => {
    const current: OAuth2TokenBundle = {
      accessToken: 'at-old',
      refreshToken: 'rf-persist',
      tokenType: 'Bearer',
      scope: 'read',
      issuedAt: 1,
      expiresAt: 2,
    };
    getTokenBundleMock.mockResolvedValue(current);
    fetchMock.mockResolvedValue(jsonResponse({ access_token: 'at-new', expires_in: 3600 }));
    const { performRefresh } = await import('@/background/modules/oauth-flow');
    const result = await performRefresh(makeConfig());
    expect(result.refreshToken).toBe('rf-persist');
    expect(putTokenBundleMock).toHaveBeenCalledWith(
      'oauth2-cred-test',
      expect.objectContaining({ refreshToken: 'rf-persist' }),
      expect.objectContaining({ type: 'oauth2' }),
      undefined,
    );
  });

  it('rejects when no refresh_token is stored', async () => {
    getTokenBundleMock.mockResolvedValue({
      accessToken: 'at-old',
      tokenType: 'Bearer',
      scope: '',
      issuedAt: 1,
      expiresAt: 2,
    });
    const { performRefresh } = await import('@/background/modules/oauth-flow');
    await expect(performRefresh(makeConfig())).rejects.toThrow(/No refresh_token available/);
  });

  it('POSTs to refreshEndpoint when the config overrides it (Okta-style distinct endpoint)', async () => {
    const current: OAuth2TokenBundle = {
      accessToken: 'at-old',
      refreshToken: 'rf-old',
      tokenType: 'Bearer',
      scope: 'read',
      issuedAt: 1,
      expiresAt: 2,
    };
    getTokenBundleMock.mockResolvedValue(current);
    const { performRefresh } = await import('@/background/modules/oauth-flow');
    await performRefresh(makeConfig({ refreshEndpoint: 'https://auth.openheaders.io/oauth/refresh' }));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('https://auth.openheaders.io/oauth/refresh');
  });

  it('attaches Authorization: Basic header when clientAuthentication = basic-header', async () => {
    const current: OAuth2TokenBundle = {
      accessToken: 'at-old',
      refreshToken: 'rf-old',
      tokenType: 'Bearer',
      scope: 'read',
      issuedAt: 1,
      expiresAt: 2,
    };
    getTokenBundleMock.mockResolvedValue(current);
    const { performRefresh } = await import('@/background/modules/oauth-flow');
    await performRefresh(makeConfig({ clientAuthentication: 'basic-header', clientSecret: 'shh' }));
    const [, init] = fetchMock.mock.calls[0];
    const authHeader = (init as RequestInit).headers as Record<string, string>;
    // base64("client-123:shh") = Y2xpZW50LTEyMzpzaGg=
    expect(authHeader.Authorization).toBe('Basic Y2xpZW50LTEyMzpzaGg=');
    const body = (init as RequestInit).body as URLSearchParams;
    expect(body.has('client_id')).toBe(false);
    expect(body.has('client_secret')).toBe(false);
  });
});
