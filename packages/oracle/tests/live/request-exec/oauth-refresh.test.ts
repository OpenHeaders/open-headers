/**
 * OAuth refresh runner — the host-neutral refresh_token leg, tested
 * over a stubbed RequestTransport with the token store mocked. Pins
 * the POST shape (grant + body client auth vs basic-header), the
 * transport-seam ride (request plane unset so the environment plane
 * resolves the route), the refresh-endpoint fallback, the
 * refresh-token carry-forward, the store persistence, and the hook's
 * failure mapping (recoverable → null, unexpected → propagate).
 */

import { generateDpopKey, type OAuth2TokenBundle } from '@openheaders/core/oauth';
import type { OAuth2Auth } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDpopNoncesForTests } from '../../../src/live/request-exec/dpop-nonces';
import {
  buildRefreshOAuthHook,
  OAuth2RefreshError,
  performRefresh,
  refreshCredential,
} from '../../../src/live/request-exec/oauth-refresh';
import { __resetRateLimiterForTests } from '../../../src/live/request-exec/rate-limiter';
import {
  type RequestTransport,
  TransportError,
  type TransportRequest,
  type TransportResponse,
} from '../../../src/live/request-exec/transport';

const store = vi.hoisted(() => ({
  getTokenBundle: vi.fn(),
  putTokenBundle: vi.fn(async () => {}),
}));
vi.mock('../../../src/entity/oauth-token-store', () => ({
  getTokenBundle: (...args: unknown[]) => store.getTokenBundle(...(args as [])),
  putTokenBundle: (...args: unknown[]) => store.putTokenBundle(...(args as [])),
}));

const sendMock = vi.fn<(request: TransportRequest) => Promise<TransportResponse>>();
const transport: RequestTransport = { send: (request) => sendMock(request) };

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

function tokenResponse(body: string, status = 200): TransportResponse {
  return {
    status,
    statusText: status === 200 ? 'OK' : 'Bad Request',
    url: 'https://auth.openheaders.io/token',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: body.length,
  };
}

function jsonResponse(json: Record<string, unknown>, status = 200): TransportResponse {
  return tokenResponse(JSON.stringify(json), status);
}

function sentRequest(): TransportRequest {
  return sendMock.mock.calls[0][0];
}

function sentField(name: string): string | null {
  const body = sentRequest().body;
  if (body.kind !== 'urlencoded') return null;
  return body.fields.find((f) => f.name === name)?.value ?? null;
}

function sentHeader(key: string): string | null {
  return sentRequest().headers.find((h) => h.key === key)?.value ?? null;
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetRateLimiterForTests();
  store.getTokenBundle.mockResolvedValue(makeBundle());
  sendMock.mockResolvedValue(jsonResponse({ access_token: 'at-fresh', expires_in: 3600 }));
});

afterEach(() => {
  __resetRateLimiterForTests();
});

