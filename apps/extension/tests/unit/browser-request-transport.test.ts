/**
 * Browser request transport — the SW's RequestTransport over the SW's
 * `fetch`. Mirrors the Node transport's contract: the streamed, size-capped
 * body read is the parity-critical behavior (one seam contract across both
 * hosts), so it gets the same coverage here.
 */

import type { TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserRequestTransport } from '@/background/modules/browser-request-transport';

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
