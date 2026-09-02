/**
 * The DPoP leg (RFC 9449): the proof minted per hop for the hop's
 * method + target with the token's hash, verified under the JWK its
 * header carries; the resource's `use_dpop_nonce` challenge answered
 * by one resend with the issued nonce (behind redirects and in manual
 * mode too); the nonce a 2xx issues remembered for the next send to
 * that origin; the proof dropped with a cross-origin Authorization
 * strip and re-minted for the redirect target otherwise; a request
 * without proof material untouched.
 */

import { createHash, createPublicKey, verify as nodeVerify } from 'node:crypto';
import { generateDpopKey, type OAuth2DpopProofMaterial } from '@openheaders/core/oauth';
import { __resetDpopNoncesForTests } from '@openheaders/oracle/live/request-exec/dpop-nonces';
import { type Headers, Response } from 'undici';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { makeRequest, makeRig, redirectResponse } from './helpers';

const { fetchMock, requestMock, transport, callInit, callUrl } = makeRig();

let dpop: OAuth2DpopProofMaterial;

beforeAll(async () => {
  dpop = { key: await generateDpopKey('ES256'), accessToken: 'at-bound' };
});

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
  __resetDpopNoncesForTests();
});

const AUTHORIZATION = { key: 'Authorization', value: 'DPoP at-bound' };

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

/** The n-th recorded fetch call's DPoP proof, `null` when none rode. */
function proofOf(n: number): string | null {
  return (callInit(n).headers as Headers).get('dpop');
}

function challenge401(): Response {
  return new Response('unauthorized', {
    status: 401,
    headers: { 'www-authenticate': 'DPoP error="use_dpop_nonce"', 'dpop-nonce': 'n-1' },
  });
}

describe('createNodeRequestTransport — DPoP leg', () => {
  it('mints the proof for the hop — typ dpop+jwt, htm / htu of the request, ath of the token — under the bound key', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await transport().send(
      makeRequest({ method: 'POST', url: 'https://api.openheaders.io/v1/items?q=1', headers: [AUTHORIZATION], dpop }),
    );
    const proof = proofOf(0);
    expect(proof).not.toBeNull();
    expect(segment(proof ?? '', 0)).toMatchObject({ typ: 'dpop+jwt', alg: 'ES256', jwk: dpop.key.publicJwk });
    expect(segment(proof ?? '', 1)).toMatchObject({
      htm: 'POST',
      htu: 'https://api.openheaders.io/v1/items',
      ath: createHash('sha256').update('at-bound').digest('base64url'),
    });
    expect(segment(proof ?? '', 1)).not.toHaveProperty('nonce');
    expect(verifiesUnderHeaderJwk(proof ?? '')).toBe(true);
    expect((callInit(0).headers as Headers).get('authorization')).toBe('DPoP at-bound');
  });

  it('answers a use_dpop_nonce challenge with one resend carrying the nonce; the nonce rides the next send up front', async () => {
    fetchMock.mockResolvedValueOnce(challenge401()).mockResolvedValueOnce(new Response('secret', { status: 200 }));
    const res = await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callUrl(1)).toBe('https://api.openheaders.io/v1/ping');
    expect(segment(proofOf(0) ?? '', 1)).not.toHaveProperty('nonce');
    expect(segment(proofOf(1) ?? '', 1)).toMatchObject({ nonce: 'n-1' });
    expect(segment(proofOf(1) ?? '', 1).jti).not.toBe(segment(proofOf(0) ?? '', 1).jti);
    expect(res.status).toBe(200);
    expect(res.body).toBe('secret');

    fetchMock.mockResolvedValueOnce(new Response('again', { status: 200 }));
    await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(segment(proofOf(2) ?? '', 1)).toMatchObject({ nonce: 'n-1' });
  });

  it('a second challenge on the resend is final — two fetches, the 401 surfaces', async () => {
    fetchMock.mockResolvedValueOnce(challenge401()).mockResolvedValueOnce(challenge401());
    const res = await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
  });

  it('a nonce a 2xx issues is remembered without a resend', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200, headers: { 'dpop-nonce': 'n-fresh' } }));
    await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(segment(proofOf(1) ?? '', 1)).toMatchObject({ nonce: 'n-fresh' });
  });

  it('a 401 that is not a DPoP nonce challenge is not retried', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('nope', { status: 401, headers: { 'www-authenticate': 'DPoP error="invalid_token"' } }),
    );
    const res = await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it('re-mints per hop across a same-origin redirect — the second proof names the redirect target', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, '/v2/ping'))
      .mockResolvedValueOnce(new Response('moved', { status: 200 }));
    await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect(segment(proofOf(0) ?? '', 1)).toMatchObject({ htu: 'https://api.openheaders.io/v1/ping' });
    expect(segment(proofOf(1) ?? '', 1)).toMatchObject({ htu: 'https://api.openheaders.io/v2/ping' });
    expect(segment(proofOf(1) ?? '', 1).jti).not.toBe(segment(proofOf(0) ?? '', 1).jti);
  });

  it('drops the proof alongside the cross-origin Authorization strip, and mints it when the header is forwarded', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://other.openheaders.io/v1/ping'))
      .mockResolvedValueOnce(new Response('elsewhere', { status: 200 }));
    await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop }));
    expect((callInit(1).headers as Headers).get('authorization')).toBeNull();
    expect(proofOf(1)).toBeNull();

    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://other.openheaders.io/v1/ping'))
      .mockResolvedValueOnce(new Response('elsewhere', { status: 200 }));
    await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop, followAuthorizationHeader: true }));
    expect((callInit(3).headers as Headers).get('authorization')).toBe('DPoP at-bound');
    expect(segment(proofOf(3) ?? '', 1)).toMatchObject({ htu: 'https://other.openheaders.io/v1/ping' });
  });

  it('answers the challenge in manual redirect mode too', async () => {
    fetchMock.mockResolvedValueOnce(challenge401()).mockResolvedValueOnce(new Response('secret', { status: 200 }));
    const res = await transport().send(makeRequest({ headers: [AUTHORIZATION], dpop, redirect: 'manual' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(segment(proofOf(1) ?? '', 1)).toMatchObject({ nonce: 'n-1' });
    expect(res.status).toBe(200);
  });

  it('a request without proof material rides untouched — no DPoP header, no retry', async () => {
    fetchMock.mockResolvedValueOnce(challenge401());
    const res = await transport().send(makeRequest({ headers: [{ key: 'Authorization', value: 'Bearer plain' }] }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(proofOf(0)).toBeNull();
    expect(res.status).toBe(401);
  });
});
