/**
 * OAuth 2.0 signed assertions (RFC 7523) — the client assertion the
 * two JWT client-authentication methods mint per token POST and the
 * grant assertion the `jwt-bearer` flow sends: claim composition at a
 * pinned clock, every builder's body under both methods, the HS
 * family keyed by the client secret, each asymmetric family verified
 * under node's public-key verify, the audience default + override,
 * and the refusals by name.
 */

import { constants, createHmac, generateKeyPairSync, type KeyObject, verify as nodeVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ASSERTION_DEFAULT_LIFETIME_SECONDS,
  assertionAudienceOf,
  buildAuthorizationCodeTokenBody,
  buildClientAssertionClaims,
  buildClientCredentialsTokenBody,
  buildDeviceCodeTokenBody,
  buildGrantAssertionClaims,
  buildJwtBearerTokenBody,
  buildPasswordCredentialsTokenBody,
  buildRefreshTokenBody,
  CLIENT_ASSERTION_TYPE_JWT_BEARER,
  JWT_BEARER_GRANT_TYPE,
  mintClientAssertion,
  signClientAssertion,
  signGrantAssertion,
  usesClientAssertion,
} from '../../src/oauth';
import type { OAuth2Auth } from '../../src/types/request';

const NOW = 1_373_131_200;
const JTI = '6f1c2a0e-9b7d-4c3a-8e5f-1a2b3c4d5e6f';
const INPUT = { timestampSec: NOW, jti: JTI };

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const RSA_PEM = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const p256 = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const P256_PEM = p256.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

function makeConfig(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abcdefgh',
    flow: 'client-credentials',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-123',
    clientSecret: 'shh-secret',
    scopes: ['read', 'write'],
    clientAuthentication: 'private-key-jwt',
    assertionPrivateKey: RSA_PEM,
    ...overrides,
  };
}

