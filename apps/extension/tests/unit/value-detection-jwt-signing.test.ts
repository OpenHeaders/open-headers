/**
 * JWT re-signing — the async HMAC module beside the sync JWT codec.
 * Signatures are cross-checked against an independent node:crypto HMAC
 * over the same RFC 7515 signing input (the implementation itself uses
 * WebCrypto), so the two can only agree on a correct signature.
 */

import { createHmac } from 'node:crypto';
import type { JsonObject } from '@openheaders/core/types';
import {
  decodeJWT,
  type HmacJwtAlgorithm,
  signableJwtAlgorithm,
  signJWT,
} from '@openheaders/ui/shared/value-detection';
import { describe, expect, it } from 'vitest';

const base64Url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** Independent expectation: node:crypto HMAC over the same input. */
function expectedToken(header: JsonObject, payload: JsonObject, secret: string, hash: string): string {
  const signingInput = `${base64Url(header)}.${base64Url(payload)}`;
  const signature = createHmac(hash, secret).update(signingInput).digest('base64url');
  return `${signingInput}.${signature}`;
}

const PAYLOAD: JsonObject = {
  iss: 'https://auth.openheaders.io',
  sub: 'user@openheaders.io',
  aud: 'https://api.openheaders.io',
  exp: 1893456000,
  scope: 'openid profile email',
};

describe('signJWT', () => {
  const cases: Array<{ alg: HmacJwtAlgorithm; hash: string }> = [
    { alg: 'HS256', hash: 'sha256' },
    { alg: 'HS384', hash: 'sha384' },
    { alg: 'HS512', hash: 'sha512' },
  ];

  for (const { alg, hash } of cases) {
    it(`signs with ${alg}, matching an independent HMAC-${hash} implementation`, async () => {
      const header = { alg, typ: 'JWT' };
      const token = await signJWT(header, PAYLOAD, 'openheaders-signing-secret');
      expect(token).toBe(expectedToken(header, PAYLOAD, 'openheaders-signing-secret', hash));
    });
  }

  it('round-trips through decodeJWT with header and payload intact', async () => {
    const header = { alg: 'HS256', typ: 'JWT', kid: 'openheaders-signing-key-2026' };
    const decoded = decodeJWT(await signJWT(header, PAYLOAD, 'hunter2!!'));
    expect(decoded.header).toEqual(header);
    expect(decoded.payload).toEqual(PAYLOAD);
    expect(decoded.signature.length).toBeGreaterThan(0);
  });

  it('emits base64url signatures (no +, /, or =) sized to the hash', async () => {
    // 32/48/64 signature bytes → 43/64/86 base64url chars.
    const sizes: Array<[HmacJwtAlgorithm, number]> = [
      ['HS256', 43],
      ['HS384', 64],
      ['HS512', 86],
    ];
    for (const [alg, length] of sizes) {
      const token = await signJWT({ alg }, PAYLOAD, 's3cret');
      const signature = token.split('.')[2];
      expect(signature).toHaveLength(length);
      expect(signature).not.toMatch(/[+/=]/);
    }
  });

  it('is deterministic for identical inputs', async () => {
    const header = { alg: 'HS256' };
    expect(await signJWT(header, PAYLOAD, 'same')).toBe(await signJWT(header, PAYLOAD, 'same'));
  });

  it('handles a non-ASCII secret as UTF-8', async () => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const secret = 'pässwörd-öpenheaders-😀';
    expect(await signJWT(header, PAYLOAD, secret)).toBe(expectedToken(header, PAYLOAD, secret, 'sha256'));
  });

  it('rejects an asymmetric algorithm', async () => {
    await expect(signJWT({ alg: 'RS256', typ: 'JWT' }, PAYLOAD, 'secret')).rejects.toThrow('Failed to sign JWT');
  });

  it('rejects a header without alg', async () => {
    await expect(signJWT({ typ: 'JWT' }, PAYLOAD, 'secret')).rejects.toThrow('Failed to sign JWT');
  });

  it('rejects an empty secret (WebCrypto refuses zero-length HMAC keys)', async () => {
    await expect(signJWT({ alg: 'HS256' }, PAYLOAD, '')).rejects.toThrow('Failed to sign JWT');
  });
});

describe('signableJwtAlgorithm', () => {
  it('passes the HMAC family through', () => {
    expect(signableJwtAlgorithm({ alg: 'HS256' })).toBe('HS256');
    expect(signableJwtAlgorithm({ alg: 'HS384' })).toBe('HS384');
    expect(signableJwtAlgorithm({ alg: 'HS512' })).toBe('HS512');
  });

  it('returns null for asymmetric, none, or missing alg', () => {
    expect(signableJwtAlgorithm({ alg: 'RS256' })).toBeNull();
    expect(signableJwtAlgorithm({ alg: 'ES256' })).toBeNull();
    expect(signableJwtAlgorithm({ alg: 'none' })).toBeNull();
    expect(signableJwtAlgorithm({ typ: 'JWT' })).toBeNull();
  });

  it('is case-sensitive and type-strict, per RFC 7515 alg matching', () => {
    expect(signableJwtAlgorithm({ alg: 'hs256' })).toBeNull();
    expect(signableJwtAlgorithm({ alg: 256 })).toBeNull();
  });
});
