/**
 * The opt-in per-request cookie jar's transport legs: capture on
 * arrival, attachment per hop, user-set-header precedence, per-key
 * isolation, and the reported jar activity on the response.
 */

import { Headers, Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetCookieJars } from '../../../src/live/cookie-jar';
import { makeRequest, makeRig, redirectResponse } from './helpers';

const { fetchMock, requestMock, transport, callInit } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
});

describe('createNodeRequestTransport — per-request cookie jar', () => {
  beforeEach(() => {
    resetCookieJars();
  });

  /** A 200 whose headers carry the given Set-Cookie values. */
  function setCookieResponse(...values: string[]): Response {
    const headers = new Headers();
    for (const value of values) headers.append('set-cookie', value);
    return new Response('ok', { status: 200, headers });
  }

  /** The Cookie header the n-th recorded fetch went out with. */
  function sentCookie(n = 0): string | null {
    return (callInit(n).headers as Headers).get('cookie');
  }

  it('without a jar key, attaches nothing, discards Set-Cookie, and reports no jar activity', async () => {
    fetchMock.mockResolvedValue(setCookieResponse('session=abc123; Path=/'));
    const first = await transport().send(makeRequest());
    expect(first.cookiesCaptured).toBeUndefined();
    expect(first.cookieHeaderAttached).toBeUndefined();
    const second = await transport().send(makeRequest({ cookieJarKey: 'ws-a' }));
    // The unkeyed first send stored nothing for the keyed second to attach.
    expect(sentCookie(1)).toBeNull();
    expect(second.cookiesCaptured).toEqual(['session']);
  });

  it('captures Set-Cookie on one send and attaches it on the next, reporting both sides', async () => {
    fetchMock.mockResolvedValueOnce(setCookieResponse('session=abc123; Path=/', 'theme=dark; Path=/'));
    const login = await transport().send(
      makeRequest({ cookieJarKey: 'ws-a', url: 'https://api.openheaders.io/login' }),
    );
    expect(login.cookiesCaptured).toEqual(['session', 'theme']);
    expect(login.cookieHeaderAttached).toBeUndefined();

    fetchMock.mockResolvedValueOnce(new Response('ok'));
    const call = await transport().send(makeRequest({ cookieJarKey: 'ws-a', url: 'https://api.openheaders.io/me' }));
    expect(sentCookie(1)).toBe('session=abc123; theme=dark');
    expect(call.cookieHeaderAttached).toBe('session=abc123; theme=dark');
    expect(call.cookiesCaptured).toBeUndefined();
  });

  it('a cookie set mid-chain rides the NEXT hop of the same send', async () => {
    const hop = new Response(null, {
      status: 302,
      headers: new Headers([
        ['location', '/dashboard'],
        ['set-cookie', 'session=fresh; Path=/'],
      ]),
    });
    fetchMock.mockResolvedValueOnce(hop).mockResolvedValueOnce(new Response('ok'));
    const result = await transport().send(
      makeRequest({ cookieJarKey: 'ws-a', url: 'https://api.openheaders.io/login' }),
    );
    expect(sentCookie(0)).toBeNull();
    expect(sentCookie(1)).toBe('session=fresh');
    expect(result.cookiesCaptured).toEqual(['session']);
    // The attachment happened mid-chain, not on the first hop.
    expect(result.cookieHeaderAttached).toBeUndefined();
  });

  it('a captured cookie stays home on a cross-origin hop (domain matching is the discipline)', async () => {
    fetchMock.mockResolvedValueOnce(setCookieResponse('session=abc; Path=/'));
    await transport().send(makeRequest({ cookieJarKey: 'ws-a', url: 'https://api.openheaders.io/login' }));
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    const result = await transport().send(makeRequest({ cookieJarKey: 'ws-a', url: 'https://api.openheaders.io/go' }));
    expect(sentCookie(1)).toBe('session=abc');
    expect(sentCookie(2)).toBeNull();
    expect(result.cookieHeaderAttached).toBe('session=abc');
  });

  it('a user-set Cookie header wins — the jar stands down and reports no attachment', async () => {
    fetchMock.mockResolvedValueOnce(setCookieResponse('session=jar; Path=/'));
    await transport().send(makeRequest({ cookieJarKey: 'ws-a' }));
    fetchMock.mockResolvedValueOnce(new Response('ok'));
    const result = await transport().send(
      makeRequest({ cookieJarKey: 'ws-a', headers: [{ key: 'Cookie', value: 'session=mine' }] }),
    );
    expect(sentCookie(1)).toBe('session=mine');
    expect(result.cookieHeaderAttached).toBeUndefined();
  });

  it('jars are isolated per key — a cookie captured under one workspace never rides another', async () => {
    fetchMock.mockResolvedValueOnce(setCookieResponse('session=abc; Path=/'));
    await transport().send(makeRequest({ cookieJarKey: 'ws-a' }));
    fetchMock.mockResolvedValueOnce(new Response('ok'));
    const other = await transport().send(makeRequest({ cookieJarKey: 'ws-b' }));
    expect(sentCookie(1)).toBeNull();
    expect(other.cookieHeaderAttached).toBeUndefined();
  });

  it('manual mode still captures and attaches on its single shot', async () => {
    fetchMock.mockResolvedValueOnce(setCookieResponse('session=abc; Path=/'));
    const first = await transport().send(makeRequest({ cookieJarKey: 'ws-a', redirect: 'manual' }));
    expect(first.cookiesCaptured).toEqual(['session']);
    fetchMock.mockResolvedValueOnce(new Response('ok'));
    const second = await transport().send(makeRequest({ cookieJarKey: 'ws-a', redirect: 'manual' }));
    expect(sentCookie(1)).toBe('session=abc');
    expect(second.cookieHeaderAttached).toBe('session=abc');
  });
});
