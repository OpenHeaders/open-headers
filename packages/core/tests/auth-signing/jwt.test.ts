import { constants, createHmac, generateKeyPairSync, type KeyObject, verify as nodeVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type JwtCredentials, signJwtBearer } from '../../src/auth-signing/index';

const NOW = 1_373_131_200;

const HS_BASE: JwtCredentials = {
  algorithm: 'HS256',
  secret: 'oh-jwt-secret',
  privateKey: '',
  payload: '{"sub":"openheaders","aud":"api.openheaders.io"}',
  addTo: 'header',
};

/** Decode one compact-JWT segment. */
function segment(jwt: string, index: number): Record<string, unknown> {
  const part = jwt.split('.')[index];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function mint(credentials: JwtCredentials): Promise<string> {
  const result = await signJwtBearer(credentials, { timestampSec: NOW });
  expect(result.queryParams).toEqual([]);
  expect(result.headers).toHaveLength(1);
  expect(result.headers[0].key).toBe('Authorization');
  const value = result.headers[0].value;
  expect(value.startsWith('Bearer ')).toBe(true);
  return value.slice('Bearer '.length);
}

function signingInput(jwt: string): Buffer {
  return Buffer.from(jwt.split('.').slice(0, 2).join('.'));
}

function signatureOf(jwt: string): Buffer {
  return Buffer.from(jwt.split('.')[2], 'base64url');
}

describe('signJwtBearer — token assembly', () => {
  it('mints header.payload.signature with alg/typ auto-composed and verifies against node HMAC', async () => {
    const jwt = await mint(HS_BASE);
    expect(segment(jwt, 0)).toEqual({ typ: 'JWT', alg: 'HS256' });
    expect(segment(jwt, 1)).toEqual({ sub: 'openheaders', aud: 'api.openheaders.io' });
    const expected = createHmac('sha256', 'oh-jwt-secret').update(signingInput(jwt)).digest();
    expect(signatureOf(jwt).equals(expected)).toBe(true);
  });

  it('signs an empty payload as {} and honors HS384/HS512', async () => {
    for (const [algorithm, hash] of [
      ['HS384', 'sha384'],
      ['HS512', 'sha512'],
    ] as const) {
      const jwt = await mint({ ...HS_BASE, algorithm, payload: '' });
      expect(segment(jwt, 1)).toEqual({});
      const expected = createHmac(hash, 'oh-jwt-secret').update(signingInput(jwt)).digest();
      expect(signatureOf(jwt).equals(expected)).toBe(true);
    }
  });

  it('decodes a base64-encoded secret before keying the HMAC', async () => {
    const raw = Buffer.from('oh-binary-secret-bytes');
    const jwt = await mint({ ...HS_BASE, secret: raw.toString('base64'), secretBase64: true });
    const expected = createHmac('sha256', raw).update(signingInput(jwt)).digest();
    expect(signatureOf(jwt).equals(expected)).toBe(true);
  });

  it('merges user headers over typ but never alg; kid rides', async () => {
    const jwt = await mint({
      ...HS_BASE,
      headers: '{"kid":"oh-key-1","typ":"ghost","alg":"none"}',
    });
    expect(segment(jwt, 0)).toEqual({ typ: 'ghost', kid: 'oh-key-1', alg: 'HS256' });
  });

  it('stamps iat/exp from the injected clock when a lifetime is set — payload-set claims win', async () => {
    const stamped = await mint({ ...HS_BASE, payload: '{"iss":"oh"}', expiresInSeconds: 600 });
    expect(segment(stamped, 1)).toEqual({ iat: NOW, exp: NOW + 600, iss: 'oh' });
    const pinned = await mint({ ...HS_BASE, payload: '{"iss":"oh","exp":123}', expiresInSeconds: 600 });
    expect(segment(pinned, 1)).toEqual({ iat: NOW, exp: 123, iss: 'oh' });
    const absent = await mint({ ...HS_BASE, payload: '{"iss":"oh"}' });
    expect(segment(absent, 1)).toEqual({ iss: 'oh' });
  });

  it('honors the header prefix — absent = Bearer, custom rides, empty = the bare token', async () => {
    const custom = await signJwtBearer({ ...HS_BASE, headerPrefix: 'Ghost' }, { timestampSec: NOW });
    expect(custom.headers[0].value.startsWith('Ghost eyJ')).toBe(true);
    const bare = await signJwtBearer({ ...HS_BASE, headerPrefix: '' }, { timestampSec: NOW });
    expect(bare.headers[0].value.startsWith('eyJ')).toBe(true);
  });

  it('returns a token query pair instead of a header in query mode', async () => {
    const result = await signJwtBearer({ ...HS_BASE, addTo: 'query' }, { timestampSec: NOW });
    expect(result.headers).toEqual([]);
    expect(result.queryParams).toHaveLength(1);
    expect(result.queryParams[0].key).toBe('token');
    expect(result.queryParams[0].value.split('.')).toHaveLength(3);
  });

  it('refuses malformed payload / headers JSON by name', async () => {
    await expect(mint({ ...HS_BASE, payload: '{nope' })).rejects.toThrow(/JWT payload is not valid JSON/);
    await expect(mint({ ...HS_BASE, payload: '[1,2]' })).rejects.toThrow(/JWT payload must be a JSON object/);
    await expect(mint({ ...HS_BASE, headers: '"kid"' })).rejects.toThrow(/JWT headers must be a JSON object/);
  });
});

describe('signJwtBearer — asymmetric families', () => {
  function verifies(jwt: string, hash: string, key: KeyObject, opts: object = {}): boolean {
    return nodeVerify(hash, signingInput(jwt), { key, ...opts }, signatureOf(jwt));
  }

  it('RS256/384/512 sign a PKCS#8 key and verify under RSASSA-PKCS1-v1_5', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    for (const [algorithm, hash] of [
      ['RS256', 'sha256'],
      ['RS384', 'sha384'],
      ['RS512', 'sha512'],
    ] as const) {
      const jwt = await mint({ ...HS_BASE, algorithm, privateKey: pem });
      expect(segment(jwt, 0)).toEqual({ typ: 'JWT', alg: algorithm });
      expect(verifies(jwt, hash, publicKey)).toBe(true);
    }
  });

  it('accepts a PKCS#1 key (the RSA PRIVATE KEY armor app providers ship) via the DER wrap', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
    const jwt = await mint({ ...HS_BASE, algorithm: 'RS256', privateKey: pkcs1 });
    expect(verifies(jwt, 'sha256', publicKey)).toBe(true);
  });

  it('accepts a whitespace-mangled paste — newlines stripped from the armor body', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().replace(/\n/g, ' ');
    const jwt = await mint({ ...HS_BASE, algorithm: 'RS256', privateKey: pem });
    expect(verifies(jwt, 'sha256', publicKey)).toBe(true);
  });

  it('PS256 signs under RSA-PSS with the hash-length salt', async () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const jwt = await mint({ ...HS_BASE, algorithm: 'PS256', privateKey: pem });
    expect(verifies(jwt, 'sha256', publicKey, { padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 32 })).toBe(true);
  });

  it('ES256/384/512 sign PKCS#8 and SEC1 keys, emitting the raw JOSE r‖s signature', async () => {
    for (const [algorithm, curve, hash, width] of [
      ['ES256', 'prime256v1', 'sha256', 64],
      ['ES384', 'secp384r1', 'sha384', 96],
      ['ES512', 'secp521r1', 'sha512', 132],
    ] as const) {
      const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: curve });
      const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const jwt = await mint({ ...HS_BASE, algorithm, privateKey: pkcs8 });
      expect(signatureOf(jwt)).toHaveLength(width);
      expect(verifies(jwt, hash, publicKey, { dsaEncoding: 'ieee-p1363' })).toBe(true);

      const sec1 = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
      const fromSec1 = await mint({ ...HS_BASE, algorithm, privateKey: sec1 });
      expect(verifies(fromSec1, hash, publicKey, { dsaEncoding: 'ieee-p1363' })).toBe(true);
    }
  });

  it('refuses encrypted and unusable keys by name', async () => {
    await expect(
      mint({ ...HS_BASE, algorithm: 'RS256', privateKey: '-----BEGIN ENCRYPTED PRIVATE KEY-----\nAA==' }),
    ).rejects.toThrow(/Encrypted private keys are not supported/);
    await expect(mint({ ...HS_BASE, algorithm: 'RS256', privateKey: 'not a key at all !!!' })).rejects.toThrow(
      /not valid PEM or base64 DER/,
    );
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const sec1 = privateKey.export({ type: 'sec1', format: 'pem' }).toString();
    await expect(mint({ ...HS_BASE, algorithm: 'RS256', privateKey: sec1 })).rejects.toThrow(
      /An EC private key needs an ES algorithm/,
    );
  });
});
