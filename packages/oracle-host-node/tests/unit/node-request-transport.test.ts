/**
 * Node request transport — the desktop host's RequestTransport over
 * undici fetch. Verifies body materialization (raw / urlencoded /
 * multipart), response mapping, per-request TLS policy (dispatcher
 * selection + agent reuse), and the rich error classification undici
 * affords via `err.cause.code` (vs. the browser's opaque failure).
 */

import { TransportError, type TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, FormData, Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeRequestTransport, type NodeFetchFn } from '../../src/live/node-request-transport';

const fetchMock = vi.fn<NodeFetchFn>();

/** Transport wired to the mock via the fetch seam — the tests observe
 *  the exact init (headers, body, dispatcher) the transport builds. */
const transport = () => createNodeRequestTransport({ fetchFn: fetchMock });

beforeEach(() => {
  fetchMock.mockReset();
});

function makeRequest(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    method: 'GET',
    url: 'https://api.openheaders.io/v1/ping',
    headers: [],
    body: { kind: 'none' },
    redirect: 'follow',
    credentials: 'omit',
    maxBodyBytes: 2 * 1024 * 1024,
    ...overrides,
  };
}

/** Build a thrown fetch error carrying an undici-style `cause.code`. */
function fetchError(code: string): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error(code), { code }) });
}

/** Init of the n-th recorded fetch call — the transport always passes one. */
function callInit(n = 0): NonNullable<Parameters<NodeFetchFn>[1]> {
  const init = fetchMock.mock.calls[n]?.[1];
  if (!init) throw new Error(`fetch call ${n} recorded no init`);
  return init;
}

/** URL of the n-th recorded fetch call. */
function callUrl(n = 0): string {
  return String(fetchMock.mock.calls[n]?.[0]);
}

/** A redirect hop response — status + Location, empty body. */
function redirectResponse(status: number, location: string): Response {
  return new Response(null, { status, headers: { location } });
}

