/**
 * Node request transport — the desktop host's RequestTransport over
 * undici fetch. This entry suite verifies the end-to-end basics:
 * response mapping, body materialization (raw / urlencoded /
 * multipart), the capped read matrix, the one-deadline timeout, and
 * the streaming interactive read. The per-module suites live in
 * `request-transport/`, mirroring the src split.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import {
  TransportError,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamHead,
  type TransportStreamObserver,
} from '@openheaders/oracle/live/request-exec/transport';
import { FormData, Headers, Response } from 'undici';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createH3HelperClient, type H3HelperClient } from '../../src/live/h3-helper/helper-process';
import { createNodeRequestTransport } from '../../src/live/node-request-transport';
import { fetchError, makeRequest, makeRig, redirectResponse } from './request-transport/helpers';

const { fetchMock, requestMock, transport, callInit } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
});

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

  it('maps multiple Set-Cookie response headers entry-wise, never comma-joined', async () => {
    // Display integrity rides undici's spec-current Headers iteration,
    // which yields each set-cookie separately (only `get()` joins). A
    // joined value would corrupt cookies carrying an `Expires=` comma.
    const headers = new Headers();
    headers.append('set-cookie', 'session=abc123; Path=/; HttpOnly');
    headers.append('set-cookie', 'pref=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/');
    fetchMock.mockResolvedValue(new Response('ok', { status: 200, headers }));
    const res = await transport().send(makeRequest());
    expect(res.headers.filter((h) => h.key === 'set-cookie')).toEqual([
      { key: 'set-cookie', value: 'session=abc123; Path=/; HttpOnly' },
      { key: 'set-cookie', value: 'pref=dark; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/' },
    ]);
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

describe('createNodeRequestTransport — streaming interactive read (sendStreaming)', () => {
  const encoder = new TextEncoder();
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** Observer that records everything it saw (chunk bytes copied — the
   *  transport may hand out subarray views of a shared buffer). */
  function collectStream() {
    const heads: TransportStreamHead[] = [];
    const chunks: Array<{ bytes: Uint8Array; totalBytes: number }> = [];
    const observer: TransportStreamObserver = {
      onHead: (head) => {
        heads.push(head);
      },
      onChunk: (bytes, totalBytes) => {
        chunks.push({ bytes: Uint8Array.from(bytes), totalBytes });
      },
    };
    return { observer, heads, chunks };
  }

  function streamingSend(
    request: TransportRequest,
    observer: TransportStreamObserver,
    signal?: AbortSignal,
  ): Promise<TransportResponse> {
    const t = transport();
    const fn = t.sendStreaming;
    if (!fn) throw new Error('the node transport must implement sendStreaming');
    return fn.call(t, request, observer, signal);
  }

  /** A fetch stub whose Response body is a caller-scripted stream wired
   *  to the exchange signal — aborting errors the stream mid-read,
   *  exactly as real undici propagates an abort. */
  function scriptedStreamFetch(
    script: (controller: ReadableStreamDefaultController<Uint8Array>) => void,
    init?: { status?: number; headers?: Record<string, string> },
  ): void {
    fetchMock.mockImplementation((_input, fetchInit) => {
      const signal = fetchInit?.signal ?? undefined;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener('abort', () => {
            controller.error(Object.assign(new Error('This operation was aborted.'), { name: 'AbortError' }));
          });
          script(controller);
        },
      });
      return Promise.resolve(
        new Response(stream, {
          status: init?.status ?? 200,
          statusText: 'OK',
          headers: init?.headers ?? { 'content-type': 'text/event-stream' },
        }),
      );
    });
  }

  it('surfaces the head, streams cap-bounded chunks in order, and resolves the same TransportResponse', async () => {
    scriptedStreamFetch((controller) => {
      controller.enqueue(encoder.encode('data: one\n\n'));
      controller.enqueue(encoder.encode('data: two\n\n'));
      controller.close();
    });
    const { observer, heads, chunks } = collectStream();
    const res = await streamingSend(makeRequest(), observer);
    expect(heads).toHaveLength(1);
    expect(heads[0].status).toBe(200);
    expect(heads[0].headers).toContainEqual({ key: 'content-type', value: 'text/event-stream' });
    const joined = chunks.map((c) => new TextDecoder().decode(c.bytes)).join('');
    expect(joined).toBe('data: one\n\ndata: two\n\n');
    expect(chunks.at(-1)?.totalBytes).toBe(joined.length);
    expect(res.body).toBe('data: one\n\ndata: two\n\n');
    expect(res.bodyTruncated).toBe(false);
    expect(res.streamEndedEarly).toBeUndefined();
  });

  it('caps live chunks at maxBodyBytes — the tail never sees bytes the snapshot drops', async () => {
    scriptedStreamFetch((controller) => {
      controller.enqueue(encoder.encode('x'.repeat(64)));
      controller.close();
    });
    const { observer, chunks } = collectStream();
    const res = await streamingSend(makeRequest({ maxBodyBytes: 16 }), observer);
    expect(res.bodyTruncated).toBe(true);
    expect(res.body).toBe('x'.repeat(16));
    // The cap abort is ordinary truncation, not an early end.
    expect(res.streamEndedEarly).toBeUndefined();
    const emitted = chunks.reduce((sum, c) => sum + c.bytes.byteLength, 0);
    expect(emitted).toBe(16);
    expect(chunks.at(-1)?.totalBytes).toBe(16);
  });

  it('an abort mid-body resolves the partial body with streamEndedEarly "aborted", never a throw', async () => {
    scriptedStreamFetch((controller) => {
      controller.enqueue(encoder.encode('data: partial\n\n'));
      // …then the stream hangs forever; only the abort ends it.
    });
    const controller = new AbortController();
    const { observer, chunks } = collectStream();
    const pending = streamingSend(makeRequest(), observer, controller.signal);
    while (chunks.length === 0) await sleep(5);
    controller.abort();
    const res = await pending;
    expect(res.status).toBe(200);
    expect(res.body).toBe('data: partial\n\n');
    expect(res.bodyTruncated).toBe(false);
    expect(res.streamEndedEarly).toEqual({ reason: 'aborted' });
  });

  it('a mid-body connection failure resolves the partial body with streamEndedEarly "error" + message', async () => {
    scriptedStreamFetch((controller) => {
      controller.enqueue(encoder.encode('partial payload'));
      setTimeout(() => controller.error(new Error('read ECONNRESET')), 10);
    });
    const { observer } = collectStream();
    const res = await streamingSend(makeRequest(), observer);
    expect(res.status).toBe(200);
    expect(res.body).toBe('partial payload');
    expect(res.streamEndedEarly).toEqual({ reason: 'error', message: 'read ECONNRESET' });
  });

  it('an abort before any response head still throws, exactly like send', async () => {
    fetchMock.mockImplementation(
      (_input, fetchInit) =>
        new Promise((_resolve, reject) => {
          fetchInit?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new TypeError('fetch failed'), { cause: new Error('aborted') }));
          });
        }),
    );
    const controller = new AbortController();
    const { observer, heads } = collectStream();
    const pending = streamingSend(makeRequest(), observer, controller.signal);
    await sleep(10);
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(TransportError);
    expect(heads).toHaveLength(0);
  });

  it('the buffered send keeps its contract — a mid-body failure still throws', async () => {
    scriptedStreamFetch((controller) => {
      controller.enqueue(encoder.encode('partial'));
      setTimeout(() => controller.error(new Error('read ECONNRESET')), 10);
    });
    await expect(transport().send(makeRequest())).rejects.toThrow('read ECONNRESET');
  });

  it('the head reports the FINAL hop after a redirect — intermediate hops stay silent', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/moved'));
    scriptedStreamFetch((controller) => {
      controller.enqueue(encoder.encode('landed'));
      controller.close();
    });
    // mockResolvedValueOnce wins for call 1; the scripted implementation
    // (registered second) answers call 2.
    const { observer, heads } = collectStream();
    const res = await streamingSend(makeRequest(), observer);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(heads).toHaveLength(1);
    expect(heads[0].status).toBe(200);
    expect(res.body).toBe('landed');
  });

  it('the request() pipeline streams too — gRPC hops keep trailers after a streamed read', async () => {
    requestMock.mockResolvedValue({
      statusCode: 200,
      headers: { 'content-type': 'application/grpc+proto' },
      body: Readable.from([Buffer.from([0, 0, 0, 0, 3]), Buffer.from([8, 1, 16])]),
      trailers: { 'grpc-status': '0' },
    });
    const { observer, heads, chunks } = collectStream();
    const res = await streamingSend(
      makeRequest({
        method: 'POST',
        headers: [{ key: 'Content-Type', value: 'application/grpc+proto' }],
        body: { kind: 'raw', content: '' },
      }),
      observer,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(heads).toHaveLength(1);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(res.trailers).toContainEqual({ key: 'grpc-status', value: '0' });
    expect(res.streamEndedEarly).toBeUndefined();
  });

  it('wire bytes stay exact through the streamed read (base64 body for non-UTF-8)', async () => {
    const wire = new Uint8Array([0x00, 0x01, 0xfe, 0xff, 0x41, 0x42]);
    scriptedStreamFetch((controller) => {
      controller.enqueue(wire);
      controller.close();
    });
    const { observer, chunks } = collectStream();
    const res = await streamingSend(makeRequest(), observer);
    expect(res.bodyEncoding).toBe('base64');
    expect(Array.from(Buffer.from(res.body, 'base64'))).toEqual(Array.from(wire));
    expect(Array.from(chunks[0].bytes)).toEqual(Array.from(wire));
  });

  it('stops a real chunked wire stream mid-flight (real undici pipeline)', async () => {
    // The full abort path a mocked fetch never exercises: undici's
    // socket teardown mid-read must surface as the partial-materializing
    // 'aborted' end, with the bytes that made it retained.
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: one\n\n');
      const timer = setInterval(() => res.write('data: tick\n\n'), 25);
      res.on('close', () => clearInterval(timer));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const controller = new AbortController();
      const { observer, heads, chunks } = collectStream();
      const t = createNodeRequestTransport();
      if (!t.sendStreaming) throw new Error('the node transport must implement sendStreaming');
      const pending = t.sendStreaming(
        makeRequest({ url: `http://127.0.0.1:${port}/net/sse` }),
        observer,
        controller.signal,
      );
      while (chunks.length === 0) await sleep(5);
      controller.abort();
      const res = await pending;
      expect(heads[0]?.status).toBe(200);
      expect(res.streamEndedEarly).toEqual({ reason: 'aborted' });
      expect(res.body.startsWith('data: one\n\n')).toBe(true);
      expect(res.bodyTruncated).toBe(false);
    } finally {
      server.close();
    }
  });
});

