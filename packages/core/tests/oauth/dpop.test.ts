/**
 * OAuth 2.0 DPoP (RFC 9449) — the bound key a credential generates
 * (its JWK and RFC 7638 thumbprint checked against node's own), the
 * proof JWT at a pinned clock (header `typ` / `jwk`, the §4.2 claims,
 * `ath` on a resource request only, the nonce when issued) verified
 * under the public half for the ES / RS / PS families, the `htu`
 * rule, and the two nonce-challenge detectors.
 */

import { createHash, createPublicKey, verify as nodeVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  accessTokenHash,
  boundDpopKeyOf,
  buildDpopProofClaims,
  DPOP_DEFAULT_ALGORITHM,
  DPOP_PROOF_TYP,
  dpopAlgorithmOf,
  dpopHtu,
  dpopNonceOf,
  generateDpopKey,
  isDpopNonceChallengeFromResource,
  isDpopNonceChallengeFromTokenEndpoint,
  jwkThumbprint,
  mintDpopProof,
  type OAuth2DpopKey,
  signDpopProof,
  usesDpop,
} from '../../src/oauth';
import type { OAuth2Auth } from '../../src/types/request';

const NOW = 1_373_131_200;
const JTI = '6f1c2a0e-9b7d-4c3a-8e5f-1a2b3c4d5e6f';
const TOKEN = 'oh-dpop-access-token';

function makeConfig(overrides: Partial<OAuth2Auth> = {}): OAuth2Auth {
  return {
    type: 'oauth2',
    credentialRef: 'oauth2-cred-abcdefgh',
    flow: 'client-credentials',
    tokenEndpoint: 'https://auth.openheaders.io/token',
    clientId: 'client-123',
    clientSecret: 'shh-secret',
    scopes: ['read'],
    tokenBinding: 'dpop',
    ...overrides,
  };
}

