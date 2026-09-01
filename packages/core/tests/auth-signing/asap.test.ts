import { constants, generateKeyPairSync, type KeyObject, verify as nodeVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ASAP_ALGORITHMS,
  ASAP_DEFAULT_EXPIRY_SECONDS,
  type AsapCredentials,
  buildAsapClaims,
  parseAsapPrivateKey,
  signAsap,
} from '../../src/auth-signing/index';

const NOW = 1_373_131_200;
const JTI = '6f1c2a0e-9b7d-4c3a-8e5f-1a2b3c4d5e6f';

const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
const RSA_PEM = rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const BASE: AsapCredentials = {
  algorithm: 'RS256',
  issuer: 'openheaders/service',
  audience: 'api.openheaders.io',
  keyId: 'openheaders/service/key-1',
  privateKey: RSA_PEM,
};

function segment(jwt: string, index: number): Record<string, unknown> {
  const part = jwt.split('.')[index];
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

async function mint(credentials: AsapCredentials): Promise<string> {
  const headers = await signAsap(credentials, { timestampSec: NOW, jti: JTI });
  expect(headers).toHaveLength(1);
  expect(headers[0].key).toBe('Authorization');
  const value = headers[0].value;
  expect(value.startsWith('Bearer ')).toBe(true);
  return value.slice('Bearer '.length);
}

function verifies(jwt: string, hash: string, key: KeyObject, opts: object = {}): boolean {
  const [h, p, s] = jwt.split('.');
  return nodeVerify(hash, Buffer.from(`${h}.${p}`), { key, ...opts }, Buffer.from(s, 'base64url'));
}

describe('buildAsapClaims — composition and precedence', () => {
  it('fills iss / sub / aud from the fields, stamps iat / exp, carries the minted jti', () => {
    expect(buildAsapClaims(BASE, { timestampSec: NOW, jti: JTI })).toEqual({
      iss: 'openheaders/service',
      sub: 'openheaders/service',
      aud: 'api.openheaders.io',
      iat: NOW,
      exp: NOW + ASAP_DEFAULT_EXPIRY_SECONDS,
      jti: JTI,
    });
    expect(ASAP_DEFAULT_EXPIRY_SECONDS).toBe(3600);
  });

  it('a set subject and expiry apply; Additional claims win over everything', () => {
    expect(
      buildAsapClaims({ ...BASE, subject: ' svc-user ', expiresInSeconds: 600 }, { timestampSec: NOW, jti: JTI }),
    ).toMatchObject({ sub: 'svc-user', exp: NOW + 600 });
    expect(
      buildAsapClaims(
        { ...BASE, claims: '{"aud":["a","b"],"jti":"pinned","exp":123,"scope":"read"}' },
        { timestampSec: NOW, jti: JTI },
      ),
    ).toEqual({
      iss: 'openheaders/service',
      sub: 'openheaders/service',
      aud: ['a', 'b'],
      iat: NOW,
      exp: 123,
      jti: 'pinned',
      scope: 'read',
    });
  });

  it('refuses malformed Additional claims by name', () => {
    expect(() => buildAsapClaims({ ...BASE, claims: '{nope' }, { timestampSec: NOW, jti: JTI })).toThrow(
      /Additional claims is not valid JSON/,
    );
    expect(() => buildAsapClaims({ ...BASE, claims: '[1]' }, { timestampSec: NOW, jti: JTI })).toThrow(
      /Additional claims must be a JSON object/,
    );
  });
});

describe('parseAsapPrivateKey — the key forms', () => {
  it('passes PEM through, shedding quotes and URI-encoding', () => {
    expect(parseAsapPrivateKey(`"${RSA_PEM}"`, 'k')).toBe(RSA_PEM);
    expect(parseAsapPrivateKey(encodeURIComponent(RSA_PEM), 'k')).toBe(RSA_PEM);
  });

  it('unwraps the key-tool data URI to its PKCS#8 base64 when the embedded kid matches', () => {
    const der = rsa.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
    const uri = `data:application/pkcs8;kid=openheaders%2Fservice%2Fkey-1;base64,${der}`;
    expect(parseAsapPrivateKey(uri, 'openheaders/service/key-1')).toBe(der);
    expect(() => parseAsapPrivateKey(uri, 'openheaders/service/key-2')).toThrow(/does not match the Key ID/);
    expect(() => parseAsapPrivateKey('data:application/pkcs8;base64,abc', 'k')).toThrow(/malformed/);
  });
});

describe('signAsap — the token', () => {
  it('mints kid + typ + alg in the header, the composed claims, and verifies under the public key', async () => {
    const jwt = await mint(BASE);
    expect(segment(jwt, 0)).toEqual({ typ: 'JWT', kid: 'openheaders/service/key-1', alg: 'RS256' });
    expect(segment(jwt, 1)).toEqual(buildAsapClaims(BASE, { timestampSec: NOW, jti: JTI }));
    expect(verifies(jwt, 'sha256', rsa.publicKey)).toBe(true);
  });

  it('signs through the data URI form', async () => {
    const der = rsa.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
    const jwt = await mint({
      ...BASE,
      privateKey: `data:application/pkcs8;kid=openheaders/service/key-1;base64,${der}`,
    });
    expect(verifies(jwt, 'sha256', rsa.publicKey)).toBe(true);
  });

  it('every asymmetric family verifies under node — PS with the hash-length salt, ES in JOSE form', async () => {
    const ec = {
      ES256: generateKeyPairSync('ec', { namedCurve: 'P-256' }),
      ES384: generateKeyPairSync('ec', { namedCurve: 'P-384' }),
      ES512: generateKeyPairSync('ec', { namedCurve: 'P-521' }),
    };
    for (const algorithm of ASAP_ALGORITHMS) {
      const bits = algorithm.slice(2);
      const hash = `sha${bits}`;
      const pair = algorithm.startsWith('ES') ? ec[algorithm as keyof typeof ec] : rsa;
      const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
      const jwt = await mint({ ...BASE, algorithm, privateKey: pem });
      expect(segment(jwt, 0)).toMatchObject({ alg: algorithm, kid: BASE.keyId });
      const opts = algorithm.startsWith('PS')
        ? { padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(bits) / 8 }
        : algorithm.startsWith('ES')
          ? { dsaEncoding: 'ieee-p1363' as const }
          : {};
      expect(verifies(jwt, hash, pair.publicKey, opts)).toBe(true);
    }
  });

  it('refuses a blank Key ID and a non-key paste by name', async () => {
    await expect(signAsap({ ...BASE, keyId: ' ' }, { timestampSec: NOW, jti: JTI })).rejects.toThrow(
      /Key ID is required/,
    );
    await expect(signAsap({ ...BASE, privateKey: 'not a key!' }, { timestampSec: NOW, jti: JTI })).rejects.toThrow(
      /not valid PEM or base64 DER/,
    );
  });
});
