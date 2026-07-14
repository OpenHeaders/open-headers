/**
 * OAuth refresh runner — the host-neutral refresh_token leg, tested
 * over a stubbed global fetch with the token store mocked. Pins the
 * POST shape (grant + body client auth vs basic-header), the
 * refresh-endpoint fallback, the refresh-token carry-forward, the
 * store persistence, and the hook's failure mapping (recoverable →
 * null, unexpected → propagate).
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRefreshOAuthHook,
  OAuth2RefreshError,
  performRefresh,
} from '../../../src/live/request-exec/oauth-refresh';
import { __resetRateLimiterForTests } from '../../../src/live/request-exec/rate-limiter';

const store = vi.hoisted(() => ({
  getTokenBundle: vi.fn(),
  putTokenBundle: vi.fn(async () => {}),
}));
vi.mock('../../../src/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => store.getTokenBundle(...(args as [])),
  putTokenBundle: (...args: unknown[]) => store.putTokenBundle(...(args as [])),
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function makeAuth(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'cred-1',
    flow: 'authorization-code-pkce',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-1',
    scopes: [],
    ...overrides,
  };
}

function makeBundle(overrides: Partial<OAuth2TokenBundle> = {}): OAuth2TokenBundle {
  return {
    accessToken: 'at-stale',
    refreshToken: 'rt-1',
    tokenType: 'Bearer',
    expiresAt: Date.now() - 1000,
    issuedAt: Date.now() - 3_600_000,
    scope: '',
    ...overrides,
  };
}

function tokenResponse(json: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimiterForTests();
  store.getTokenBundle.mockResolvedValue(makeBundle());
  fetchMock.mockResolvedValue(tokenResponse({ access_token: 'at-fresh', expires_in: 3600 }));
});

afterEach(() => {
  __resetRateLimiterForTests();
});

describe('performRefresh', () => {
  it('POSTs the refresh grant to the token endpoint and persists the fresh bundle', async () => {
    const bundle = await performRefresh(makeAuth(), 'ws-1');
    expect(bundle.accessToken).toBe('at-fresh');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://auth.openheaders.io/token');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect((init.headers as Record<string, string>).Accept).toBe('application/json');
    const body = init.body as URLSearchParams;
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt-1');
    expect(body.get('client_id')).toBe('client-1');

    expect(store.getTokenBundle).toHaveBeenCalledWith('cred-1', 'ws-1');
    expect(store.putTokenBundle).toHaveBeenCalledOnce();
    const [ref, put, config, wsId] = store.putTokenBundle.mock.calls[0] as unknown as [
      string,
      OAuth2TokenBundle,
      unknown,
      string,
    ];
    expect(ref).toBe('cred-1');
    expect(put.accessToken).toBe('at-fresh');
    expect(config).toMatchObject({ credentialRef: 'cred-1' });
    expect(wsId).toBe('ws-1');
  });

  it('carries the prior refresh token forward when the provider omits one', async () => {
    const bundle = await performRefresh(makeAuth());
    expect(bundle.refreshToken).toBe('rt-1');
  });

  it('keeps a provider-rotated refresh token', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ access_token: 'at-fresh', refresh_token: 'rt-2' }));
    const bundle = await performRefresh(makeAuth());
    expect(bundle.refreshToken).toBe('rt-2');
  });

  it('prefers the config refreshEndpoint over the token endpoint', async () => {
    await performRefresh(makeAuth({ refreshEndpoint: 'https://auth.openheaders.io/refresh' }));
    expect(fetchMock.mock.calls[0][0]).toBe('https://auth.openheaders.io/refresh');
  });

  it('moves client credentials into the Basic header under basic-header auth', async () => {
    await performRefresh(makeAuth({ clientAuthentication: 'basic-header', clientSecret: 's3cret' }));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    const body = init.body as URLSearchParams;
    expect(body.get('client_id')).toBeNull();
    expect(body.get('client_secret')).toBeNull();
  });

  it('throws OAuth2RefreshError when no refresh token is stored', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle({ refreshToken: undefined }));
    await expect(performRefresh(makeAuth())).rejects.toBeInstanceOf(OAuth2RefreshError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws OAuth2RefreshError on a non-2xx token response, naming the status', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ error: 'invalid_grant' }, 400));
    await expect(performRefresh(makeAuth())).rejects.toThrow(/Token endpoint returned 400/);
    expect(store.putTokenBundle).not.toHaveBeenCalled();
  });

  it('throws OAuth2RefreshError on a non-JSON body', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway</html>', { status: 200 }));
    await expect(performRefresh(makeAuth())).rejects.toThrow(/non-JSON body/);
  });

  it('throws OAuth2RefreshError when the response parses but carries no access_token', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ token_type: 'Bearer' }));
    await expect(performRefresh(makeAuth())).rejects.toThrow(/Failed to parse token response/);
  });
});

describe('buildRefreshOAuthHook', () => {
  it('returns the fresh bundle bound to the given workspace', async () => {
    const hook = buildRefreshOAuthHook('ws-9');
    const bundle = await hook(makeAuth());
    expect(bundle?.accessToken).toBe('at-fresh');
    expect(store.getTokenBundle).toHaveBeenCalledWith('cred-1', 'ws-9');
  });

  it('maps a recoverable refresh failure to null — the stale bundle attaches', async () => {
    fetchMock.mockResolvedValue(tokenResponse({ error: 'invalid_grant' }, 400));
    const hook = buildRefreshOAuthHook(undefined);
    await expect(hook(makeAuth())).resolves.toBeNull();
  });

  it('propagates unexpected errors as fetch-phase failures', async () => {
    store.putTokenBundle.mockRejectedValue(new Error('sync service not initialized'));
    const hook = buildRefreshOAuthHook(undefined);
    await expect(hook(makeAuth())).rejects.toThrow('sync service not initialized');
  });
});
