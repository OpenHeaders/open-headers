/**
 * Browser request transport — the SW's RequestTransport over the SW's
 * `fetch`. Mirrors the Node transport's contract: the streamed, size-capped
 * body read is the parity-critical behavior (one seam contract across both
 * hosts), so it gets the same coverage here.
 */

import type { TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserRequestTransport } from '@/background/modules/net/browser-request-transport';

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

describe('browserRequestTransport', () => {
  it('maps a successful response and reports an untruncated body', async () => {
    fetchMock.mockResolvedValue(
      new Response('{"ok":true}', { status: 200, statusText: 'OK', headers: { 'content-type': 'application/json' } }),
    );
    const res = await browserRequestTransport.send(makeRequest());
    expect(res.status).toBe(200);
    expect(res.body).toBe('{"ok":true}');
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe('{"ok":true}'.length);
  });

  it('streams + caps an oversized body, aborting the read past the ceiling', async () => {
    const cap = 16;
    fetchMock.mockResolvedValue(new Response('x'.repeat(cap * 4)));
    const res = await browserRequestTransport.send(makeRequest({ maxBodyBytes: cap }));
    expect(res.bodyTruncated).toBe(true);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('x'.repeat(cap));
  });

  it('reports an exact-cap body as untruncated', async () => {
    const cap = 16;
    fetchMock.mockResolvedValue(new Response('y'.repeat(cap)));
    const res = await browserRequestTransport.send(makeRequest({ maxBodyBytes: cap }));
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('y'.repeat(cap));
  });

  it('handles a null body stream (no content) as an empty untruncated body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204, statusText: 'No Content' }));
    const res = await browserRequestTransport.send(makeRequest());
    expect(res.body).toBe('');
    expect(res.bodyTruncated).toBe(false);
    expect(res.bodyBytes).toBe(0);
  });
});

describe('browserRequestTransport — per-attempt timeout', () => {
  it('passes no abort signal when timeoutMs is absent', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await browserRequestTransport.send(makeRequest());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeUndefined();
  });

  it('aborts a hung fetch and surfaces a TransportError naming the timeout', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    await expect(browserRequestTransport.send(makeRequest({ timeoutMs: 20 }))).rejects.toThrow(
      'Request timed out after 20 ms.',
    );
  });

  it('aborts a stalled body read past the deadline', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      // Headers arrive instantly; the body stream then stalls forever. The
      // pull promise rejects on abort, mirroring how a real fetch body
      // reader behaves when its request signal fires.
      const stream = new ReadableStream({
        pull(_controller) {
          return new Promise<void>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          });
        },
      });
      return Promise.resolve(new Response(stream, { status: 200 }));
    });
    await expect(browserRequestTransport.send(makeRequest({ timeoutMs: 20 }))).rejects.toThrow(
      'Request timed out after 20 ms.',
    );
  });

  it('a response inside the deadline resolves normally', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const res = await browserRequestTransport.send(makeRequest({ timeoutMs: 5_000 }));
    expect(res.status).toBe(200);
    expect(res.body).toBe('ok');
  });
});
