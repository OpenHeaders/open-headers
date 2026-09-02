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

import { createHash, createPublicKey, generateKeyPairSync, verify as nodeVerify } from 'node:crypto';
import type { OAuth2Auth } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetDpopNoncesForTests, rememberDpopNonce } from '../../../src/live/request-exec/dpop-nonces';
import { OAuth2FlowError } from '../../../src/live/request-exec/oauth-exchange';
import {
  performAuthorizationCodeFlow,
  performClientCredentialsFlow,
  performJwtBearerFlow,
  performPasswordCredentialsFlow,
} from '../../../src/live/request-exec/oauth-flows';
import { __resetRateLimiterForTests, inspectRateLimiter } from '../../../src/live/request-exec/rate-limiter';
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

const p256 = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const P256_PEM = p256.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function segment(jwt: string, index: number): Record<string, unknown> {
  return JSON.parse(Buffer.from(jwt.split('.')[index], 'base64url').toString('utf8'));
}

function verifiesEs256(jwt: string): boolean {
  const [h, p, sig] = jwt.split('.');
  return nodeVerify(
    'sha256',
    Buffer.from(`${h}.${p}`),
    { key: p256.publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(sig, 'base64url'),
  );
}

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

describe('client assertion on the token POST (private_key_jwt / client_secret_jwt)', () => {
  it('private-key-jwt replaces the secret with client_assertion_type + a signed client_assertion, kid in the header', async () => {
    sendMock.mockResolvedValue(tokenResponse(FRESH));
    await performClientCredentialsFlow(
      makeAuth({
        flow: 'client-credentials',
        clientAuthentication: 'private-key-jwt',
        assertionAlgorithm: 'ES256',
        assertionPrivateKey: P256_PEM,
        assertionKeyId: 'key-1',
      }),
      'ws-1',
      transport,
    );
    const fields = bodyFields(sendMock.mock.calls[0][0]);
    expect(fields.grant_type).toBe('client_credentials');
    expect(fields.client_id).toBe('client-1');
    expect(fields.client_secret).toBeUndefined();
    expect(fields.client_assertion_type).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(segment(fields.client_assertion, 0)).toEqual({ typ: 'JWT', kid: 'key-1', alg: 'ES256' });
    expect(segment(fields.client_assertion, 1)).toMatchObject({
      iss: 'client-1',
      sub: 'client-1',
      aud: 'https://auth.openheaders.io/token',
    });
    expect(verifiesEs256(fields.client_assertion)).toBe(true);
    // Never the Basic header.
    expect(sendMock.mock.calls[0][0].headers.some((h) => h.key === 'Authorization')).toBe(false);
  });

  it('client-secret-jwt signs an HS256 assertion keyed by the client secret', async () => {
    sendMock.mockResolvedValue(tokenResponse(FRESH));
    await performClientCredentialsFlow(
      makeAuth({ flow: 'client-credentials', clientAuthentication: 'client-secret-jwt' }),
      'ws-1',
      transport,
    );
    const fields = bodyFields(sendMock.mock.calls[0][0]);
    expect(segment(fields.client_assertion, 0)).toEqual({ typ: 'JWT', alg: 'HS256' });
    expect(fields.client_secret).toBeUndefined();
  });

  it('a signing failure is the step-tagged precondition, before any wire activity', async () => {
    await expect(
      performClientCredentialsFlow(
        makeAuth({ flow: 'client-credentials', clientAuthentication: 'private-key-jwt', assertionPrivateKey: '' }),
        'ws-1',
        transport,
      ),
    ).rejects.toMatchObject({ step: 'client_credentials', message: /client assertion: .*private key is required/ });
    expect(sendMock).not.toHaveBeenCalled();
  });
});

describe('performJwtBearerFlow', () => {
  const grant = (over: Partial<OAuth2Auth> = {}) =>
    makeAuth({
      flow: 'jwt-bearer',
      clientSecret: undefined,
      assertionIssuer: 'svc@openheaders.io',
      assertionAlgorithm: 'ES256',
      assertionPrivateKey: P256_PEM,
      scopes: ['read', 'write'],
      ...over,
    });

  it('POSTs grant_type=jwt-bearer with a signed assertion carrying iss / aud / scope and persists the bundle', async () => {
    sendMock.mockResolvedValue(tokenResponse(JSON.stringify({ access_token: 'at-jwt', token_type: 'Bearer' })));
    const bundle = await performJwtBearerFlow(grant(), 'ws-1', transport);
    expect(bundle.accessToken).toBe('at-jwt');
    const request = sendMock.mock.calls[0][0];
    expect(request.url).toBe('https://auth.openheaders.io/token');
    const fields = bodyFields(request);
    expect(fields.grant_type).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(fields.client_id).toBe('client-1');
    expect(fields.scope).toBeUndefined();
    expect(segment(fields.assertion, 1)).toMatchObject({
      iss: 'svc@openheaders.io',
      aud: 'https://auth.openheaders.io/token',
      scope: 'read write',
    });
    expect(verifiesEs256(fields.assertion)).toBe(true);
    expect(store.putTokenBundle).toHaveBeenCalledWith(
      'cred-1',
      bundle,
      expect.objectContaining({ flow: 'jwt-bearer' }),
      'ws-1',
    );
  });

  it('a blank issuer is the precondition failure, before any wire activity', async () => {
    await expect(performJwtBearerFlow(grant({ assertionIssuer: undefined }), 'ws-1', transport)).rejects.toMatchObject({
      step: 'precondition',
      message: /assertion issuer/,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('refuses a config of another flow', async () => {
    await expect(performJwtBearerFlow(makeAuth(), 'ws-1', transport)).rejects.toThrow(/flow=jwt-bearer/);
  });

  it('a refused exchange surfaces as a jwt_bearer step failure', async () => {
    sendMock.mockResolvedValue(tokenResponse(JSON.stringify({ error: 'invalid_grant' }), 400));
    await expect(performJwtBearerFlow(grant(), 'ws-1', transport)).rejects.toMatchObject({ step: 'jwt_bearer' });
  });
});

// ── DPoP (RFC 9449) on the token POST ─────────────────────────────

/** Verify a compact JWS under the JWK its own header carries (ES256). */
function verifiesUnderHeaderJwk(jwt: string): boolean {
  const [h, p, sig] = jwt.split('.');
  const header = segment(jwt, 0);
  const key = createPublicKey({ key: header.jwk as Record<string, string>, format: 'jwk' });
  return nodeVerify(
    'sha256',
    Buffer.from(`${h}.${p}`),
    { key, dsaEncoding: 'ieee-p1363' },
    Buffer.from(sig, 'base64url'),
  );
}

function dpopHeader(request: TransportRequest): string {
  const value = request.headers.find((h) => h.key === 'DPoP')?.value;
  if (value === undefined) throw new Error('the POST carried no DPoP header');
  return value;
}

const DPOP_FRESH = JSON.stringify({ access_token: 'at-bound', token_type: 'DPoP', expires_in: 3600 });

describe('DPoP-bound exchange (tokenBinding: dpop)', () => {
  beforeEach(() => __resetDpopNoncesForTests());

  it('the POST carries a proof under a fresh ES256 key — typ dpop+jwt, htm POST, htu the endpoint, no ath — and the DPoP token comes back bound to it', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(DPOP_FRESH));
    const auth = makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop' });
    const bundle = await performClientCredentialsFlow(auth, 'ws-1', transport);
    const proof = dpopHeader(sendMock.mock.calls[0]![0]);
    expect(segment(proof, 0)).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256', jwk: { kty: 'EC', crv: 'P-256' } });
    expect(segment(proof, 1)).toMatchObject({ htm: 'POST', htu: 'https://auth.openheaders.io/token' });
    expect(segment(proof, 1)).not.toHaveProperty('ath');
    expect(segment(proof, 1)).not.toHaveProperty('nonce');
    expect(verifiesUnderHeaderJwk(proof)).toBe(true);
    expect(bundle.tokenType).toBe('DPoP');
    expect(bundle.dpop).toMatchObject({ algorithm: 'ES256', publicJwk: segment(proof, 0).jwk });
    expect(bundle.dpop?.jkt).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(store.putTokenBundle).toHaveBeenCalledWith('cred-1', bundle, auth, 'ws-1');
  });

  it('the config picks the family — a PS256 proof under an RSA key', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(DPOP_FRESH));
    await performClientCredentialsFlow(
      makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop', dpopAlgorithm: 'PS256' }),
      'ws-1',
      transport,
    );
    const header = segment(dpopHeader(sendMock.mock.calls[0]![0]), 0);
    expect(header).toMatchObject({ alg: 'PS256', jwk: { kty: 'RSA' } });
  });

  it('a provider that answers a Bearer token ignored the binding — the bundle stays plain', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    const bundle = await performClientCredentialsFlow(
      makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop' }),
      'ws-1',
      transport,
    );
    expect(bundle.tokenType).toBe('Bearer');
    expect(bundle.dpop).toBeUndefined();
  });

  it('a use_dpop_nonce answer is repeated ONCE with the issued nonce, inside one bucket payment; the nonce is remembered', async () => {
    sendMock
      .mockResolvedValueOnce({
        ...tokenResponse(JSON.stringify({ error: 'use_dpop_nonce' }), 400),
        headers: [{ key: 'dpop-nonce', value: 'n-1' }],
      })
      .mockResolvedValueOnce(tokenResponse(DPOP_FRESH));
    const auth = makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop' });
    const bundle = await performClientCredentialsFlow(auth, 'ws-1', transport);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(segment(dpopHeader(sendMock.mock.calls[0]![0]), 1)).not.toHaveProperty('nonce');
    expect(segment(dpopHeader(sendMock.mock.calls[1]![0]), 1)).toMatchObject({ nonce: 'n-1' });
    // The same key signed both proofs.
    expect(segment(dpopHeader(sendMock.mock.calls[1]![0]), 0).jwk).toEqual(
      segment(dpopHeader(sendMock.mock.calls[0]![0]), 0).jwk,
    );
    expect(bundle.accessToken).toBe('at-bound');
    expect(inspectRateLimiter('https://auth.openheaders.io')?.recentStartsInMinute).toBe(1);
    // The next POST to that origin carries the nonce up front.
    sendMock.mockResolvedValueOnce(tokenResponse(DPOP_FRESH));
    await performClientCredentialsFlow(auth, 'ws-1', transport);
    expect(segment(dpopHeader(sendMock.mock.calls[2]![0]), 1)).toMatchObject({ nonce: 'n-1' });
  });

  it('a second use_dpop_nonce answer is the exchange failure — no third POST', async () => {
    const challenge = () => ({
      ...tokenResponse(JSON.stringify({ error: 'use_dpop_nonce' }), 400),
      headers: [{ key: 'dpop-nonce', value: 'n-2' }],
    });
    sendMock.mockResolvedValueOnce(challenge()).mockResolvedValueOnce(challenge());
    await expect(
      performClientCredentialsFlow(makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop' }), 'ws-1', transport),
    ).rejects.toMatchObject({ step: 'client_credentials', message: expect.stringContaining('400') });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('a cached nonce for the origin rides the first proof', async () => {
    rememberDpopNonce('https://auth.openheaders.io/token', 'n-cached');
    sendMock.mockResolvedValueOnce(tokenResponse(DPOP_FRESH));
    await performClientCredentialsFlow(
      makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop' }),
      'ws-1',
      transport,
    );
    expect(segment(dpopHeader(sendMock.mock.calls[0]![0]), 1)).toMatchObject({ nonce: 'n-cached' });
  });

  it('Send In: query is refused before any wire activity — a DPoP token rides the header only', async () => {
    await expect(
      performClientCredentialsFlow(
        makeAuth({ flow: 'client-credentials', tokenBinding: 'dpop', sendAs: 'query' }),
        'ws-1',
        transport,
      ),
    ).rejects.toMatchObject({ step: 'client_credentials', message: expect.stringContaining('Authorization header') });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('the jwt-bearer and password grants prove too; a bearer config sends no proof', async () => {
    sendMock.mockResolvedValueOnce(tokenResponse(DPOP_FRESH));
    await performJwtBearerFlow(
      makeAuth({
        flow: 'jwt-bearer',
        tokenBinding: 'dpop',
        assertionIssuer: 'svc@openheaders.io',
        assertionAlgorithm: 'ES256',
        assertionPrivateKey: P256_PEM,
      }),
      'ws-1',
      transport,
    );
    expect(verifiesUnderHeaderJwk(dpopHeader(sendMock.mock.calls[0]![0]))).toBe(true);
    sendMock.mockResolvedValueOnce(tokenResponse(FRESH));
    await performPasswordCredentialsFlow(
      makeAuth({ flow: 'password-credentials', username: 'alice', password: 'pw' }),
      'ws-1',
      transport,
    );
    expect(sendMock.mock.calls[1]![0].headers.some((h) => h.key === 'DPoP')).toBe(false);
  });
});