function segment(jwt: string, index: number): Record<string, unknown> {
  const part = jwt.split('.')[index];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function verifies(jwt: string, hash: string, key: KeyObject, opts: object = {}): boolean {
  const [h, p, s] = jwt.split('.');
  return nodeVerify(hash, Buffer.from(`${h}.${p}`), { key, ...opts }, Buffer.from(s, 'base64url'));
}

describe('client assertion — composition', () => {
  it('iss = sub = the client id, aud = the token endpoint, iat / nbf now, exp = now + 300, the minted jti', () => {
    expect(buildClientAssertionClaims(makeConfig(), INPUT)).toEqual({
      iss: 'client-123',
      sub: 'client-123',
      aud: 'https://auth.openheaders.io/token',
      iat: NOW,
      nbf: NOW,
      exp: NOW + ASSERTION_DEFAULT_LIFETIME_SECONDS,
      jti: JTI,
    });
    expect(ASSERTION_DEFAULT_LIFETIME_SECONDS).toBe(300);
  });

  it('a set audience (the FAPI issuer identifier) and lifetime apply', () => {
    const config = makeConfig({ assertionAudience: ' https://auth.openheaders.io ', assertionLifetimeSeconds: 600 });
    expect(assertionAudienceOf(config)).toBe('https://auth.openheaders.io');
    expect(buildClientAssertionClaims(config, INPUT)).toMatchObject({
      aud: 'https://auth.openheaders.io',
      exp: NOW + 600,
    });
    expect(buildClientAssertionClaims(makeConfig({ assertionLifetimeSeconds: 0 }), INPUT).exp).toBe(NOW + 300);
  });

  it('usesClientAssertion is true for the two JWT methods only', () => {
    expect(usesClientAssertion(makeConfig({ clientAuthentication: 'private-key-jwt' }))).toBe(true);
    expect(usesClientAssertion(makeConfig({ clientAuthentication: 'client-secret-jwt' }))).toBe(true);
    expect(usesClientAssertion(makeConfig({ clientAuthentication: 'basic-header' }))).toBe(false);
    expect(usesClientAssertion(makeConfig({ clientAuthentication: undefined }))).toBe(false);
  });
});

describe('client assertion — signing', () => {
  it('private-key-jwt defaults to RS256, carries kid + the user headers, verifies under the public key', async () => {
    const jwt = await signClientAssertion(
      makeConfig({ assertionKeyId: 'key-1', assertionHeaders: '{"x5t#S256":"A1bC2dE3"}' }),
      INPUT,
    );
    expect(segment(jwt, 0)).toEqual({ typ: 'JWT', kid: 'key-1', 'x5t#S256': 'A1bC2dE3', alg: 'RS256' });
    expect(segment(jwt, 1)).toMatchObject({ iss: 'client-123', jti: JTI });
    expect(verifies(jwt, 'sha256', rsa.publicKey)).toBe(true);
  });

  it('the user headers win over kid but never alg', async () => {
    const jwt = await signClientAssertion(
      makeConfig({ assertionKeyId: 'key-1', assertionHeaders: '{"kid":"other","alg":"none"}' }),
      INPUT,
    );
    expect(segment(jwt, 0)).toEqual({ typ: 'JWT', kid: 'other', alg: 'RS256' });
  });

  it('PS256 uses PSS padding; ES256 signs the JOSE r‖s form under a P-256 key', async () => {
    const ps = await signClientAssertion(makeConfig({ assertionAlgorithm: 'PS256' }), INPUT);
    expect(segment(ps, 0).alg).toBe('PS256');
    expect(verifies(ps, 'sha256', rsa.publicKey, { padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 })).toBe(
      true,
    );
    const es = await signClientAssertion(
      makeConfig({ assertionAlgorithm: 'ES256', assertionPrivateKey: P256_PEM }),
      INPUT,
    );
    expect(es.split('.')[2]).toHaveLength(86);
    expect(verifies(es, 'sha256', p256.publicKey, { dsaEncoding: 'ieee-p1363' })).toBe(true);
  });

  it('client-secret-jwt is an HMAC keyed by the client secret, HS256 by default', async () => {
    const jwt = await signClientAssertion(makeConfig({ clientAuthentication: 'client-secret-jwt' }), INPUT);
    expect(segment(jwt, 0)).toEqual({ typ: 'JWT', alg: 'HS256' });
    const [h, p, s] = jwt.split('.');
    expect(s).toBe(createHmac('sha256', 'shh-secret').update(`${h}.${p}`).digest('base64url'));
    const hs512 = await signClientAssertion(
      makeConfig({ clientAuthentication: 'client-secret-jwt', assertionAlgorithm: 'HS512' }),
      INPUT,
    );
    const [h5, p5, s5] = hs512.split('.');
    expect(s5).toBe(createHmac('sha512', 'shh-secret').update(`${h5}.${p5}`).digest('base64url'));
  });

  it('takes the data-URI private key form when its kid matches the Key ID', async () => {
    const der = rsa.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
    const jwt = await signClientAssertion(
      makeConfig({
        assertionKeyId: 'svc/key-1',
        assertionPrivateKey: `data:application/pkcs8;kid=svc/key-1;base64,${der}`,
      }),
      INPUT,
    );
    expect(verifies(jwt, 'sha256', rsa.publicKey)).toBe(true);
    await expect(
      signClientAssertion(
        makeConfig({
          assertionKeyId: 'svc/key-2',
          assertionPrivateKey: `data:application/pkcs8;kid=svc/key-1;base64,${der}`,
        }),
        INPUT,
      ),
    ).rejects.toThrow(/does not match the Key ID/);
  });

  it('refuses by name: a symmetric family on private-key-jwt, an asymmetric one on client-secret-jwt, a missing key / secret, a non-assertion method', async () => {
    await expect(signClientAssertion(makeConfig({ assertionAlgorithm: 'HS256' }), INPUT)).rejects.toThrow(
      /asymmetric family/,
    );
    await expect(
      signClientAssertion(
        makeConfig({ clientAuthentication: 'client-secret-jwt', assertionAlgorithm: 'RS256' }),
        INPUT,
      ),
    ).rejects.toThrow(/HMAC family/);
    await expect(signClientAssertion(makeConfig({ assertionAlgorithm: 'XX256' }), INPUT)).rejects.toThrow(
      /Unsupported assertion algorithm/,
    );
    await expect(signClientAssertion(makeConfig({ assertionPrivateKey: undefined }), INPUT)).rejects.toThrow(
      /private key is required/,
    );
    await expect(
      signClientAssertion(makeConfig({ clientAuthentication: 'client-secret-jwt', clientSecret: undefined }), INPUT),
    ).rejects.toThrow(/requires clientSecret/);
    await expect(signClientAssertion(makeConfig({ clientAuthentication: 'basic-header' }), INPUT)).rejects.toThrow(
      /requires an assertion client authentication/,
    );
    await expect(signClientAssertion(makeConfig({ assertionHeaders: '[1]' }), INPUT)).rejects.toThrow(
      /Assertion headers must be a JSON object/,
    );
  });

  it('mintClientAssertion stamps the clock + a UUID jti, and is undefined for the secret methods', async () => {
    const before = Math.floor(Date.now() / 1000);
    const jwt = await mintClientAssertion(makeConfig());
    const claims = segment(jwt ?? '', 1);
    expect(claims.iat).toBeGreaterThanOrEqual(before);
    expect(claims.exp).toBe((claims.iat as number) + 300);
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(await mintClientAssertion(makeConfig({ clientAuthentication: undefined }))).toBeUndefined();
    expect(await mintClientAssertion(makeConfig({ clientAuthentication: 'basic-header' }))).toBeUndefined();
  });
});

describe('client assertion — the token bodies', () => {
  const ASSERTION = 'h.p.s';

  it('every builder carries client_id + client_assertion_type + client_assertion and never the secret', () => {
    const config = makeConfig();
    const bodies = [
      buildAuthorizationCodeTokenBody({
        config,
        code: 'c',
        redirectUri: 'https://openheaders.io/cb',
        clientAssertion: ASSERTION,
      }),
      buildClientCredentialsTokenBody(config, ASSERTION),
      buildPasswordCredentialsTokenBody(makeConfig({ username: 'john.doe', password: 'pw' }), ASSERTION),
      buildDeviceCodeTokenBody({ config, deviceCode: 'dc', clientAssertion: ASSERTION }),
      buildRefreshTokenBody({ config, refreshToken: 'rt', clientAssertion: ASSERTION }),
      buildJwtBearerTokenBody({ config, assertion: 'g.r.ant', clientAssertion: ASSERTION }),
    ];
    for (const body of bodies) {
      expect(body.get('client_id')).toBe('client-123');
      expect(body.get('client_assertion_type')).toBe(CLIENT_ASSERTION_TYPE_JWT_BEARER);
      expect(body.get('client_assertion')).toBe(ASSERTION);
      expect(body.has('client_secret')).toBe(false);
    }
    expect(CLIENT_ASSERTION_TYPE_JWT_BEARER).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  });

  it('an assertion method without a minted assertion is the programmer error, never a fallback to the secret', () => {
    expect(() => buildClientCredentialsTokenBody(makeConfig())).toThrow(/requires a minted client assertion/);
    expect(() => buildRefreshTokenBody({ config: makeConfig(), refreshToken: 'rt' })).toThrow(
      /requires a minted client assertion/,
    );
  });

  it('the secret methods ignore a passed assertion', () => {
    const body = buildClientCredentialsTokenBody(makeConfig({ clientAuthentication: undefined }), ASSERTION);
    expect(body.get('client_secret')).toBe('shh-secret');
    expect(body.has('client_assertion')).toBe(false);
    const basic = buildClientCredentialsTokenBody(makeConfig({ clientAuthentication: 'basic-header' }), ASSERTION);
    expect(basic.has('client_id')).toBe(false);
    expect(basic.has('client_assertion')).toBe(false);
  });

  it('client credentials without a secret still needs one under the secret methods only', () => {
    expect(() =>
      buildClientCredentialsTokenBody(makeConfig({ clientAuthentication: undefined, clientSecret: undefined })),
    ).toThrow(/requires clientSecret/);
    expect(
      buildClientCredentialsTokenBody(makeConfig({ clientSecret: undefined }), ASSERTION).get('client_assertion'),
    ).toBe(ASSERTION);
  });
});

describe('jwt-bearer grant assertion', () => {
  const grantConfig = (over: Partial<OAuth2Auth> = {}) =>
    makeConfig({
      flow: 'jwt-bearer',
      clientAuthentication: undefined,
      clientSecret: undefined,
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      assertionIssuer: 'svc@openheaders.io',
      scopes: ['https://www.googleapis.com/auth/devstorage.read_only'],
      ...over,
    });

  it('composes iss / aud / iat / exp / scope / jti — the Google service-account shape', () => {
    expect(buildGrantAssertionClaims(grantConfig(), INPUT)).toEqual({
      iss: 'svc@openheaders.io',
      aud: 'https://oauth2.googleapis.com/token',
      iat: NOW,
      exp: NOW + 300,
      scope: 'https://www.googleapis.com/auth/devstorage.read_only',
      jti: JTI,
    });
  });

  it('a set subject, audience and lifetime apply; no scopes = no scope claim; Additional claims win over all', () => {
    expect(
      buildGrantAssertionClaims(
        grantConfig({
          assertionSubject: 'john.doe@openheaders.io',
          assertionAudience: 'https://login.openheaders.io',
          assertionLifetimeSeconds: 180,
          scopes: [],
        }),
        INPUT,
      ),
    ).toEqual({
      iss: 'svc@openheaders.io',
      sub: 'john.doe@openheaders.io',
      aud: 'https://login.openheaders.io',
      iat: NOW,
      exp: NOW + 180,
      jti: JTI,
    });
    expect(
      buildGrantAssertionClaims(
        grantConfig({ assertionClaims: '{"scope":"custom","box_sub_type":"enterprise","exp":123}' }),
        INPUT,
      ),
    ).toMatchObject({ scope: 'custom', box_sub_type: 'enterprise', exp: 123 });
  });

  it('refuses a blank issuer and malformed claims by name', () => {
    expect(() => buildGrantAssertionClaims(grantConfig({ assertionIssuer: ' ' }), INPUT)).toThrow(
      /requires an assertion issuer/,
    );
    expect(() => buildGrantAssertionClaims(grantConfig({ assertionClaims: '{nope' }), INPUT)).toThrow(
      /Additional claims is not valid JSON/,
    );
  });

  it('signs under the private key (RS256 default) and verifies; an HS family keys by the client secret', async () => {
    const jwt = await signGrantAssertion(grantConfig({ assertionKeyId: 'sa-key' }), INPUT);
    expect(segment(jwt, 0)).toEqual({ typ: 'JWT', kid: 'sa-key', alg: 'RS256' });
    expect(segment(jwt, 1)).toMatchObject({ iss: 'svc@openheaders.io', jti: JTI });
    expect(verifies(jwt, 'sha256', rsa.publicKey)).toBe(true);
    const hs = await signGrantAssertion(grantConfig({ assertionAlgorithm: 'HS256', clientSecret: 'k' }), INPUT);
    const [h, p, s] = hs.split('.');
    expect(s).toBe(createHmac('sha256', 'k').update(`${h}.${p}`).digest('base64url'));
  });

  it('the token body is grant_type=jwt-bearer + assertion, client_id + secret riding by the method, extras folded', () => {
    const body = buildJwtBearerTokenBody({
      config: grantConfig({ clientSecret: 'cs', extraTokenParams: [{ uid: 'u1', key: 'audience', value: 'api' }] }),
      assertion: 'g.r.ant',
    });
    expect(body.get('grant_type')).toBe(JWT_BEARER_GRANT_TYPE);
    expect(JWT_BEARER_GRANT_TYPE).toBe('urn:ietf:params:oauth:grant-type:jwt-bearer');
    expect(body.get('assertion')).toBe('g.r.ant');
    expect(body.get('client_id')).toBe('client-123');
    expect(body.get('client_secret')).toBe('cs');
    expect(body.get('audience')).toBe('api');
    expect(body.has('scope')).toBe(false);
    const basic = buildJwtBearerTokenBody({
      config: grantConfig({ clientAuthentication: 'basic-header' }),
      assertion: 'g',
    });
    expect(basic.has('client_id')).toBe(false);
  });
});
