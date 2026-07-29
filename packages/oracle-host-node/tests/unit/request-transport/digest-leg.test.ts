/**
 * The HTTP digest second leg: challenge selection (SHA-256 / MD5),
 * the single authorized resend per hop (behind redirects too),
 * qop=auth-int body hashing, and the failure modes that must surface
 * loudly instead of a wrong hash.
 */

import { createHash } from 'node:crypto';
import { type Headers, Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { makeRequest, makeRig, redirectResponse } from './helpers';

const { fetchMock, requestMock, transport, callInit, callUrl } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
});

describe('createNodeRequestTransport — HTTP digest second leg', () => {
  const digestAuth = { username: 'Mufasa', password: 'Circle of Life' };

  function challenge401(header: string): Response {
    return new Response('unauthorized', { status: 401, headers: { 'www-authenticate': header } });
  }

  const SHA256_CHALLENGE =
    'Digest realm="http-auth@example.org", qop="auth", algorithm=SHA-256, nonce="nonce-1", opaque="opq-1"';

  /** Digest param off the n-th recorded fetch call's Authorization. */
  function authParam(n: number, name: string): string | undefined {
    const value = (callInit(n).headers as Headers).get('authorization') ?? '';
    const quoted = new RegExp(`${name}="((?:[^"\\\\]|\\\\.)*)"`).exec(value);
    if (quoted) return quoted[1].replace(/\\(.)/g, '$1');
    return new RegExp(`${name}=([^",\\s]+)`).exec(value)?.[1];
  }

  function sha256(text: string): string {
    return createHash('sha256').update(text, 'utf8').digest('hex');
  }

  /** Reference RFC 7616 response over the recorded retry's own cnonce. */
  function expectedResponse(n: number, method: string, uri: string, realm: string, nonce: string): string {
    const cnonce = authParam(n, 'cnonce');
    if (cnonce === undefined) throw new Error('retry carried no cnonce');
    const ha1 = sha256(`${digestAuth.username}:${realm}:${digestAuth.password}`);
    return sha256(`${ha1}:${nonce}:00000001:${cnonce}:auth:${sha256(`${method}:${uri}`)}`);
  }

  it('answers a SHA-256 challenge with one authorized resend of the hop', async () => {
    fetchMock
      .mockResolvedValueOnce(challenge401(SHA256_CHALLENGE))
      .mockResolvedValueOnce(new Response('secret data', { status: 200, statusText: 'OK' }));
    const res = await transport().send(makeRequest({ digestAuth }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(callUrl(1)).toBe('https://api.openheaders.io/v1/ping');
    expect(authParam(1, 'username')).toBe('Mufasa');
    expect(authParam(1, 'realm')).toBe('http-auth@example.org');
    expect(authParam(1, 'uri')).toBe('/v1/ping');
    expect(authParam(1, 'opaque')).toBe('opq-1');
    expect(authParam(1, 'response')).toBe(expectedResponse(1, 'GET', '/v1/ping', 'http-auth@example.org', 'nonce-1'));
    expect(res.status).toBe(200);
    expect(res.body).toBe('secret data');
  });

  it('answers an MD5 challenge via node crypto', async () => {
    fetchMock
      .mockResolvedValueOnce(challenge401('Digest realm="cam.openheaders.io", qop="auth", nonce="n-md5"'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await transport().send(makeRequest({ digestAuth }));
    const cnonce = authParam(1, 'cnonce');
    const md5 = (t: string) => createHash('md5').update(t, 'utf8').digest('hex');
    const ha1 = md5(`${digestAuth.username}:cam.openheaders.io:${digestAuth.password}`);
    const expected = md5(`${ha1}:n-md5:00000001:${cnonce}:auth:${md5('GET:/v1/ping')}`);
    expect(authParam(1, 'algorithm')).toBe('MD5');
    expect(authParam(1, 'response')).toBe(expected);
  });

  it('never retries without digest credentials on the request', async () => {
    fetchMock.mockResolvedValue(challenge401(SHA256_CHALLENGE));
    const res = await transport().send(makeRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it('surfaces a 401 without an answerable Digest challenge verbatim', async () => {
    fetchMock.mockResolvedValue(
      new Response('unauthorized', { status: 401, headers: { 'www-authenticate': 'Basic realm="r"' } }),
    );
    const res = await transport().send(makeRequest({ digestAuth }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
  });

  it('treats a 401 on the authorized resend as final — exactly one retry', async () => {
    fetchMock.mockImplementation(async () => challenge401(SHA256_CHALLENGE));
    const res = await transport().send(makeRequest({ digestAuth }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(401);
  });

  it('answers a challenge behind a redirect for THAT hop, method and target', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://api.openheaders.io/v2/secure?probe=1'))
      .mockResolvedValueOnce(challenge401(SHA256_CHALLENGE))
      .mockResolvedValueOnce(new Response('moved secret', { status: 200 }));
    const res = await transport().send(makeRequest({ digestAuth }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callUrl(2)).toBe('https://api.openheaders.io/v2/secure?probe=1');
    expect(authParam(2, 'uri')).toBe('/v2/secure?probe=1');
    expect(authParam(2, 'response')).toBe(
      expectedResponse(2, 'GET', '/v2/secure?probe=1', 'http-auth@example.org', 'nonce-1'),
    );
    expect(res.status).toBe(200);
  });

  it('replaces a user-set Authorization header on the resend instead of appending', async () => {
    fetchMock
      .mockResolvedValueOnce(challenge401(SHA256_CHALLENGE))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await transport().send(
      makeRequest({ digestAuth, headers: [{ key: 'Authorization', value: 'Bearer stale-token' }] }),
    );
    const retryAuth = (callInit(1).headers as Headers).get('authorization') ?? '';
    expect(retryAuth.startsWith('Digest ')).toBe(true);
    expect(retryAuth).not.toContain('Bearer');
  });

  it('computes qop=auth-int over the urlencoded wire bytes when auth is not offered', async () => {
    fetchMock
      .mockResolvedValueOnce(challenge401('Digest realm="r", qop="auth-int", algorithm=SHA-256, nonce="n-int"'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await transport().send(
      makeRequest({
        method: 'POST',
        digestAuth,
        body: { kind: 'urlencoded', fields: [{ name: 'q', value: 'a b' }] },
      }),
    );
    const cnonce = authParam(1, 'cnonce');
    const bodyText = new URLSearchParams([['q', 'a b']]).toString();
    const ha1 = sha256(`${digestAuth.username}:r:${digestAuth.password}`);
    const ha2 = sha256(`POST:/v1/ping:${sha256(bodyText)}`);
    const expected = sha256(`${ha1}:n-int:00000001:${cnonce}:auth-int:${ha2}`);
    expect(authParam(1, 'qop')).toBe('auth-int');
    expect(authParam(1, 'response')).toBe(expected);
  });

  it('fails loudly when only auth-int is offered against a multipart body', async () => {
    fetchMock.mockResolvedValue(challenge401('Digest realm="r", qop="auth-int", algorithm=SHA-256, nonce="n"'));
    await expect(
      transport().send(
        makeRequest({
          method: 'POST',
          digestAuth,
          body: { kind: 'multipart', parts: [{ kind: 'text', name: 'field', value: 'v' }] },
        }),
      ),
    ).rejects.toThrow('Digest authentication with api.openheaders.io failed');
  });

  it('runs the exchange under redirect: manual too', async () => {
    fetchMock
      .mockResolvedValueOnce(challenge401(SHA256_CHALLENGE))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    const res = await transport().send(makeRequest({ digestAuth, redirect: 'manual' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });
});
