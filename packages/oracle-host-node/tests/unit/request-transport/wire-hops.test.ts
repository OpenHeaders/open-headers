/**
 * Wire-pipeline selection below the seam: GET/HEAD-with-body and gRPC
 * hops ride undici `request()` (the only pipeline that carries those
 * shapes and HTTP trailers faithfully); everything else stays on
 * fetch. The prior-knowledge h2 pipeline has its own suite
 * (`h2-prior-knowledge.test.ts`).
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { TransportError } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, FormData, Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetCookieJars } from '../../../src/live/cookie-jar';
import {
  createNodeRequestTransport,
  type NodeRequestFn,
  type NodeRequestResponse,
} from '../../../src/live/node-request-transport';
import { fetchError, makeRequest, makeRig } from './helpers';

const { fetchMock, requestMock, transport } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
});

describe('createNodeRequestTransport — GET/HEAD with a body on the wire', () => {
  /** An undici request()-shaped result — plain readables per the seam,
   *  yielding Buffers like a real wire body. */
  function requestResponse(bodyText: string, overrides: Partial<NodeRequestResponse> = {}): NodeRequestResponse {
    return { statusCode: 200, headers: {}, body: Readable.from([Buffer.from(bodyText)]), ...overrides };
  }

  /** Options of the n-th recorded request() call. */
  function requestOpts(n = 0): Parameters<NodeRequestFn>[1] {
    const opts = requestMock.mock.calls[n]?.[1];
    if (!opts) throw new Error(`request call ${n} recorded no options`);
    return opts;
  }

  it('routes a GET with a raw body through request(), body verbatim on the wire', async () => {
    requestMock.mockResolvedValue(requestResponse('{"hits":[]}', { headers: { 'content-type': 'application/json' } }));
    const res = await transport().send(
      makeRequest({
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: { kind: 'raw', content: '{"query":{"match_all":{}}}' },
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(String(requestMock.mock.calls[0][0])).toBe('https://api.openheaders.io/v1/ping');
    const opts = requestOpts();
    expect(opts.method).toBe('GET');
    expect(opts.body).toBe('{"query":{"match_all":{}}}');
    expect(opts.headers.get('content-type')).toBe('application/json');
    expect(res.status).toBe(200);
    expect(res.statusText).toBe('OK');
    expect(res.body).toBe('{"hits":[]}');
    expect(res.headers).toContainEqual({ key: 'content-type', value: 'application/json' });
  });

  it('routes a HEAD with a body through request()', async () => {
    requestMock.mockResolvedValue(requestResponse(''));
    await transport().send(makeRequest({ method: 'HEAD', body: { kind: 'raw', content: 'probe' } }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestOpts().method).toBe('HEAD');
    expect(requestOpts().body).toBe('probe');
  });

  it('a bodyless GET stays on the fetch path', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    expect(requestMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a POST with a body stays on the fetch path', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ method: 'POST', body: { kind: 'raw', content: '{"a":1}' } }));
    expect(requestMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serializes a urlencoded body to text and supplies the Content-Type fetch would have set', async () => {
    requestMock.mockResolvedValue(requestResponse('ok'));
    await transport().send(
      makeRequest({
        body: {
          kind: 'urlencoded',
          fields: [
            { name: 'a', value: '1' },
            { name: 'b', value: 'two words' },
          ],
        },
      }),
    );
    const opts = requestOpts();
    expect(opts.body).toBe('a=1&b=two+words');
    expect(opts.headers.get('content-type')).toBe('application/x-www-form-urlencoded;charset=UTF-8');
  });

  it('a user-set Content-Type wins over the urlencoded default', async () => {
    requestMock.mockResolvedValue(requestResponse('ok'));
    await transport().send(
      makeRequest({
        headers: [{ key: 'Content-Type', value: 'application/x-custom' }],
        body: { kind: 'urlencoded', fields: [{ name: 'a', value: '1' }] },
      }),
    );
    expect(requestOpts().headers.get('content-type')).toBe('application/x-custom');
  });

  it('builds a FormData body for multipart on GET', async () => {
    requestMock.mockResolvedValue(requestResponse('ok'));
    await transport().send(
      makeRequest({
        body: { kind: 'multipart', parts: [{ kind: 'text', name: 'field', value: 'v' }] },
      }),
    );
    expect(requestOpts().body).toBeInstanceOf(FormData);
    expect((requestOpts().body as FormData).get('field')).toBe('v');
  });

  it('the per-tuple dispatcher rides the request() path', async () => {
    requestMock.mockResolvedValue(requestResponse('ok'));
    await transport().send(makeRequest({ sslVerification: false, body: { kind: 'raw', content: 'q' } }));
    expect(requestOpts().dispatcher).toBeInstanceOf(Agent);
  });

  it('streams + caps an oversized body on the request() path', async () => {
    const cap = 16;
    requestMock.mockResolvedValue(requestResponse('x'.repeat(cap * 4)));
    const res = await transport().send(makeRequest({ maxBodyBytes: cap, body: { kind: 'raw', content: 'q' } }));
    expect(res.bodyTruncated).toBe(true);
    expect(res.bodyBytes).toBe(cap);
    expect(res.body).toBe('x'.repeat(cap));
  });

  it('a redirected GET-with-body keeps the request() path for the next hop', async () => {
    requestMock
      .mockResolvedValueOnce(requestResponse('', { statusCode: 302, headers: { location: '/v2/search' } }))
      .mockResolvedValueOnce(requestResponse('final'));
    const res = await transport().send(makeRequest({ body: { kind: 'raw', content: '{"q":1}' } }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(String(requestMock.mock.calls[1][0])).toBe('https://api.openheaders.io/v2/search');
    expect(requestOpts(1).body).toBe('{"q":1}');
    expect(res.body).toBe('final');
    expect(res.url).toBe('https://api.openheaders.io/v2/search');
  });

  it('manual mode surfaces a request()-path 3xx verbatim', async () => {
    requestMock.mockResolvedValue(requestResponse('', { statusCode: 302, headers: { location: '/moved' } }));
    const res = await transport().send(makeRequest({ redirect: 'manual', body: { kind: 'raw', content: 'q' } }));
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(302);
    expect(res.statusText).toBe('Found');
    expect(res.headers).toContainEqual({ key: 'location', value: '/moved' });
  });

  it('captures Set-Cookie arrays entry-wise into the jar through the request() path', async () => {
    resetCookieJars();
    requestMock.mockResolvedValue(
      requestResponse('ok', { headers: { 'set-cookie': ['session=abc; Path=/', 'theme=dark; Path=/'] } }),
    );
    const res = await transport().send(makeRequest({ cookieJarKey: 'ws-a', body: { kind: 'raw', content: 'q' } }));
    expect(res.cookiesCaptured).toEqual(['session', 'theme']);
  });

  it('maps a request()-path Set-Cookie array entry-wise onto the response headers', async () => {
    requestMock.mockResolvedValue(
      requestResponse('ok', {
        headers: {
          'set-cookie': [
            'session=abc123; Path=/; HttpOnly',
            'pref=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/',
          ],
        },
      }),
    );
    const res = await transport().send(makeRequest({ body: { kind: 'raw', content: 'q' } }));
    expect(res.headers.filter((h) => h.key === 'set-cookie')).toEqual([
      { key: 'set-cookie', value: 'session=abc123; Path=/; HttpOnly' },
      { key: 'set-cookie', value: 'pref=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/' },
    ]);
  });

  it('classifies a request()-path connect failure like the fetch path', async () => {
    requestMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    const attempt = transport().send(makeRequest({ body: { kind: 'raw', content: 'q' } }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/Connection refused by api\.openheaders\.io/);
  });

  it('aborts a hung request() and surfaces a TransportError naming the timeout', async () => {
    requestMock.mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const attempt = transport().send(makeRequest({ timeoutMs: 20, body: { kind: 'raw', content: 'q' } }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow('Request timed out after 20 ms.');
  });
});

describe('createNodeRequestTransport — gRPC hops and HTTP trailers', () => {
  function requestResponse(bodyText: string, overrides: Partial<NodeRequestResponse> = {}): NodeRequestResponse {
    return { statusCode: 200, headers: {}, body: Readable.from([Buffer.from(bodyText)]), ...overrides };
  }

  const GRPC_HEADERS = [{ key: 'Content-Type', value: 'application/grpc+proto' }];

  it('routes a gRPC POST through request(), method preserved', async () => {
    // fetch exposes no HTTP trailers (probed) — gRPC hops must ride the
    // request() pipeline or grpc-status would never be capturable.
    requestMock.mockResolvedValue(requestResponse('ok', { headers: { 'content-type': 'application/grpc+proto' } }));
    const res = await transport().send(
      makeRequest({ method: 'POST', headers: GRPC_HEADERS, body: { kind: 'raw', content: 'frame-bytes' } }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(requestMock.mock.calls[0][1].method).toBe('POST');
    expect(requestMock.mock.calls[0][1].body).toBe('frame-bytes');
    expect(res.status).toBe(200);
  });

  it('surfaces the trailers undici reports after the body read', async () => {
    requestMock.mockResolvedValue(requestResponse('ok', { trailers: { 'grpc-status': '0', 'grpc-message': 'OK' } }));
    const res = await transport().send(
      makeRequest({ method: 'POST', headers: GRPC_HEADERS, body: { kind: 'raw', content: 'q' } }),
    );
    expect(res.trailers).toEqual([
      { key: 'grpc-status', value: '0' },
      { key: 'grpc-message', value: 'OK' },
    ]);
  });

  it('omits the trailers field when the response carried none', async () => {
    requestMock.mockResolvedValue(requestResponse('ok'));
    const res = await transport().send(
      makeRequest({ method: 'POST', headers: GRPC_HEADERS, body: { kind: 'raw', content: 'q' } }),
    );
    expect(res.trailers).toBeUndefined();
  });

  it('a non-gRPC POST stays on the fetch path, which reports no trailers', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const res = await transport().send(
      makeRequest({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
        body: { kind: 'raw', content: '{}' },
      }),
    );
    expect(requestMock).not.toHaveBeenCalled();
    expect(res.trailers).toBeUndefined();
  });

  it('captures real HTTP trailers off the wire (real undici pipeline)', async () => {
    // The full path a mocked request() never exercises: undici's live
    // trailers object fills only after the Readable→web-stream bridge
    // drains through the capped read.
    const server = createServer((_req, res) => {
      res.writeHead(200, {
        'Content-Type': 'application/grpc+proto',
        Trailer: 'grpc-status, grpc-message',
      });
      res.write(Buffer.from([0, 0, 0, 0, 3, 8, 1, 16, 2]));
      res.addTrailers({ 'grpc-status': '0', 'grpc-message': 'OK' });
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          method: 'POST',
          url: `http://127.0.0.1:${port}/oh.probe.Service/Unary`,
          headers: GRPC_HEADERS,
          body: { kind: 'raw', content: '' },
        }),
      );
      expect(res.status).toBe(200);
      expect(res.trailers).toContainEqual({ key: 'grpc-status', value: '0' });
      expect(res.trailers).toContainEqual({ key: 'grpc-message', value: 'OK' });
      expect(res.headers.map((h) => h.key)).not.toContain('grpc-status');
    } finally {
      server.close();
    }
  });
});