describe("createNodeRequestTransport — pinned '3' sends over the helper pipeline", () => {
  const FAKE_HELPER = fileURLToPath(new URL('./h3-helper/fixtures/fake-helper.mjs', import.meta.url));
  let h3Client: H3HelperClient | null = null;

  function h3Transport() {
    h3Client = createH3HelperClient({ binaryPath: process.execPath, args: [FAKE_HELPER], helloTimeoutMs: 2000 });
    return createNodeRequestTransport({ h3Client });
  }

  afterEach(() => {
    h3Client?.dispose();
    h3Client = null;
  });

  it('maps a full helper exchange onto the TransportResponse, protocol reported from the wire', async () => {
    const res = await h3Transport().send(
      makeRequest({
        httpVersion: '3',
        url: 'https://api.openheaders.io/ok',
        headers: [{ key: 'Accept', value: 'application/json' }],
      }),
    );
    expect(res.status).toBe(200);
    // Wire truth: 'h3' comes from the exchange's RESPONSE_HEAD, never
    // the knob — the always-on report's pinned-pipeline source.
    expect(res.httpVersion).toBe('h3');
    expect(res.trailers).toContainEqual({ key: 'x-fake-trailer', value: 'end' });
    const body = JSON.parse(res.body);
    expect(body.path).toBe('/ok');
    expect(body.headers).toContainEqual(['accept', 'application/json']);
  });

  it('the redirect follower rides the pipeline hop by hop, policy above the seam untouched', async () => {
    const res = await h3Transport().send(makeRequest({ httpVersion: '3', url: 'https://api.openheaders.io/redirect' }));
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).path).toBe('/ok');
    expect(res.url).toBe('https://api.openheaders.io/ok');
    expect(res.redirectChain).toEqual([
      expect.objectContaining({ url: 'https://api.openheaders.io/redirect', status: 302, location: '/ok' }),
    ]);
  });

  it('carries the trust legs onto the framed head: insecure, decrypted client key, connect address', async () => {
    const res = await h3Transport().send(
      makeRequest({
        httpVersion: '3',
        url: 'https://api.openheaders.io/ok',
        sslVerification: false,
        resolveToAddress: '127.0.0.1',
        clientCertificateRef: 'dev-cert',
        clientCertificatePem: 'CERT',
        // No passphrase — the key crosses the protocol verbatim.
        clientCertificateKeyPem: 'KEY-PKCS8',
      }),
    );
    const headers = Object.fromEntries(res.headers.map((h) => [h.key, h.value]));
    expect(headers['x-echo-insecure']).toBe('1');
    expect(headers['x-echo-connect-address']).toBe('127.0.0.1');
    expect(headers['x-echo-client-cert-key']).toBeDefined();
  });

  it('parses an exact TLS 1.3 IANA cipher list onto the framed head — trimmed, order kept', async () => {
    const res = await h3Transport().send(
      makeRequest({
        httpVersion: '3',
        url: 'https://api.openheaders.io/ok',
        tlsCipherSuites: ' TLS_AES_256_GCM_SHA384 : TLS_AES_128_GCM_SHA256 ',
      }),
    );
    const headers = Object.fromEntries(res.headers.map((h) => [h.key, h.value]));
    expect(headers['x-echo-cipher-suites']).toBe('TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256');
  });

  it('classifies a pre-head helper failure naming the HTTP version setting', async () => {
    const attempt = h3Transport().send(makeRequest({ httpVersion: '3', url: 'https://api.openheaders.io/error-pre' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/did not answer the QUIC handshake.*"HTTP version" setting/);
  });

  it('classifies a certificate-verification failure pointing at the SSL-verification setting', async () => {
    const attempt = h3Transport().send(
      makeRequest({ httpVersion: '3', url: 'https://api.openheaders.io/error-verify' }),
    );
    await expect(attempt).rejects.toThrow(/certificate verification failed.*SSL-verification setting/i);
  });

  it('classifies a handshake failure under a cipher restriction naming the cipher setting', async () => {
    const attempt = h3Transport().send(
      makeRequest({
        httpVersion: '3',
        url: 'https://api.openheaders.io/error-handshake',
        tlsCipherSuites: 'TLS_AES_256_GCM_SHA384',
      }),
    );
    await expect(attempt).rejects.toThrow(
      /TLS handshake .* failed over HTTP\/3.*"TLS cipher suites" setting restricts the offer/,
    );
  });
});
