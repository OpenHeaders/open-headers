/**
 * Request executor — OAuth 2.0 integration (Phase 13, ARCHITECTURE §18).
 *
 * Verifies that when a request's `auth.type === 'oauth2'`:
 *   • a valid token in the store becomes `Authorization: Bearer <token>`,
 *   • an expired-but-refreshable token triggers `performRefresh`,
 *   • a missing / unrefreshable token does not attach a header
 *     (let the target API surface the 401).
 */

import { createHash, createPublicKey, verify as nodeVerify } from 'node:crypto';
import { generateDpopKey, type OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { Collection, Environment, OAuth2Auth, Request, Vault, WorkspaceVariables } from '@openheaders/core/types';
import { __resetDpopNoncesForTests } from '@openheaders/oracle/live/request-exec/dpop-nonces';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock, getTokenBundleMock, performRefreshMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getTokenBundleMock: vi.fn(),
  performRefreshMock: vi.fn(),
}));

const okFetch = (input: string, init?: RequestInit) => {
  fetchMock(input, init);
  return Promise.resolve(new Response('ok', { status: 200, statusText: 'OK' }));
};
vi.stubGlobal('fetch', okFetch);

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
  refreshCredential: performRefreshMock,
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

  it('a set headerPrefix wins over the bundle token_type on the wire', async () => {
    getTokenBundleMock.mockResolvedValue(bundle({ accessToken: 'at-fresh' }));
    await executeRequestDraft(makeOAuthRequest({ headerPrefix: 'Token' }));
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Token at-fresh');
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
    // A code grant without a refresh_token needs the user again — the
    // executor attaches the stale token and the target API's 401 is
    // the right surface.
    expect(headers.get('Authorization')).toBe('Bearer at-valid');
    expect(performRefreshMock).not.toHaveBeenCalled();
  });

  it.each(['client-credentials', 'password-credentials', 'jwt-bearer'] as const)(
    'an expired %s bundle without a refresh_token re-acquires silently on send',
    async (flow) => {
      getTokenBundleMock.mockResolvedValue(bundle({ accessToken: 'at-stale', expiresAt: Date.now() - 60_000 }));
      performRefreshMock.mockResolvedValue(bundle({ accessToken: 'at-fresh' }));
      await executeRequestDraft(makeOAuthRequest({ flow }));
      const [, init] = fetchMock.mock.calls[0];
      const headers = init.headers as Headers;
      expect(performRefreshMock).toHaveBeenCalledOnce();
      expect(headers.get('Authorization')).toBe('Bearer at-fresh');
    },
  );

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

// ── DPoP-bound bundles (RFC 9449 §7) ──────────────────────────────

describe('executor — oauth2 under DPoP', () => {
  function segment(jwt: string, index: number): Record<string, unknown> {
    return JSON.parse(Buffer.from(jwt.split('.')[index], 'base64url').toString('utf8'));
  }

  function verifiesUnderHeaderJwk(jwt: string): boolean {
    const [h, p, sig] = jwt.split('.');
    const key = createPublicKey({ key: segment(jwt, 0).jwk as Record<string, string>, format: 'jwk' });
    return nodeVerify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      { key, dsaEncoding: 'ieee-p1363' },
      Buffer.from(sig, 'base64url'),
    );
  }

  function proofOf(call: number): string {
    const [, init] = fetchMock.mock.calls[call];
    const proof = (init.headers as Headers).get('DPoP');
    if (proof === null) throw new Error(`fetch call ${call} carried no DPoP header`);
    return proof;
  }

  beforeEach(() => {
    fetchMock.mockReset();
    getTokenBundleMock.mockReset();
    performRefreshMock.mockReset();
    __resetDpopNoncesForTests();
  });

  afterEach(() => {
    vi.stubGlobal('fetch', okFetch);
  });

  it('a bound bundle sends Authorization: DPoP and a proof for this send — htm / htu / ath — ignoring the prefix and query mode', async () => {
    const key = await generateDpopKey('ES256');
    getTokenBundleMock.mockResolvedValue(bundle({ accessToken: 'at-bound', tokenType: 'DPoP', dpop: key }));
    await executeRequestDraft(makeOAuthRequest({ headerPrefix: 'Token', sendAs: 'query' }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openheaders.io/v1/me');
    expect((init.headers as Headers).get('Authorization')).toBe('DPoP at-bound');
    const proof = proofOf(0);
    expect(segment(proof, 0)).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256', jwk: key.publicJwk });
    expect(segment(proof, 1)).toMatchObject({
      htm: 'GET',
      htu: 'https://api.openheaders.io/v1/me',
      ath: createHash('sha256').update('at-bound').digest('base64url'),
    });
    expect(verifiesUnderHeaderJwk(proof)).toBe(true);
  });

  it("answers the resource's use_dpop_nonce challenge once with the issued nonce; the nonce rides the next send", async () => {
    const key = await generateDpopKey('ES256');
    getTokenBundleMock.mockResolvedValue(bundle({ accessToken: 'at-bound', tokenType: 'DPoP', dpop: key }));
    let calls = 0;
    vi.stubGlobal('fetch', (input: string, init?: RequestInit) => {
      fetchMock(input, init);
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(
          new Response('unauthorized', {
            status: 401,
            headers: { 'WWW-Authenticate': 'DPoP error="use_dpop_nonce"', 'DPoP-Nonce': 'n-1' },
          }),
        );
      }
      return Promise.resolve(new Response('ok', { status: 200, statusText: 'OK' }));
    });
    // The wire is the pin here — this file seeds no settings registry,
    // so the snapshot's body path is not asserted.
    await executeRequestDraft(makeOAuthRequest());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(segment(proofOf(0), 1)).not.toHaveProperty('nonce');
    expect(segment(proofOf(1), 1)).toMatchObject({ nonce: 'n-1' });
    await executeRequestDraft(makeOAuthRequest());
    expect(segment(proofOf(2), 1)).toMatchObject({ nonce: 'n-1' });
  });

  it('a Bearer bundle carrying a stale key sends as a bearer with no proof', async () => {
    const key = await generateDpopKey('ES256');
    getTokenBundleMock.mockResolvedValue(bundle({ accessToken: 'at-plain', dpop: key }));
    await executeRequestDraft(makeOAuthRequest());
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer at-plain');
    expect((init.headers as Headers).get('DPoP')).toBeNull();
  });
});
