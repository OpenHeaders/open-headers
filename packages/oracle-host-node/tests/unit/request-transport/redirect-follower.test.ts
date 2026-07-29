/**
 * The hand-rolled redirect follower: chain chasing, Location
 * resolution, the fetch spec's method/body demotion and cross-origin
 * Authorization strip (each relaxable by its knob), the redirect cap,
 * and the per-hop chain attribution recorded for the snapshot.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TransportError } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, type Headers, Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNodeRequestTransport } from '../../../src/live/node-request-transport';
import { makeRequest, makeRig, redirectResponse } from './helpers';

const { fetchMock, requestMock, transport, callInit, callUrl } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
});

describe('createNodeRequestTransport — hand-rolled redirect follow', () => {
  it('follows a redirect chain to the final response and reports the final URL', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://api.openheaders.io/v2/ping'))
      .mockResolvedValueOnce(redirectResponse(302, 'https://api.openheaders.io/v3/ping'))
      .mockResolvedValueOnce(new Response('final', { status: 200, statusText: 'OK' }));
    const res = await transport().send(makeRequest());
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(callUrl(1)).toBe('https://api.openheaders.io/v2/ping');
    expect(callUrl(2)).toBe('https://api.openheaders.io/v3/ping');
    expect(res.status).toBe(200);
    expect(res.body).toBe('final');
    // Synthetic Response.url is empty → falls back to the FINAL hop's URL.
    expect(res.url).toBe('https://api.openheaders.io/v3/ping');
  });

  it('resolves a relative Location against the current hop URL', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/moved/here')).mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest());
    expect(callUrl(1)).toBe('https://api.openheaders.io/moved/here');
  });

  it('treats a 3xx without a Location header as final', async () => {
    fetchMock.mockResolvedValue(new Response('not moved', { status: 302 }));
    const res = await transport().send(makeRequest());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(302);
    expect(res.body).toBe('not moved');
  });

  it('stops at the default 20-hop cap with an error naming the limit', async () => {
    fetchMock.mockImplementation(async () => redirectResponse(302, '/again'));
    const attempt = transport().send(makeRequest());
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow("Stopped after 20 redirects — the request's redirect limit.");
    expect(fetchMock).toHaveBeenCalledTimes(21);
  });

  it('honors a custom maxRedirects cap and names it in the error', async () => {
    fetchMock.mockImplementation(async () => redirectResponse(302, '/again'));
    await expect(transport().send(makeRequest({ maxRedirects: 3 }))).rejects.toThrow(
      "Stopped after 3 redirects — the request's redirect limit.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('maxRedirects 0 fails on the very first redirect', async () => {
    fetchMock.mockResolvedValue(redirectResponse(302, '/anywhere'));
    await expect(transport().send(makeRequest({ maxRedirects: 0 }))).rejects.toThrow(
      "Stopped after 0 redirects — the request's redirect limit.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a redirect with an unparsable Location', async () => {
    fetchMock.mockResolvedValue(redirectResponse(302, 'https://'));
    await expect(transport().send(makeRequest())).rejects.toThrow('Redirect points to an invalid URL');
  });

  it('demotes 301 POST to GET, dropping the body and its metadata headers', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(301, '/login')).mockResolvedValueOnce(new Response('ok'));
    await transport().send(
      makeRequest({
        method: 'POST',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'X-Trace', value: 'keep-me' },
        ],
        body: { kind: 'raw', content: '{"a":1}' },
      }),
    );
    const second = callInit(1);
    expect(second.method).toBe('GET');
    expect(second.body).toBeUndefined();
    expect((second.headers as Headers).get('content-type')).toBeNull();
    expect((second.headers as Headers).get('x-trace')).toBe('keep-me');
  });

  it('demotes 303 non-GET methods to GET', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(303, '/status')).mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ method: 'PUT', body: { kind: 'raw', content: 'payload' } }));
    expect(callInit(1).method).toBe('GET');
    expect(callInit(1).body).toBeUndefined();
  });

  it('preserves method AND body on 307, re-materializing the body per hop', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(307, '/retry')).mockResolvedValueOnce(new Response('ok'));
    await transport().send(
      makeRequest({
        method: 'POST',
        body: { kind: 'urlencoded', fields: [{ name: 'a', value: '1' }] },
      }),
    );
    expect(callInit(1).method).toBe('POST');
    expect(callInit(0).body).toBeInstanceOf(URLSearchParams);
    expect(callInit(1).body).toBeInstanceOf(URLSearchParams);
    // A fresh instance per hop — a consumed body object is never reused.
    expect(callInit(1).body).not.toBe(callInit(0).body);
  });

  it('followOriginalHttpMethod keeps POST + body across a 302', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/moved')).mockResolvedValueOnce(new Response('ok'));
    await transport().send(
      makeRequest({
        method: 'POST',
        followOriginalHttpMethod: true,
        body: { kind: 'raw', content: '{"a":1}' },
      }),
    );
    expect(callInit(1).method).toBe('POST');
    expect(callInit(1).body).toBe('{"a":1}');
  });

  it('strips Authorization when a hop crosses origin', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest({ headers: [{ key: 'Authorization', value: 'Bearer secret' }] }));
    expect((callInit(0).headers as Headers).get('authorization')).toBe('Bearer secret');
    expect((callInit(1).headers as Headers).get('authorization')).toBeNull();
    expect(res.authorizationForwarded).toBeUndefined();
  });

  it('keeps Authorization on a same-origin hop without marking the response', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/v2/ping')).mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest({ headers: [{ key: 'Authorization', value: 'Bearer secret' }] }));
    expect((callInit(1).headers as Headers).get('authorization')).toBe('Bearer secret');
    expect(res.authorizationForwarded).toBeUndefined();
  });

  it('followAuthorizationHeader keeps the header cross-origin and marks the response', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(
      makeRequest({
        headers: [{ key: 'Authorization', value: 'Bearer secret' }],
        followAuthorizationHeader: true,
      }),
    );
    expect((callInit(1).headers as Headers).get('authorization')).toBe('Bearer secret');
    expect(res.authorizationForwarded).toBe(true);
  });

  it('does not mark the response when the knob is on but the chain stays same-origin', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/v2/ping')).mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(
      makeRequest({
        headers: [{ key: 'Authorization', value: 'Bearer secret' }],
        followAuthorizationHeader: true,
      }),
    );
    expect(res.authorizationForwarded).toBeUndefined();
  });

  it('cancels an intermediate 3xx body so its connection returns to the pool', async () => {
    let canceled = false;
    const stalled = new ReadableStream({
      pull() {
        return new Promise(() => {});
      },
      cancel() {
        canceled = true;
      },
    });
    fetchMock
      .mockResolvedValueOnce(new Response(stalled, { status: 302, headers: { location: '/moved' } }))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest());
    expect(res.body).toBe('ok');
    expect(canceled).toBe(true);
  });

  it('ONE timeout deadline spans the whole chain, not each hop', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/slow')).mockImplementationOnce(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(transport().send(makeRequest({ timeoutMs: 20 }))).rejects.toThrow('Request timed out after 20 ms.');
  });

  it('routes EVERY hop through the insecure dispatcher when verification is off', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ sslVerification: false }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBeInstanceOf(Agent);
  });
});

describe('createNodeRequestTransport — per-hop redirect chain attribution', () => {
  it('records one hop per redirect — url and method as sent, status, verbatim Location', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, '/moved/here'))
      .mockResolvedValueOnce(redirectResponse(302, 'https://api.openheaders.io/final'))
      .mockResolvedValueOnce(new Response('final', { status: 200 }));
    const res = await transport().send(makeRequest());
    expect(res.redirectChain).toEqual([
      // The Location is recorded as ANSWERED (relative here) — the
      // follower resolves it, and the next record shows where it went.
      {
        url: 'https://api.openheaders.io/v1/ping',
        method: 'GET',
        status: 302,
        statusText: '',
        location: '/moved/here',
      },
      {
        url: 'https://api.openheaders.io/moved/here',
        method: 'GET',
        status: 302,
        statusText: '',
        location: 'https://api.openheaders.io/final',
      },
    ]);
  });

  it('omits the field entirely when no redirect happened', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const res = await transport().send(makeRequest());
    expect(res.redirectChain).toBeUndefined();
  });

  it('omits the field under a manual redirect policy — single-shot, no chain', async () => {
    fetchMock.mockResolvedValue(redirectResponse(302, '/moved'));
    const res = await transport().send(makeRequest({ redirect: 'manual' }));
    expect(res.status).toBe(302);
    expect(res.redirectChain).toBeUndefined();
  });

  it('records the 303 method demotion on the hop that triggered it', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(303, '/status')).mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest({ method: 'PUT', body: { kind: 'raw', content: 'payload' } }));
    expect(res.redirectChain).toEqual([
      {
        url: 'https://api.openheaders.io/v1/ping',
        method: 'PUT',
        status: 303,
        statusText: '',
        location: '/status',
        methodChangedTo: 'GET',
      },
    ]);
  });

  it('records the 301 POST demotion, and the demoted method on the following hop', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(301, '/login'))
      .mockResolvedValueOnce(redirectResponse(302, '/home'))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest({ method: 'POST', body: { kind: 'raw', content: '{"a":1}' } }));
    expect(res.redirectChain?.[0]).toMatchObject({ method: 'POST', status: 301, methodChangedTo: 'GET' });
    expect(res.redirectChain?.[1]).toMatchObject({ method: 'GET', status: 302 });
    expect(res.redirectChain?.[1]?.methodChangedTo).toBeUndefined();
  });

  it('records no method change when followOriginalHttpMethod keeps it', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/moved')).mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(
      makeRequest({ method: 'POST', followOriginalHttpMethod: true, body: { kind: 'raw', content: '{"a":1}' } }),
    );
    expect(res.redirectChain?.[0]?.methodChangedTo).toBeUndefined();
  });

  it('records a cross-origin Authorization strip on the hop it happened', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest({ headers: [{ key: 'Authorization', value: 'Bearer secret' }] }));
    expect(res.redirectChain?.[0]?.authorization).toBe('stripped');
    expect(res.authorizationForwarded).toBeUndefined();
  });

  it('records a forwarded Authorization when the opt-in fired, beside the response marker', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(
      makeRequest({ headers: [{ key: 'Authorization', value: 'Bearer secret' }], followAuthorizationHeader: true }),
    );
    expect(res.redirectChain?.[0]?.authorization).toBe('forwarded');
    expect(res.authorizationForwarded).toBe(true);
  });

  it('records no authorization transition on a same-origin hop', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/v2/ping')).mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest({ headers: [{ key: 'Authorization', value: 'Bearer secret' }] }));
    expect(res.redirectChain?.[0]?.authorization).toBeUndefined();
  });

  it('real wire: a 303 POST chain records the demotion through the actual undici pipeline', async () => {
    // The mocked-fetch matrix above never exercises undici's real
    // Response surface (statusText, absolute response.url) — pin the
    // recording against a live local chain per the real-wire discipline.
    const server = createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/start') {
        res.statusCode = 303;
        res.setHeader('Location', '/final');
        res.end();
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`done via ${req.method}`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `http://127.0.0.1:${port}/start`,
          method: 'POST',
          headers: [{ key: 'Content-Type', value: 'application/json' }],
          body: { kind: 'raw', content: '{"a":1}' },
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe('done via GET');
      expect(res.url).toBe(`http://127.0.0.1:${port}/final`);
      expect(res.redirectChain).toEqual([
        {
          url: `http://127.0.0.1:${port}/start`,
          method: 'POST',
          status: 303,
          statusText: 'See Other',
          location: '/final',
          methodChangedTo: 'GET',
        },
      ]);
    } finally {
      server.close();
    }
  });
});