describe('performRefresh', () => {
  it('POSTs the refresh grant to the token endpoint and persists the fresh bundle', async () => {
    const bundle = await performRefresh(makeAuth(), 'ws-1', transport);
    expect(bundle.accessToken).toBe('at-fresh');

    expect(sendMock).toHaveBeenCalledOnce();
    const sent = sentRequest();
    expect(sent.url).toBe('https://auth.openheaders.io/token');
    expect(sent.method).toBe('POST');
    expect(sent.body.kind).toBe('urlencoded');
    expect(sentHeader('Accept')).toBe('application/json');
    expect(sentField('grant_type')).toBe('refresh_token');
    expect(sentField('refresh_token')).toBe('rt-1');
    expect(sentField('client_id')).toBe('client-1');

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

  it('leaves the request plane unset so the transport resolves the environment plane', async () => {
    await performRefresh(makeAuth(), 'ws-1', transport);
    const sent = sentRequest();
    expect(sent.proxyMode).toBeUndefined();
    expect(sent.proxyUrl).toBeUndefined();
    expect(sent.redirect).toBe('follow');
    expect(sent.credentials).toBe('omit');
  });

  it('carries the prior refresh token forward when the provider omits one', async () => {
    const bundle = await performRefresh(makeAuth(), undefined, transport);
    expect(bundle.refreshToken).toBe('rt-1');
  });

  it('keeps a provider-rotated refresh token', async () => {
    sendMock.mockResolvedValue(jsonResponse({ access_token: 'at-fresh', refresh_token: 'rt-2' }));
    const bundle = await performRefresh(makeAuth(), undefined, transport);
    expect(bundle.refreshToken).toBe('rt-2');
  });

  it('prefers the config refreshEndpoint over the token endpoint', async () => {
    await performRefresh(makeAuth({ refreshEndpoint: 'https://auth.openheaders.io/refresh' }), undefined, transport);
    expect(sentRequest().url).toBe('https://auth.openheaders.io/refresh');
  });

  it('routes sendIn-tagged extra refresh params onto the POST headers and endpoint URL', async () => {
    await performRefresh(
      makeAuth({
        extraRefreshParams: [
          { uid: 'extref001', key: 'audience', value: 'https://api.openheaders.io', sendIn: 'url' },
          { uid: 'extref002', key: 'X-Gateway-Key', value: 'gw-secret', sendIn: 'header' },
          { uid: 'extref003', key: 'tenant', value: 'oh' },
        ],
      }),
      undefined,
      transport,
    );
    const sent = sentRequest();
    expect(new URL(sent.url).searchParams.get('audience')).toBe('https://api.openheaders.io');
    expect(sentHeader('X-Gateway-Key')).toBe('gw-secret');
    // The untagged row keeps today's body ride — and never leaks to the
    // other legs.
    expect(sentField('tenant')).toBe('oh');
    expect(sentField('audience')).toBeNull();
    expect(sentField('X-Gateway-Key')).toBeNull();
  });

  it('moves client credentials into the Basic header under basic-header auth', async () => {
    await performRefresh(
      makeAuth({ clientAuthentication: 'basic-header', clientSecret: 's3cret' }),
      undefined,
      transport,
    );
    expect(sentHeader('Authorization')).toMatch(/^Basic /);
    expect(sentField('client_id')).toBeNull();
    expect(sentField('client_secret')).toBeNull();
  });

  it('throws OAuth2RefreshError when no refresh token is stored', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle({ refreshToken: undefined }));
    await expect(performRefresh(makeAuth(), undefined, transport)).rejects.toBeInstanceOf(OAuth2RefreshError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('throws OAuth2RefreshError on a non-2xx token response, naming the status', async () => {
    sendMock.mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, 400));
    await expect(performRefresh(makeAuth(), undefined, transport)).rejects.toThrow(/Token endpoint returned 400/);
    expect(store.putTokenBundle).not.toHaveBeenCalled();
  });

  it('throws OAuth2RefreshError on a non-JSON body', async () => {
    sendMock.mockResolvedValue(tokenResponse('<html>gateway</html>'));
    await expect(performRefresh(makeAuth(), undefined, transport)).rejects.toThrow(/non-JSON body/);
  });

  it('throws OAuth2RefreshError when the response parses but carries no access_token', async () => {
    sendMock.mockResolvedValue(jsonResponse({ token_type: 'Bearer' }));
    await expect(performRefresh(makeAuth(), undefined, transport)).rejects.toThrow(/Failed to parse token response/);
  });
});

describe('buildRefreshOAuthHook', () => {
  it('returns the fresh bundle bound to the given workspace', async () => {
    const hook = buildRefreshOAuthHook('ws-9', transport);
    const bundle = await hook(makeAuth());
    expect(bundle?.accessToken).toBe('at-fresh');
    expect(store.getTokenBundle).toHaveBeenCalledWith('cred-1', 'ws-9');
  });

  it('maps a recoverable refresh failure to null — the stale bundle attaches', async () => {
    sendMock.mockResolvedValue(jsonResponse({ error: 'invalid_grant' }, 400));
    const hook = buildRefreshOAuthHook(undefined, transport);
    await expect(hook(makeAuth())).resolves.toBeNull();
  });

  it('propagates a transport failure of the token leg as a fetch-phase failure', async () => {
    sendMock.mockRejectedValue(new TransportError('Proxy connection refused (proxy.openheaders.io:3128)'));
    const hook = buildRefreshOAuthHook(undefined, transport);
    await expect(hook(makeAuth())).rejects.toThrow('Proxy connection refused');
  });

  it('propagates unexpected errors as fetch-phase failures', async () => {
    store.putTokenBundle.mockRejectedValue(new Error('sync service not initialized'));
    const hook = buildRefreshOAuthHook(undefined, transport);
    await expect(hook(makeAuth())).rejects.toThrow('sync service not initialized');
  });
});

function bodyFields(request: TransportRequest): Record<string, string> {
  if (request.body.kind !== 'urlencoded') throw new Error(`expected urlencoded body, got ${request.body.kind}`);
  return Object.fromEntries(request.body.fields.map((f) => [f.name, f.value]));
}

describe('refreshCredential — the flow-agnostic renewal', () => {
  // The hook suite above leaves the store rejecting; these persist.
  beforeEach(() => store.putTokenBundle.mockImplementation(async () => {}));

  it('uses the refresh_token grant whenever the store holds a refresh token', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle());
    sendMock.mockResolvedValue(tokenResponse(JSON.stringify({ access_token: 'at-fresh', token_type: 'Bearer' })));
    await refreshCredential(makeAuth({ flow: 'client-credentials', clientSecret: 's' }), 'ws-1', transport);
    expect(bodyFields(sendMock.mock.calls[0][0]).grant_type).toBe('refresh_token');
  });

  it('re-runs the client-credentials and password grants when no refresh token exists', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle({ refreshToken: undefined }));
    sendMock.mockResolvedValue(tokenResponse(JSON.stringify({ access_token: 'at-fresh', token_type: 'Bearer' })));
    await refreshCredential(makeAuth({ flow: 'client-credentials', clientSecret: 's' }), 'ws-1', transport);
    expect(bodyFields(sendMock.mock.calls[0][0]).grant_type).toBe('client_credentials');
    await refreshCredential(
      makeAuth({ flow: 'password-credentials', username: 'john.doe', password: 'pw' }),
      'ws-1',
      transport,
    );
    expect(bodyFields(sendMock.mock.calls[1][0]).grant_type).toBe('password');
  });

  it('a code grant without a refresh token stays the refresh error — the user is needed again', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle({ refreshToken: undefined }));
    await expect(refreshCredential(makeAuth(), 'ws-1', transport)).rejects.toBeInstanceOf(OAuth2RefreshError);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('the executor hook re-acquires through the same dispatch', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle({ refreshToken: undefined }));
    sendMock.mockResolvedValue(tokenResponse(JSON.stringify({ access_token: 'at-fresh', token_type: 'Bearer' })));
    const hook = buildRefreshOAuthHook('ws-1', transport);
    const bundle = await hook(makeAuth({ flow: 'client-credentials', clientSecret: 's' }));
    expect(bundle?.accessToken).toBe('at-fresh');
  });
});

