/**
 * Node request transport — the desktop host's RequestTransport over
 * global fetch. Verifies body materialization (raw / urlencoded /
 * multipart), response mapping, and the rich error classification undici
 * affords via `err.cause.code` (vs. the browser's opaque failure).
 */

import { TransportError, type TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeRequestTransport } from '../../src/live/node-request-transport';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
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

describe('createNodeRequestTransport', () => {
  it('maps a successful response to a TransportResponse', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } }),
    );
    const res = await createNodeRequestTransport().send(makeRequest());
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
    const res = await createNodeRequestTransport().send(makeRequest({ maxBodyBytes: 1024 }));
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
    const res = await createNodeRequestTransport().send(makeRequest({ maxBodyBytes: cap }));
    expect(res.bodyTruncated).toBe(true);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('x'.repeat(cap));
  });

  it('reports an exact-cap body as untruncated', async () => {
    const cap = 16;
    fetchMock.mockResolvedValue(new Response('y'.repeat(cap)));
    const res = await createNodeRequestTransport().send(makeRequest({ maxBodyBytes: cap }));
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('y'.repeat(cap));
  });

  it('handles a null body stream (no content) as an empty untruncated body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }));
    const res = await createNodeRequestTransport().send(makeRequest());
    expect(res.body).toBe('');
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe(0);
  });

  it('sends a raw body and the resolved headers', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }));
    await createNodeRequestTransport().send(
      makeRequest({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: { kind: 'raw', content: '{"a":1}' },
      }),
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.openheaders.io/v1/ping');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Headers).get('content-type')).toBe('application/json');
    expect(init.redirect).toBe('follow');
  });

  it('builds a URLSearchParams body for urlencoded', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await createNodeRequestTransport().send(
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
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(URLSearchParams);
    expect((init.body as URLSearchParams).get('a')).toBe('1');
    expect((init.body as URLSearchParams).get('b')).toBe('2');
  });

  it('builds a FormData body for multipart, retyping file bytes', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await createNodeRequestTransport().send(
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
    const [, init] = fetchMock.mock.calls[0];
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
    await createNodeRequestTransport().send(makeRequest({ redirect: 'manual' }));
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
  });

  it.each([
    ['ECONNREFUSED', /Connection refused/],
    ['ENOTFOUND', /Could not resolve host/],
    ['ETIMEDOUT', /timed out/],
    ['ECONNRESET', /was reset/],
    ['CERT_HAS_EXPIRED', /TLS certificate error/],
  ])('classifies %s into an actionable TransportError', async (code, pattern) => {
    fetchMock.mockRejectedValue(fetchError(code));
    const transport = createNodeRequestTransport();
    await expect(transport.send(makeRequest())).rejects.toBeInstanceOf(TransportError);
    await expect(transport.send(makeRequest())).rejects.toThrow(pattern);
  });

  it('falls back to the cause message for an unrecognized error code', async () => {
    fetchMock.mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: new Error('weird boom') }));
    await expect(createNodeRequestTransport().send(makeRequest())).rejects.toThrow(/weird boom/);
  });
});
