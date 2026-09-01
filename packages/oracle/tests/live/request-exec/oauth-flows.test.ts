/**
 * OAuth token-acquisition flows — the host-neutral legs behind "Get new
 * access token", tested over a stubbed RequestTransport with the token
 * store mocked. Pins the client-credentials and password POST shapes
 * (grant + body client auth vs basic-header), the authorization-code
 * leg through a stub launcher (the authorize URL's redirect_uri /
 * state / S256 challenge — recomputed with node:crypto from the
 * verifier the exchange body carries — the code + verifier +
 * redirect_uri exchange, the persisted bundle), the plain code grant
 * without PKCE, and the refusals: state mismatch, provider error,
 * missing code, a launcher that never completes, a wrong flow.
 */

import { createHash } from 'node:crypto';
import type { OAuth2Auth } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OAuth2FlowError } from '../../../src/live/request-exec/oauth-exchange';
import {
  performAuthorizationCodeFlow,
  performClientCredentialsFlow,
  performPasswordCredentialsFlow,
} from '../../../src/live/request-exec/oauth-flows';
import { __resetRateLimiterForTests } from '../../../src/live/request-exec/rate-limiter';
import type { RequestTransport, TransportRequest, TransportResponse } from '../../../src/live/request-exec/transport';

const store = vi.hoisted(() => ({
  putTokenBundle: vi.fn(async () => {}),
}));

vi.mock('../../../src/entity/oauth-token-store', () => ({
  putTokenBundle: (...args: unknown[]) => store.putTokenBundle(...(args as [])),
}));

const sendMock = vi.fn<(request: TransportRequest) => Promise<TransportResponse>>();
const transport: RequestTransport = { send: (request) => sendMock(request) };

const REDIRECT_URI = 'http://127.0.0.1:8137/oauth/callback';