function segment(jwt: string, index: number): Record<string, unknown> {
  const part = jwt.split('.')[index];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

/** Verify a compact JWS under the JWK its own header carries. */
function verifiesUnderHeaderJwk(jwt: string): boolean {
  const [h, p, s] = jwt.split('.');
  const header = segment(jwt, 0);
  const alg = header.alg as string;
  const key = createPublicKey({ key: header.jwk as Record<string, string>, format: 'jwk' });
  const family = alg.slice(0, 2);
  const hash = `sha${alg.slice(2)}`;
  const options =
    family === 'ES'
      ? { key, dsaEncoding: 'ieee-p1363' as const }
      : family === 'PS'
        ? { key, padding: 6, saltLength: Number(alg.slice(2)) / 8 }
        : { key };
  return nodeVerify(hash, Buffer.from(`${h}.${p}`), options, Buffer.from(s, 'base64url'));
}

describe('config rules', () => {
  it('usesDpop reads the token binding', () => {
    expect(usesDpop(makeConfig())).toBe(true);
    expect(usesDpop(makeConfig({ tokenBinding: undefined }))).toBe(false);
  });

  it('dpopAlgorithmOf defaults to ES256 and refuses HS or unknown families', () => {
    expect(dpopAlgorithmOf(makeConfig())).toBe(DPOP_DEFAULT_ALGORITHM);
    expect(dpopAlgorithmOf(makeConfig({ dpopAlgorithm: ' PS384 ' }))).toBe('PS384');
    expect(() => dpopAlgorithmOf(makeConfig({ dpopAlgorithm: 'HS256' }))).toThrow(/asymmetric/);
    expect(() => dpopAlgorithmOf(makeConfig({ dpopAlgorithm: 'none' }))).toThrow(/Unsupported DPoP algorithm/);
  });
});

describe('boundDpopKeyOf', () => {
  it('reads the key only off a token the provider issued as DPoP', async () => {
    const key = await generateDpopKey('ES256');
    expect(boundDpopKeyOf({ tokenType: 'DPoP', dpop: key })).toBe(key);
    expect(boundDpopKeyOf({ tokenType: 'dpop', dpop: key })).toBe(key);
    expect(boundDpopKeyOf({ tokenType: 'Bearer', dpop: key })).toBeUndefined();
    expect(boundDpopKeyOf({ tokenType: 'DPoP' })).toBeUndefined();
  });
});

describe('generateDpopKey', () => {
  it('ES256 — a P-256 pair, the public JWK bare, the thumbprint node agrees with', async () => {
    const key = await generateDpopKey('ES256');
    expect(key.algorithm).toBe('ES256');
    expect(key.publicJwk).toMatchObject({ kty: 'EC', crv: 'P-256' });
    expect(Object.keys(key.publicJwk).sort()).toEqual(['crv', 'kty', 'x', 'y']);
    const nodeJwk = createPublicKey({ key: key.publicJwk, format: 'jwk' }).export({ format: 'jwk' });
    const canonical = JSON.stringify({ crv: nodeJwk.crv, kty: nodeJwk.kty, x: nodeJwk.x, y: nodeJwk.y });
    expect(key.jkt).toBe(createHash('sha256').update(canonical).digest('base64url'));
    expect(await jwkThumbprint(key.publicJwk)).toBe(key.jkt);
    // The private half is bare PKCS#8 DER (standard base64) — the form the signer imports.
    expect(key.privateKeyPkcs8).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('RS256 — an RSA pair whose JWK carries n + e only', async () => {
    const key = await generateDpopKey('RS256');
    expect(Object.keys(key.publicJwk).sort()).toEqual(['e', 'kty', 'n']);
    const nodeJwk = createPublicKey({ key: key.publicJwk, format: 'jwk' }).export({ format: 'jwk' });
    const canonical = JSON.stringify({ e: nodeJwk.e, kty: 'RSA', n: nodeJwk.n });
    expect(key.jkt).toBe(createHash('sha256').update(canonical).digest('base64url'));
  });

  it('refuses an HS family', async () => {
    await expect(generateDpopKey('HS256')).rejects.toThrow(/asymmetric/);
  });
});

describe('claims', () => {
  it('dpopHtu strips the query and the fragment', () => {
    expect(dpopHtu('https://api.openheaders.io/v1/items?page=2#top')).toBe('https://api.openheaders.io/v1/items');
    expect(dpopHtu('https://api.openheaders.io/v1/items#top?x')).toBe('https://api.openheaders.io/v1/items');
    expect(dpopHtu('https://api.openheaders.io/v1/items')).toBe('https://api.openheaders.io/v1/items');
  });

  it('accessTokenHash is base64url(SHA-256(token))', async () => {
    expect(await accessTokenHash(TOKEN)).toBe(createHash('sha256').update(TOKEN).digest('base64url'));
  });

  it('buildDpopProofClaims — §4.2 shape, the method upper-cased, ath and nonce only when given', () => {
    const base = { method: 'post', url: 'https://api.openheaders.io/items?q=1', timestampSec: NOW, jti: JTI };
    expect(buildDpopProofClaims(base, undefined)).toEqual({
      jti: JTI,
      htm: 'POST',
      htu: 'https://api.openheaders.io/items',
      iat: NOW,
    });
    expect(buildDpopProofClaims({ ...base, nonce: 'n-1' }, 'ath-x')).toEqual({
      jti: JTI,
      htm: 'POST',
      htu: 'https://api.openheaders.io/items',
      iat: NOW,
      ath: 'ath-x',
      nonce: 'n-1',
    });
  });
});

describe('signDpopProof', () => {
  it('a token-POST proof — typ dpop+jwt, the public JWK in the header, no ath, verifies under it', async () => {
    const key = await generateDpopKey('ES256');
    const jwt = await signDpopProof(key, {
      method: 'POST',
      url: 'https://auth.openheaders.io/token',
      timestampSec: NOW,
      jti: JTI,
    });
    expect(segment(jwt, 0)).toEqual({ typ: DPOP_PROOF_TYP, jwk: key.publicJwk, alg: 'ES256' });
    expect(segment(jwt, 1)).toEqual({ jti: JTI, htm: 'POST', htu: 'https://auth.openheaders.io/token', iat: NOW });
    expect(verifiesUnderHeaderJwk(jwt)).toBe(true);
  });

  it('a resource proof carries ath = SHA-256 of the token and the nonce the server issued', async () => {
    const key = await generateDpopKey('ES256');
    const jwt = await signDpopProof(key, {
      method: 'get',
      url: 'https://api.openheaders.io/me?expand=1',
      accessToken: TOKEN,
      nonce: 'server-nonce-1',
      timestampSec: NOW,
      jti: JTI,
    });
    expect(segment(jwt, 1)).toEqual({
      jti: JTI,
      htm: 'GET',
      htu: 'https://api.openheaders.io/me',
      iat: NOW,
      ath: createHash('sha256').update(TOKEN).digest('base64url'),
      nonce: 'server-nonce-1',
    });
    expect(verifiesUnderHeaderJwk(jwt)).toBe(true);
  });

  it.each(['RS256', 'PS256', 'ES384'] as const)('%s verifies under the header JWK', async (algorithm) => {
    const key = await generateDpopKey(algorithm);
    const jwt = await signDpopProof(key, {
      method: 'GET',
      url: 'https://api.openheaders.io/',
      timestampSec: NOW,
      jti: JTI,
    });
    expect(segment(jwt, 0).alg).toBe(algorithm);
    expect(verifiesUnderHeaderJwk(jwt)).toBe(true);
  });

  it('a tampered proof fails under the header JWK', async () => {
    const key = await generateDpopKey('ES256');
    const jwt = await signDpopProof(key, {
      method: 'GET',
      url: 'https://api.openheaders.io/',
      timestampSec: NOW,
      jti: JTI,
    });
    const [h, , s] = jwt.split('.');
    const forged = Buffer.from(
      JSON.stringify({ jti: JTI, htm: 'DELETE', htu: 'https://api.openheaders.io/', iat: NOW }),
    ).toString('base64url');
    expect(verifiesUnderHeaderJwk(`${h}.${forged}.${s}`)).toBe(false);
  });

  it('mintDpopProof stamps the clock and a UUID jti', async () => {
    const key = await generateDpopKey('ES256');
    const before = Math.floor(Date.now() / 1000);
    const jwt = await mintDpopProof(key, { method: 'GET', url: 'https://api.openheaders.io/' });
    const claims = segment(jwt, 1);
    expect(claims.iat as number).toBeGreaterThanOrEqual(before);
    expect(claims.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('a persisted key round-trips — the same JWK and jkt sign a verifying proof', async () => {
    const generated = await generateDpopKey('ES256');
    const restored: OAuth2DpopKey = JSON.parse(JSON.stringify(generated));
    const jwt = await signDpopProof(restored, {
      method: 'GET',
      url: 'https://api.openheaders.io/',
      timestampSec: NOW,
      jti: JTI,
    });
    expect(segment(jwt, 0).jwk).toEqual(generated.publicJwk);
    expect(verifiesUnderHeaderJwk(jwt)).toBe(true);
  });
});

describe('nonce challenges', () => {
  it('the token endpoint asks with 400 use_dpop_nonce — nothing else qualifies', () => {
    expect(isDpopNonceChallengeFromTokenEndpoint(400, { error: 'use_dpop_nonce' })).toBe(true);
    expect(isDpopNonceChallengeFromTokenEndpoint(400, { error: 'invalid_dpop_proof' })).toBe(false);
    expect(isDpopNonceChallengeFromTokenEndpoint(401, { error: 'use_dpop_nonce' })).toBe(false);
    expect(isDpopNonceChallengeFromTokenEndpoint(400, null)).toBe(false);
  });

  it('the resource asks with a 401 DPoP challenge naming the error, alone or among other schemes', () => {
    expect(isDpopNonceChallengeFromResource(401, 'DPoP error="use_dpop_nonce"')).toBe(true);
    expect(isDpopNonceChallengeFromResource(401, 'Bearer realm="api", DPoP algs="ES256", error="use_dpop_nonce"')).toBe(
      true,
    );
    expect(isDpopNonceChallengeFromResource(401, 'DPoP error="invalid_token"')).toBe(false);
    expect(isDpopNonceChallengeFromResource(401, 'Bearer error="use_dpop_nonce"')).toBe(false);
    expect(isDpopNonceChallengeFromResource(200, 'DPoP error="use_dpop_nonce"')).toBe(false);
    expect(isDpopNonceChallengeFromResource(401, null)).toBe(false);
  });

  it('dpopNonceOf reads the header case-insensitively and ignores an empty one', () => {
    expect(dpopNonceOf([{ key: 'dpop-nonce', value: ' abc ' }])).toBe('abc');
    expect(dpopNonceOf([{ key: 'DPoP-Nonce', value: '' }])).toBeUndefined();
    expect(dpopNonceOf([{ key: 'content-type', value: 'application/json' }])).toBeUndefined();
  });
});