describe('createNodeRequestTransport', () => {
  it('maps a successful response to a TransportResponse', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } }),
    );
    const res = await transport().send(makeRequest());
    expect(res.status).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(res.body).toBe('{"ok":true}');
    expect(res.headers).toContainEqual({ key: 'content-type', value: 'application/json' });
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe('{"ok":true}'.length);
    // Response.url is empty for a synthetic Response → falls back to the request URL.
    expect(res.url).toBe('https://api.openheaders.io/v1/ping');
  });

  it('reads a body that fits under the cap in full, untruncated', async () => {
    fetchMock.mockResolvedValue(new Response('hello world'));
    const res = await transport().send(makeRequest({ maxBodyBytes: 1024 }));
    expect(res.body).toBe('hello world');
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe('hello world'.length);
  });

  it('streams + caps an oversized body, aborting the read past the ceiling', async () => {
    // A body well over the cap — the transport must retain only the cap
    // prefix and flag truncation rather than buffering the whole thing.
    const cap = 16;
    const big = 'x'.repeat(cap * 4);
    fetchMock.mockResolvedValue(new Response(big));
    const res = await transport().send(makeRequest({ maxBodyBytes: cap }));
    expect(res.bodyTruncated).toBe(true);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('x'.repeat(cap));
  });

  it('reports an exact-cap body as untruncated', async () => {
    const cap = 16;
    fetchMock.mockResolvedValue(new Response('y'.repeat(cap)));
    const res = await transport().send(makeRequest({ maxBodyBytes: cap }));
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('y'.repeat(cap));
  });

  it('handles a null body stream (no content) as an empty untruncated body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }));
    const res = await transport().send(makeRequest());
    expect(res.body).toBe('');
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe(0);
  });

  it('sends a raw body and the resolved headers', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }));
    await transport().send(
      makeRequest({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: { kind: 'raw', content: '{"a":1}' },
      }),
    );
    const init = callInit();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openheaders.io/v1/ping');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Headers).get('content-type')).toBe('application/json');
    // Every wire fetch is manual — the transport chases redirects itself.
    expect(init.redirect).toBe('manual');
  });

  it('builds a URLSearchParams body for urlencoded', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(
      makeRequest({
        method: 'POST',
        body: {
          kind: 'urlencoded',
          fields: [
            { name: 'a', value: '1' },
            { name: 'b', value: '2' },
          ],
        },
      }),
    );
    const init = callInit();
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get('a')).toBe('1');
    expect((init.body as URLSearchParams).get('b')).toBe('2');
  });

  it('builds a FormData body for multipart, retyping file bytes', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(
      makeRequest({
        method: 'POST',
        body: {
          kind: 'multipart',
          parts: [
            { kind: 'text', name: 'field', value: 'v' },
            {
              kind: 'file',
              name: 'upload',
              filename: 'doc.pdf',
              mimeType: 'application/pdf',
              bytes: new Uint8Array([1, 2, 3]),
            },
          ],
        },
      }),
    );
    const init = callInit();
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('field')).toBe('v');
    const file = form.get('upload');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('doc.pdf');
    expect((file as Blob).type).toBe('application/pdf');
  });

  it('honors a manual redirect policy', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ redirect: 'manual' }));
    expect(callInit().redirect).toBe('manual');
  });

  it('manual mode surfaces the first 3xx verbatim without chasing it', async () => {
    fetchMock.mockResolvedValue(redirectResponse(302, 'https://other.openheaders.io/moved'));
    const res = await transport().send(makeRequest({ redirect: 'manual' }));
    expect(res.status).toBe(302);
    expect(res.headers).toContainEqual({ key: 'location', value: 'https://other.openheaders.io/moved' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ECONNREFUSED', /Connection refused/],
    ['ENOTFOUND', /Could not resolve host/],
    ['ETIMEDOUT', /timed out/],
    ['ECONNRESET', /was reset/],
    ['CERT_HAS_EXPIRED', /TLS certificate error/],
  ])('classifies %s into an actionable TransportError', async (code, pattern) => {
    fetchMock.mockRejectedValue(fetchError(code));
    const t = transport();
    await expect(t.send(makeRequest())).rejects.toBeInstanceOf(TransportError);
    await expect(t.send(makeRequest())).rejects.toThrow(pattern);
  });

  it('falls back to the cause message for an unrecognized error code', async () => {
    fetchMock.mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: new Error('weird boom') }));
    await expect(transport().send(makeRequest())).rejects.toThrow(/weird boom/);
  });
});

describe('createNodeRequestTransport — per-attempt timeout', () => {
  it('passes no abort signal when timeoutMs is absent', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    const init = callInit();
    expect(init.signal).toBeUndefined();
  });

  it('aborts a hung fetch and surfaces a TransportError naming the timeout', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const attempt = transport().send(makeRequest({ timeoutMs: 20 }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow('Request timed out after 20 ms.');
  });

  it('aborts a stalled body read past the deadline', async () => {
    fetchMock.mockImplementation((_url, init) => {
      // Headers arrive instantly; the body stream then stalls forever. The
      // pull promise rejects on abort, mirroring how a real fetch body
      // reader behaves when its request signal fires.
      const stream = new ReadableStream({
        pull(_controller) {
          return new Promise<void>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          });
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    });
    await expect(transport().send(makeRequest({ timeoutMs: 20 }))).rejects.toThrow('Request timed out after 20 ms.');
  });

  it('a response inside the deadline resolves normally', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const res = await transport().send(makeRequest({ timeoutMs: 5_000 }));
    expect(res.status).toBe(200);
    expect(res.body).toBe('ok');
  });
});

describe('createNodeRequestTransport — per-request TLS policy', () => {
  it('rides the default dispatcher when sslVerification is absent or true', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ sslVerification: true }));
    expect(callInit(0).dispatcher).toBeUndefined();
    expect(callInit(1).dispatcher).toBeUndefined();
  });

  it('routes a verification-off send through a dedicated agent', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ sslVerification: false }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
  });

  it('reuses ONE shared agent across verification-off sends and transports', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ sslVerification: false }));
    await transport().send(makeRequest({ sslVerification: false }));
    const first = callInit(0).dispatcher;
    const second = callInit(1).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(second).toBe(first);
  });
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