function makeAuth(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'cred-1',
    flow: 'authorization-code-pkce',
    authorizationEndpoint: 'https://auth.openheaders.io/authorize',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-1',
    clientSecret: 'secret-1',
    scopes: ['read'],
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

const FRESH = JSON.stringify({
  access_token: 'at-fresh',
  token_type: 'Bearer',
  expires_in: 3600,
  refresh_token: 'rt-1',
});

function bodyFields(request: TransportRequest): Record<string, string> {
  if (request.body.kind !== 'urlencoded') throw new Error(`expected urlencoded body, got ${request.body.kind}`);
  return Object.fromEntries(request.body.fields.map((f) => [f.name, f.value]));
}

/** A launcher that answers the redirect the provider would send after
 *  a successful login, echoing the state it was given. */
function acceptingLauncher(seen: { authUrl?: string; state?: string }) {
  return async (authUrl: string, state: string) => {
    seen.authUrl = authUrl;
    seen.state = state;
    return `${REDIRECT_URI}?code=code-1&state=${state}`;
  };
}

beforeEach(() => {
  __resetRateLimiterForTests();
  sendMock.mockReset();
  store.putTokenBundle.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('performClientCredentialsFlow', () => {
  it('POSTs the client_credentials grant with the client pair in the body and persists the bundle', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    const auth = makeAuth({ flow: 'client-credentials' });
    const bundle = await performClientCredentialsFlow(auth, 'ws-1', transport);
    expect(bundle.accessToken).toBe('at-fresh');
    const request = sendMock.mock.calls[0]![0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://auth.openheaders.io/token');
    expect(bodyFields(request)).toMatchObject({
      grant_type: 'client_credentials',
      client_id: 'client-1',
      client_secret: 'secret-1',
    });
    expect(store.putTokenBundle).toHaveBeenCalledWith('cred-1', bundle, auth, 'ws-1');
  });

  it('basic-header client authentication moves the pair onto Authorization', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    await performClientCredentialsFlow(
      makeAuth({ flow: 'client-credentials', clientAuthentication: 'basic-header' }),
      undefined,
      transport,
    );
    const request = sendMock.mock.calls[0]![0];
    expect(bodyFields(request)).not.toHaveProperty('client_secret');
    expect(request.headers.find((h) => h.key === 'Authorization')?.value).toBe(
      `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
    );
  });

  it('refuses a config of another flow before any wire activity', async () => {
    await expect(performClientCredentialsFlow(makeAuth(), undefined, transport)).rejects.toBeInstanceOf(
      OAuth2FlowError,
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('a refused exchange surfaces as a client_credentials step failure', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse('{"error":"invalid_client"}', 400));
    await expect(
      performClientCredentialsFlow(makeAuth({ flow: 'client-credentials' }), undefined, transport),
    ).rejects.toMatchObject({
      step: 'client_credentials',
      message: expect.stringContaining('400'),
    });
    expect(store.putTokenBundle).not.toHaveBeenCalled();
  });
});

describe('performPasswordCredentialsFlow', () => {
  it('POSTs the password grant with the resource-owner credentials and persists the bundle', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    const auth = makeAuth({ flow: 'password-credentials', username: 'alice@openheaders.io', password: 'p4ssw0rd' });
    const bundle = await performPasswordCredentialsFlow(auth, 'ws-1', transport);
    expect(bodyFields(sendMock.mock.calls[0]![0])).toMatchObject({
      grant_type: 'password',
      username: 'alice@openheaders.io',
      password: 'p4ssw0rd',
      client_id: 'client-1',
    });
    expect(store.putTokenBundle).toHaveBeenCalledWith('cred-1', bundle, auth, 'ws-1');
  });
});

describe('performAuthorizationCodeFlow', () => {
  it('opens the authorize URL, exchanges the code with the PKCE verifier, and persists the bundle', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    const seen: { authUrl?: string; state?: string } = {};
    const auth = makeAuth();
    const result = await performAuthorizationCodeFlow(auth, 'ws-1', transport, {
      redirectUri: REDIRECT_URI,
      launch: acceptingLauncher(seen),
    });
    expect(result.redirectUri).toBe(REDIRECT_URI);
    expect(result.bundle.accessToken).toBe('at-fresh');

    const authUrl = new URL(seen.authUrl!);
    expect(`${authUrl.origin}${authUrl.pathname}`).toBe('https://auth.openheaders.io/authorize');
    expect(authUrl.searchParams.get('response_type')).toBe('code');
    expect(authUrl.searchParams.get('client_id')).toBe('client-1');
    expect(authUrl.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(authUrl.searchParams.get('scope')).toBe('read');
    expect(authUrl.searchParams.get('state')).toBe(seen.state);
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');

    const exchange = bodyFields(sendMock.mock.calls[0]![0]);
    expect(exchange).toMatchObject({
      grant_type: 'authorization_code',
      code: 'code-1',
      redirect_uri: REDIRECT_URI,
      client_id: 'client-1',
      client_secret: 'secret-1',
    });
    // The challenge on the authorize leg is the S256 of the verifier the
    // exchange carried — recomputed independently.
    const expectedChallenge = createHash('sha256').update(exchange.code_verifier!).digest('base64url');
    expect(authUrl.searchParams.get('code_challenge')).toBe(expectedChallenge);
    expect(store.putTokenBundle).toHaveBeenCalledWith('cred-1', result.bundle, auth, 'ws-1');
  });

  it('the plain authorization-code grant sends no PKCE pair on either leg', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    const seen: { authUrl?: string; state?: string } = {};
    await performAuthorizationCodeFlow(makeAuth({ grantType: 'authorization-code' }), undefined, transport, {
      redirectUri: REDIRECT_URI,
      launch: acceptingLauncher(seen),
    });
    expect(new URL(seen.authUrl!).searchParams.has('code_challenge')).toBe(false);
    expect(bodyFields(sendMock.mock.calls[0]![0])).not.toHaveProperty('code_verifier');
  });

  it('refuses a redirect whose state does not round-trip, without exchanging', async () => {
    await expect(
      performAuthorizationCodeFlow(makeAuth(), undefined, transport, {
        redirectUri: REDIRECT_URI,
        launch: async () => `${REDIRECT_URI}?code=code-1&state=forged`,
      }),
    ).rejects.toMatchObject({ step: 'authorize', message: expect.stringContaining('state') });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("surfaces the provider's error from the redirect", async () => {
    await expect(
      performAuthorizationCodeFlow(makeAuth(), undefined, transport, {
        redirectUri: REDIRECT_URI,
        launch: async (_url, state) =>
          `${REDIRECT_URI}?error=access_denied&error_description=User%20refused&state=${state}`,
      }),
    ).rejects.toMatchObject({ step: 'authorize', message: 'Provider returned error: access_denied User refused' });
  });

  it('a redirect without a code is refused', async () => {
    await expect(
      performAuthorizationCodeFlow(makeAuth(), undefined, transport, {
        redirectUri: REDIRECT_URI,
        launch: async (_url, state) => `${REDIRECT_URI}?state=${state}`,
      }),
    ).rejects.toMatchObject({ step: 'authorize', message: expect.stringContaining('authorization code') });
  });

  it('a launcher that fails maps to an authorize step failure', async () => {
    await expect(
      performAuthorizationCodeFlow(makeAuth(), undefined, transport, {
        redirectUri: REDIRECT_URI,
        launch: async () => {
          throw new Error('no redirect arrived within 5 minutes');
        },
      }),
    ).rejects.toMatchObject({ step: 'authorize', message: expect.stringContaining('no redirect arrived') });
  });

  it('refuses a config of another flow before launching', async () => {
    const launch = vi.fn(async () => REDIRECT_URI);
    await expect(
      performAuthorizationCodeFlow(makeAuth({ flow: 'client-credentials' }), undefined, transport, {
        redirectUri: REDIRECT_URI,
        launch,
      }),
    ).rejects.toMatchObject({ step: 'precondition' });
    expect(launch).not.toHaveBeenCalled();
  });
});