describe('performRefresh — client assertion', () => {
  beforeEach(() => store.putTokenBundle.mockImplementation(async () => {}));

  it('client-secret-jwt sends a signed client_assertion on the refresh POST instead of the secret', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle());
    sendMock.mockResolvedValue(tokenResponse(JSON.stringify({ access_token: 'at-fresh', token_type: 'Bearer' })));
    await performRefresh(
      makeAuth({ clientAuthentication: 'client-secret-jwt', clientSecret: 'shh', assertionAlgorithm: 'HS384' }),
      'ws-1',
      transport,
    );
    const fields = bodyFields(sendMock.mock.calls[0][0]);
    expect(fields.grant_type).toBe('refresh_token');
    expect(fields.client_secret).toBeUndefined();
    expect(fields.client_assertion_type).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    const header = JSON.parse(Buffer.from(fields.client_assertion.split('.')[0], 'base64url').toString('utf8'));
    expect(header.alg).toBe('HS384');
  });
});

// ── DPoP (RFC 9449 §5): the refresh proves with the BOUND key ──────

function segment(jwt: string, index: number): Record<string, unknown> {
  return JSON.parse(Buffer.from(jwt.split('.')[index], 'base64url').toString('utf8'));
}

describe('performRefresh — DPoP', () => {
  beforeEach(() => {
    __resetDpopNoncesForTests();
    store.putTokenBundle.mockImplementation(async () => {});
  });

  it('a bound bundle refreshes under the SAME key, and the fresh DPoP token stays bound to it', async () => {
    const key = await generateDpopKey('ES256');
    store.getTokenBundle.mockResolvedValue(makeBundle({ tokenType: 'DPoP', dpop: key }));
    sendMock.mockResolvedValue(jsonResponse({ access_token: 'at-fresh', token_type: 'DPoP', expires_in: 3600 }));
    const bundle = await performRefresh(makeAuth({ tokenBinding: 'dpop' }), 'ws-1', transport);
    const proof = sentHeader('DPoP');
    expect(proof).not.toBeNull();
    expect(segment(proof ?? '', 0).jwk).toEqual(key.publicJwk);
    expect(segment(proof ?? '', 1)).toMatchObject({ htm: 'POST', htu: 'https://auth.openheaders.io/token' });
    expect(bundle.dpop).toBe(key);
    expect(bundle.refreshToken).toBe('rt-1');
  });

  it('a bearer bundle under a config that turned the binding on binds from the refresh with a fresh key', async () => {
    store.getTokenBundle.mockResolvedValue(makeBundle());
    sendMock.mockResolvedValue(jsonResponse({ access_token: 'at-fresh', token_type: 'DPoP', expires_in: 3600 }));
    const bundle = await performRefresh(makeAuth({ tokenBinding: 'dpop' }), 'ws-1', transport);
    expect(sentHeader('DPoP')).not.toBeNull();
    expect(bundle.dpop).toMatchObject({ algorithm: 'ES256' });
  });

  it('a bearer config sends no proof even when a stale key rides the bundle', async () => {
    const key = await generateDpopKey('ES256');
    store.getTokenBundle.mockResolvedValue(makeBundle({ dpop: key }));
    const bundle = await performRefresh(makeAuth(), 'ws-1', transport);
    expect(sentHeader('DPoP')).toBeNull();
    expect(bundle.dpop).toBeUndefined();
  });
});
