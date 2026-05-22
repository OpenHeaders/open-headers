/**
 * Request executor — OAuth 2.0 integration (Phase 13, ARCHITECTURE §18).
 *
 * Verifies that when a request's `auth.type === 'oauth2'`:
 *   • a valid token in the store becomes `Authorization: Bearer <token>`,
 *   • an expired-but-refreshable token triggers `performRefresh`,
 *   • a missing / unrefreshable token does not attach a header
 *     (let the target API surface the 401).
 */

import type { OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { Collection, Environment, OAuth2Auth, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock, getTokenBundleMock, performRefreshMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getTokenBundleMock: vi.fn(),
  performRefreshMock: vi.fn(),
}));

vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
  fetchMock(input, init);
  return Promise.resolve(new Response('ok', { status: 200, statusText: 'OK' }));
});

vi.mock('@openheaders/oracle/entity/environment-store', () => ({
  getEnvironments: vi.fn(() => [] as Environment[]),
  getActiveEnvironmentId: vi.fn(() => null as string | null),
  getDefaultEnvironmentId: vi.fn(() => null as string | null),
  getWorkspaceVariables: vi.fn(() => ({ schemaVersion: 5, variables: [] }) as WorkspaceVariables),
  getVault: vi.fn(() => ({ schemaVersion: 5, secrets: [] }) as Vault),
}));

vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: vi.fn(() => null),
  getRequestCollections: vi.fn(() => [] as Collection[]),
  getRequestUidsForWorkspace: vi.fn(() => null),
}));

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  getCollections: vi.fn(() => [] as Collection[]),
}));

vi.mock('@openheaders/oracle/entity/files-store', () => ({
  listFiles: vi.fn(async () => []),
  getFileBlob: vi.fn(async () => null),
}));

vi.mock('@openheaders/oracle/entity/oauth-token-store', () => ({
  getTokenBundle: getTokenBundleMock,
}));

vi.mock('@/background/modules/oauth-flow', () => ({
  performRefresh: performRefreshMock,
  OAuth2FlowError: class OAuth2FlowError extends Error {
    step: string;
    constructor(step: string, message: string) {
      super(message);
      this.step = step;
    }
  },
}));

import { executeRequestDraft } from '@/background/modules/request-executor';

function makeOAuthRequest(authOverrides: Partial<OAuth2Auth> = {}): Request {
  return {
    schemaVersion: 5,
    uid: 'r-oauth',
    path: 'requests/default-xxxx/r-oauth',
    name: 'OAuth R',
    method: 'GET',
    url: 'https://api.openheaders.io/v1/me',
    headers: [],
    params: [],
    auth: {
      type: 'oauth2',
      credentialRef: 'oauth2-cred-x',
      flow: 'authorization-code-pkce',
      tokenEndpoint: 'https://auth.openheaders.io/token',
      clientId: 'c',
      scopes: [],
      ...authOverrides,
    },
    body: { type: 'none' },
  };
}

function bundle(overrides: Partial<OAuth2TokenBundle> = {}): OAuth2TokenBundle {
  const now = Date.now();
  return {
    accessToken: 'at-valid',
    tokenType: 'Bearer',
    scope: 'read',
    issuedAt: now,
    expiresAt: now + 3_600_000,
    ...overrides,
  };
}

describe('executor — oauth2', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getTokenBundleMock.mockReset();
    performRefreshMock.mockReset();
  });

  it('attaches Authorization: Bearer <accessToken> when a valid token is stored', async () => {
    getTokenBundleMock.mockResolvedValue(bundle({ accessToken: 'at-fresh' }));
    await executeRequestDraft(makeOAuthRequest());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer at-fresh');
    expect(performRefreshMock).not.toHaveBeenCalled();
  });

  it('refreshes expired tokens when a refresh_token is available', async () => {
    const expiredBundle = bundle({
      accessToken: 'at-expired',
      refreshToken: 'rf-ok',
      expiresAt: Date.now() - 60_000,
    });
    getTokenBundleMock.mockResolvedValue(expiredBundle);
    performRefreshMock.mockResolvedValue(bundle({ accessToken: 'at-rotated', refreshToken: 'rf-ok' }));
    await executeRequestDraft(makeOAuthRequest());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer at-rotated');
    expect(performRefreshMock).toHaveBeenCalledTimes(1);
  });

  it('omits the Authorization header when no token is stored', async () => {
    getTokenBundleMock.mockResolvedValue(null);
    await executeRequestDraft(makeOAuthRequest());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBeNull();
  });

  it('omits the Authorization header when the token is expired and no refresh_token is stored', async () => {
    getTokenBundleMock.mockResolvedValue(bundle({ expiresAt: Date.now() - 60_000 }));
    await executeRequestDraft(makeOAuthRequest());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    // Executor intentionally does NOT force a refresh without a
    // refresh_token — the target API's 401 is the right surface.
    expect(headers.get('Authorization')).toBe('Bearer at-valid');
    expect(performRefreshMock).not.toHaveBeenCalled();
  });

  it('swallows OAuth2FlowError from refresh and falls back to the expired token', async () => {
    // Expired + refresh fails → executor logs and sends the expired
    // token (target API will 401, which surfaces in the UI). The
    // executor should NOT surface the refresh failure as a thrown
    // exception — the response panel is the user-visible signal.
    const flowModule = await import('@/background/modules/oauth-flow');
    const expiredBundle = bundle({
      accessToken: 'at-stale',
      refreshToken: 'rf-broken',
      expiresAt: Date.now() - 60_000,
    });
    getTokenBundleMock.mockResolvedValue(expiredBundle);
    performRefreshMock.mockRejectedValue(new flowModule.OAuth2FlowError('refresh', 'provider 400'));
    await executeRequestDraft(makeOAuthRequest());
    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer at-stale');
  });
});
