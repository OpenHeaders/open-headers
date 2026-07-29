/**
 * Node request transport — the desktop host's RequestTransport over
 * undici fetch. Verifies body materialization (raw / urlencoded /
 * multipart), response mapping, per-request TLS policy (dispatcher
 * selection + agent reuse), and the rich error classification undici
 * affords via `err.cause.code` (vs. the browser's opaque failure).
 */

import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { createSecureContext } from 'node:tls';
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import {
  TransportError,
  type TransportRequest,
  type TransportResponse,
  type TransportStreamHead,
  type TransportStreamObserver,
} from '@openheaders/oracle/live/request-exec/transport';
import { Agent, FormData, Headers, ProxyAgent, Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCookieJars } from '../../src/live/cookie-jar';
import {
  connectOptionsFor,
  createNodeRequestTransport,
  httpVersionPolicy,
  type NodeFetchFn,
  type NodeRequestFn,
  type NodeRequestResponse,
} from '../../src/live/node-request-transport';

const fetchMock = vi.fn<NodeFetchFn>();
const requestMock = vi.fn<NodeRequestFn>();

/** Transport wired to the mocks via both wire seams — the tests observe
 *  the exact init (headers, body, dispatcher) the transport builds. */
const transport = () => createNodeRequestTransport({ fetchFn: fetchMock, requestFn: requestMock });

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
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

describe('createNodeRequestTransport — per-request TLS policy', () => {
  it('rides the ONE shared default agent when no TLS-affecting option is set', async () => {
    // Every direct send carries a dispatcher now — the always-on
    // negotiated-protocol report needs a connector seat undici's
    // global default dispatcher doesn't offer. Default-tuple sends
    // still share a single agent across sends and transports.
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ sslVerification: true }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
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

  it('routes a TLS version / cipher tuple through a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const tuple = { tlsMinVersion: '1.0' as const, tlsMaxVersion: '1.2' as const };
    await transport().send(makeRequest(tuple));
    await transport().send(makeRequest(tuple));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('distinct TLS tuples get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ tlsMinVersion: '1.0' }));
    await transport().send(makeRequest({ tlsMaxVersion: '1.2' }));
    await transport().send(makeRequest({ tlsCipherSuites: 'TLS_AES_128_GCM_SHA256' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(3);
  });

  it('combines verification-off with version/cipher options on ONE shared agent', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const tuple = {
      sslVerification: false,
      tlsMinVersion: '1.1' as const,
      tlsCipherSuites: 'ECDHE-RSA-AES128-GCM-SHA256',
    };
    await transport().send(makeRequest(tuple));
    await transport().send(makeRequest(tuple));
    await transport().send(makeRequest({ sslVerification: false }));
    const combined = callInit(0).dispatcher;
    expect(combined).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(combined);
    // Insecure-only is a DIFFERENT tuple — different agent.
    expect(callInit(2).dispatcher).not.toBe(combined);
  });

  it('the per-tuple dispatcher rides EVERY hop of a redirect chain', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ tlsMinVersion: '1.0' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('evicts the oldest agent past the cache cap; a re-request mints a fresh one', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const tuple = { tlsCipherSuites: 'EVICTION-PROBE' };
    await transport().send(makeRequest(tuple));
    const original = callInit(0).dispatcher;
    expect(original).toBeInstanceOf(Agent);
    // Flood the cache with more distinct tuples than the 32-entry cap
    // holds — the probe tuple's agent must age out.
    for (let i = 0; i < 35; i++) {
      await transport().send(makeRequest({ tlsCipherSuites: `FLOOD-${i}` }));
    }
    await transport().send(makeRequest(tuple));
    const remade = callInit(36).dispatcher;
    expect(remade).toBeInstanceOf(Agent);
    expect(remade).not.toBe(original);
  });

  it('a floor lowered below 1.2 without an explicit cipher list supplies what THIS stack accepts', () => {
    // The override is runtime-probed by design: OpenSSL 3 blocks
    // TLS < 1.2 signature algorithms at its default security level and
    // needs `@SECLEVEL=0`; BoringSSL (the Electron test runner) rejects
    // that syntax and needs nothing. Mirror the probe so the assertion
    // is exact on either stack.
    let stackAccepts: string | undefined;
    try {
      createSecureContext({ ciphers: 'DEFAULT@SECLEVEL=0' });
      stackAccepts = 'DEFAULT@SECLEVEL=0';
    } catch {
      stackAccepts = undefined;
    }
    expect(connectOptionsFor(makeRequest({ tlsMinVersion: '1.1' })).ciphers).toBe(stackAccepts);
    expect(connectOptionsFor(makeRequest({ tlsMinVersion: '1.0' })).ciphers).toBe(stackAccepts);
  });

  it('an explicit cipher list wins verbatim over the lowered-floor default', () => {
    const bag = connectOptionsFor(makeRequest({ tlsMinVersion: '1.1', tlsCipherSuites: 'AES128-SHA' }));
    expect(bag.ciphers).toBe('AES128-SHA');
  });

  it('a 1.2+ floor (or none) supplies no cipher override', () => {
    expect(connectOptionsFor(makeRequest({ tlsMinVersion: '1.2' })).ciphers).toBeUndefined();
    expect(connectOptionsFor(makeRequest()).ciphers).toBeUndefined();
  });

  it('classifies a no-usable-cipher failure naming the cipher setting', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_NO_CIPHER_MATCH'));
    await expect(transport().send(makeRequest({ tlsCipherSuites: 'BOGUS-SUITE' }))).rejects.toThrow(
      /"TLS cipher suites" setting/,
    );
  });

  it('classifies a handshake failure pointing at the TLS settings when they are tuned', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION'));
    await expect(transport().send(makeRequest({ tlsMinVersion: '1.0', tlsMaxVersion: '1.1' }))).rejects.toThrow(
      /TLS version and cipher suite settings/,
    );
  });

  it('classifies a handshake failure WITHOUT naming settings when none are tuned', async () => {
    fetchMock.mockRejectedValue(fetchError('EPROTO'));
    const attempt = transport().send(makeRequest());
    await expect(attempt).rejects.toThrow(/TLS handshake with api\.openheaders\.io failed \(EPROTO\)\.$/);
  });
});

describe('createNodeRequestTransport — per-request HTTP version', () => {
  it('a pinned-h2 tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2' }));
    await transport().send(makeRequest({ httpVersion: '2' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it("'auto' and absent share the default tuple; '1.1' mints its own", async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ httpVersion: 'auto' }));
    await transport().send(makeRequest({ httpVersion: '1.1' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
    expect(callInit(2).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(2).dispatcher).not.toBe(first);
  });

  it('httpVersion combines with TLS options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2' }));
    await transport().send(makeRequest({ httpVersion: '2', tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(3);
  });

  it('the redirect loop is protocol-blind: the pinned dispatcher rides every hop', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ httpVersion: '2' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it("fails honestly BEFORE the wire when '2-prior-knowledge' routes through a proxy", async () => {
    // The tunnel CAN carry raw h2 framing in principle — this runtime
    // just doesn't dial the pipeline through one yet, and quietly
    // negotiating via the tunnel's connector would betray the pin.
    const attempt = transport().send(
      makeRequest({ httpVersion: '2-prior-knowledge', proxyUrl: 'http://proxy.openheaders.io:3128' }),
    );
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/prior-knowledge HTTP\/2 through a tunnel/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly BEFORE the wire on '3' (Phase E honors it)", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '3' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/HTTP\/3/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails honestly BEFORE the wire when '2' is pinned through a proxy", async () => {
    const attempt = transport().send(makeRequest({ httpVersion: '2', proxyUrl: 'http://proxy.openheaders.io:3128' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/proxy tunnel owns protocol negotiation/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies the pinned dial guard failure naming the HTTP version setting', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), {
        cause: Object.assign(new Error('api.openheaders.io:443 negotiated http/1.1 instead of the pinned HTTP/2.'), {
          code: 'OH_ERR_H2_NOT_NEGOTIATED',
        }),
      }),
    );
    await expect(transport().send(makeRequest({ httpVersion: '2' }))).rejects.toThrow(
      /negotiated http\/1\.1 instead of the pinned HTTP\/2.*"HTTP version" setting/,
    );
  });

  it('classifies a no-application-protocol alert as the server refusing the h2-only offer', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV1_ALERT_NO_APPLICATION_PROTOCOL'));
    await expect(transport().send(makeRequest({ httpVersion: '2' }))).rejects.toThrow(
      /rejected the HTTP\/2-only offer.*doesn't speak HTTP\/2/,
    );
  });
});

describe('createNodeRequestTransport — per-request resolve-to-address pin', () => {
  it('a pin-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('an absent pin rides the shared default agent, not a pin tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).not.toBe(callInit(0).dispatcher);
  });

  it('distinct pinned addresses get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.8' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('the pin combines with TLS and h2 options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7', tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7', httpVersion: '1.1' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher, callInit(3).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(4);
  });

  it('the pinned dispatcher rides EVERY hop of a redirect chain, cross-host hops included', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('classifies a refused connection naming the resolve-to-address setting when pinned', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }))).rejects.toThrow(
      /resolve-to-address setting points api\.openheaders\.io there/,
    );
  });

  it('classifies an unreachable pinned address naming the setting', async () => {
    fetchMock.mockRejectedValue(fetchError('EHOSTUNREACH'));
    await expect(transport().send(makeRequest({ resolveToAddress: '10.255.0.1' }))).rejects.toThrow(
      /No route to 10\.255\.0\.1 \(EHOSTUNREACH\) — the request's resolve-to-address setting/,
    );
  });

  it('classifies a connect timeout naming the pinned address', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_CONNECT_TIMEOUT'));
    await expect(transport().send(makeRequest({ resolveToAddress: '10.0.0.7' }))).rejects.toThrow(
      /timed out — the request's resolve-to-address setting points it at 10\.0\.0\.7/,
    );
  });

  it('does NOT name the setting on an unpinned refused connection', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /^Connection refused by api\.openheaders\.io\. Is the service running on that host\/port\?$/,
    );
  });
});

// Throwaway placeholder material — dispatcher IDENTITY is what these
// tests assert; a real handshake is the live pass.
const CERT_FIELDS = {
  clientCertificateRef: 'gateway-mtls',
  clientCertificatePem: '-----BEGIN CERTIFICATE-----\ntest-cert\n-----END CERTIFICATE-----',
  clientCertificateKeyPem: '-----BEGIN PRIVATE KEY-----\ntest-key\n-----END PRIVATE KEY-----',
};

describe('createNodeRequestTransport — per-request client certificate', () => {
  it('a certificate-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('an absent ref rides the shared default agent, not a certificate tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).not.toBe(callInit(0).dispatcher);
  });

  it('distinct refs get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS, clientCertificateRef: 'other-gateway' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('the SAME ref with rotated material mints a fresh agent (content-hash key segment)', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(
      makeRequest({
        ...CERT_FIELDS,
        clientCertificatePem: '-----BEGIN CERTIFICATE-----\nrotated-cert\n-----END CERTIFICATE-----',
      }),
    );
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('a passphrase change also rotates the tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS, clientCertificatePassphrase: 'swordfish' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    expect(new Set(agents).size).toBe(2);
  });

  it('the certificate combines with TLS and pin options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    await transport().send(makeRequest({ ...CERT_FIELDS, tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ ...CERT_FIELDS, resolveToAddress: '10.0.0.7' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher, callInit(3).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(4);
  });

  it('the certificate-bearing dispatcher rides EVERY hop of a redirect chain', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ ...CERT_FIELDS }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('fails BEFORE the wire when the ref did not resolve to vault material', async () => {
    const attempt = transport().send(makeRequest({ clientCertificateRef: 'gateway-mtls' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/vault entry "gateway-mtls", which doesn't exist on this device/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies certificate_required naming the configured vault entry', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /requires a client certificate and rejected the handshake .* vault entry "gateway-mtls"/,
    );
  });

  it('classifies certificate_required pointing at the setting when NO certificate is configured', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_TLSV13_ALERT_CERTIFICATE_REQUIRED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /requires a client certificate .* Pick one in the request's "Client certificate" setting/,
    );
  });

  it('classifies bad_certificate naming the vault entry when configured', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_SSLV3_ALERT_BAD_CERTIFICATE'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /rejected the presented client certificate .* vault entry "gateway-mtls"/,
    );
  });

  it('classifies a mid-handshake close naming the setting ONLY when a certificate is configured', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_SOCKET'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /closed the connection during the exchange\..*client-certificate setting/,
    );
  });

  it('keeps the generic message on a socket close with no certificate configured', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_SOCKET'));
    await expect(transport().send(makeRequest())).rejects.toThrow(/^Could not reach api\.openheaders\.io/);
  });

  it('classifies unloadable PEM material naming the vault entry', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_OSSL_PEM_NO_START_LINE'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /client certificate from vault entry "gateway-mtls" could not be loaded \(ERR_OSSL_PEM_NO_START_LINE\)/,
    );
  });

  it('a TLS 1.2 handshake_failure names the client certificate when one is configured', async () => {
    fetchMock.mockRejectedValue(fetchError('ERR_SSL_SSLV3_ALERT_HANDSHAKE_FAILURE'));
    await expect(transport().send(makeRequest({ ...CERT_FIELDS }))).rejects.toThrow(
      /TLS handshake with api\.openheaders\.io failed .* vault entry "gateway-mtls"/,
    );
  });
});

const PROXY_URL = 'http://proxy.openheaders.io:3128';

const PROXY_CRED_FIELDS = {
  proxyUrl: PROXY_URL,
  proxyCredentialRef: 'corp-proxy',
  proxyCredential: 'user:secret',
};

/** Build the REAL shape of a rejected proxy CONNECT (verified against a
 *  live CONNECT proxy): the first cause carries a NUMERIC `code: 0` and
 *  only its own cause holds the status-bearing tunnel message. */
function proxyTunnelError(status: number): Error {
  const abort = Object.assign(new Error(`Proxy response (${status}) !== 200 when HTTP Tunneling`), {
    name: 'AbortError',
    code: 'UND_ERR_ABORTED',
  });
  const cancelled = Object.assign(new Error('Request was cancelled.'), { code: 0, cause: abort });
  return Object.assign(new TypeError('fetch failed'), { cause: cancelled });
}

describe('createNodeRequestTransport — per-request proxy', () => {
  it('a proxy-only tuple mints a dedicated ProxyAgent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(ProxyAgent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('distinct proxy URLs get distinct dispatchers', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ proxyUrl: 'http://other-proxy.openheaders.io:8080' }));
    const dispatchers = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const d of dispatchers) expect(d).toBeInstanceOf(ProxyAgent);
    expect(new Set(dispatchers).size).toBe(2);
  });

  it('the SAME credential ref with a rotated value mints a fresh dispatcher (content-hash key segment)', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ ...PROXY_CRED_FIELDS }));
    await transport().send(makeRequest({ ...PROXY_CRED_FIELDS, proxyCredential: 'user:rotated' }));
    const dispatchers = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const d of dispatchers) expect(d).toBeInstanceOf(ProxyAgent);
    expect(new Set(dispatchers).size).toBe(2);
  });

  it('an authenticated and an unauthenticated send to the same proxy are distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ ...PROXY_CRED_FIELDS }));
    const dispatchers = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const d of dispatchers) expect(d).toBeInstanceOf(ProxyAgent);
    expect(new Set(dispatchers).size).toBe(2);
  });

  it('the proxy combines with TLS, h2, and certificate options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, sslVerification: false }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, httpVersion: '1.1' }));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, ...CERT_FIELDS }));
    await transport().send(makeRequest({ sslVerification: false }));
    const dispatchers = [
      callInit(0).dispatcher,
      callInit(1).dispatcher,
      callInit(2).dispatcher,
      callInit(3).dispatcher,
      callInit(4).dispatcher,
    ];
    for (const d of dispatchers.slice(0, 4)) expect(d).toBeInstanceOf(ProxyAgent);
    // The direct insecure send is a plain Agent, not a ProxyAgent.
    expect(dispatchers[4]).toBeInstanceOf(Agent);
    expect(new Set(dispatchers).size).toBe(5);
  });

  it('a credential ref WITHOUT a proxy URL contributes nothing — default agent, no failure', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    const res = await transport().send(makeRequest({ proxyCredentialRef: 'corp-proxy' }));
    expect(res.status).toBe(200);
    expect(callInit(1).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(callInit(0).dispatcher);
  });

  it('the proxied dispatcher rides EVERY hop of a redirect chain, cross-host hops included', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ proxyUrl: PROXY_URL }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(ProxyAgent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('fails BEFORE the wire when the credential ref did not resolve to a vault value', async () => {
    const attempt = transport().send(makeRequest({ proxyUrl: PROXY_URL, proxyCredentialRef: 'corp-proxy' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/vault entry "corp-proxy", which doesn't exist on this device/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails BEFORE the wire when the request sets both a proxy and a resolve-to-address pin', async () => {
    const attempt = transport().send(makeRequest({ proxyUrl: PROXY_URL, resolveToAddress: '10.0.0.7' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/proxy resolves the hostname itself/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies a refused connection naming the PROXY, not the target', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /Connection refused by the proxy at proxy\.openheaders\.io:3128/,
    );
  });

  it('classifies a DNS failure naming the proxy host', async () => {
    fetchMock.mockRejectedValue(fetchError('ENOTFOUND'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /Could not resolve the proxy host proxy\.openheaders\.io:3128/,
    );
  });

  it('classifies a connect timeout naming the proxy', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_CONNECT_TIMEOUT'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /Connection to the proxy at proxy\.openheaders\.io:3128 timed out/,
    );
  });

  it('classifies a 407 tunnel rejection naming the configured credential entry', async () => {
    fetchMock.mockRejectedValue(proxyTunnelError(407));
    await expect(transport().send(makeRequest({ ...PROXY_CRED_FIELDS }))).rejects.toThrow(
      /rejected the credentials \(407\).*vault entry "corp-proxy"/,
    );
  });

  it('classifies a 407 tunnel rejection pointing at the setting when NO credentials are configured', async () => {
    fetchMock.mockRejectedValue(proxyTunnelError(407));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /requires authentication \(407\)\. Set the request's proxy-credentials setting/,
    );
  });

  it('classifies a non-407 tunnel rejection as a proxy-to-target failure', async () => {
    fetchMock.mockRejectedValue(proxyTunnelError(502));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /could not open a tunnel to api\.openheaders\.io \(HTTP 502\)/,
    );
  });

  it('a target-leg certificate error through the proxy keeps its direct classification', async () => {
    fetchMock.mockRejectedValue(fetchError('DEPTH_ZERO_SELF_SIGNED_CERT'));
    await expect(transport().send(makeRequest({ proxyUrl: PROXY_URL }))).rejects.toThrow(
      /TLS certificate error reaching api\.openheaders\.io/,
    );
  });

  it('an unproxied send never mentions a proxy on a refused connection', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /^Connection refused by api\.openheaders\.io\. Is the service running on that host\/port\?$/,
    );
  });
});

const SOCKET_PATH = '/var/run/openheaders/api.sock';

describe('createNodeRequestTransport — per-request Unix socket target', () => {
  it('a socket-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('an absent socket path rides the shared default agent, not a socket tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).not.toBe(callInit(0).dispatcher);
  });

  it('distinct socket paths get distinct agents', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    await transport().send(makeRequest({ unixSocketPath: '/var/run/openheaders/other.sock' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(2);
  });

  it('the socket combines with TLS, h2, and certificate options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, sslVerification: false }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, httpVersion: '1.1' }));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, ...CERT_FIELDS }));
    await transport().send(makeRequest({ sslVerification: false }));
    const agents = [
      callInit(0).dispatcher,
      callInit(1).dispatcher,
      callInit(2).dispatcher,
      callInit(3).dispatcher,
      callInit(4).dispatcher,
    ];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(5);
  });

  it('the socket-pinned dispatcher rides EVERY hop of a redirect chain, cross-host hops included', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('fails BEFORE the wire when the request sets both a Unix socket and a proxy', async () => {
    const attempt = transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, proxyUrl: PROXY_URL }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/proxy tunnel can't dial a local socket/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails BEFORE the wire when the request sets both a Unix socket and a resolve-to-address pin', async () => {
    const attempt = transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, resolveToAddress: '10.0.0.7' }));
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/socket dial resolves no hostname/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('classifies a missing socket file naming the setting and the path', async () => {
    fetchMock.mockRejectedValue(fetchError('ENOENT'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /No socket at \/var\/run\/openheaders\/api\.sock — the request's Unix-socket setting dials it/,
    );
  });

  it('hints at the OS path-length limit when a long path fails as ENOENT', async () => {
    const longPath = `/tmp/${'x'.repeat(120)}.sock`;
    fetchMock.mockRejectedValue(fetchError('ENOENT'));
    await expect(transport().send(makeRequest({ unixSocketPath: longPath }))).rejects.toThrow(
      /Paths longer than the OS limit on socket paths/,
    );
  });

  it('classifies a non-socket file at the path', async () => {
    fetchMock.mockRejectedValue(fetchError('ENOTSOCK'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /exists but is not a socket/,
    );
  });

  it('classifies a permission-denied socket open', async () => {
    fetchMock.mockRejectedValue(fetchError('EACCES'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /Permission denied opening the socket at \/var\/run\/openheaders\/api\.sock/,
    );
  });

  it('classifies a refused socket connection (stale socket, nothing listening)', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /Connection refused on the socket at \/var\/run\/openheaders\/api\.sock/,
    );
  });

  it('classifies a connect timeout naming the socket', async () => {
    fetchMock.mockRejectedValue(fetchError('UND_ERR_CONNECT_TIMEOUT'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /Connection on the socket at \/var\/run\/openheaders\/api\.sock timed out/,
    );
  });

  it('a target-leg TLS error on a socket-pinned send keeps its direct classification', async () => {
    fetchMock.mockRejectedValue(fetchError('DEPTH_ZERO_SELF_SIGNED_CERT'));
    await expect(transport().send(makeRequest({ unixSocketPath: SOCKET_PATH }))).rejects.toThrow(
      /TLS certificate error reaching api\.openheaders\.io/,
    );
  });

  it('an unsocketed refused connection keeps the plain host message', async () => {
    fetchMock.mockRejectedValue(fetchError('ECONNREFUSED'));
    await expect(transport().send(makeRequest())).rejects.toThrow(
      /^Connection refused by api\.openheaders\.io\. Is the service running on that host\/port\?$/,
    );
  });
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

describe('createNodeRequestTransport — phase timing marks', () => {
  it('stamps waiting + download on every successful send, no redirect leg without hops', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const res = await transport().send(makeRequest());
    expect(res.phaseTimings).toBeDefined();
    expect(res.phaseTimings?.waitingMs).toBeGreaterThanOrEqual(0);
    expect(res.phaseTimings?.downloadMs).toBeGreaterThanOrEqual(0);
    expect(res.phaseTimings?.redirectMs).toBeUndefined();
  });

  it('stamps the redirect leg only when the chain had hops', async () => {
    fetchMock.mockResolvedValueOnce(redirectResponse(302, '/moved')).mockResolvedValueOnce(new Response('ok'));
    const res = await transport().send(makeRequest());
    expect(res.phaseTimings?.redirectMs).toBeGreaterThanOrEqual(0);
  });

  it('stamps marks under a manual redirect policy too, never a redirect leg', async () => {
    fetchMock.mockResolvedValue(redirectResponse(302, '/moved'));
    const res = await transport().send(makeRequest({ redirect: 'manual' }));
    expect(res.phaseTimings).toBeDefined();
    expect(res.phaseTimings?.redirectMs).toBeUndefined();
  });

  it('stamps marks on a streamed read as well', async () => {
    fetchMock.mockResolvedValue(new Response('streamed body'));
    const observer: TransportStreamObserver = { onHead: () => {}, onChunk: () => {} };
    const res = await transport().sendStreaming?.(makeRequest(), observer);
    expect(res?.phaseTimings).toBeDefined();
    expect(res?.phaseTimings?.waitingMs).toBeGreaterThanOrEqual(0);
  });

  it('real wire: the marks reflect where the exchange actually spent its time', async () => {
    // Head held ~50 ms, then the body drips a second chunk ~40 ms later
    // — waiting and download must each absorb their own delay. Lower
    // bounds only (CI jitter); the mocked matrix above pins the shape.
    const server = createServer((req, res) => {
      if (req.url === '/hop') {
        res.statusCode = 302;
        res.setHeader('Location', '/slow');
        res.end();
        return;
      }
      setTimeout(() => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain');
        res.write('first');
        setTimeout(() => res.end('second'), 40);
      }, 50);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/hop` }));
      expect(res.body).toBe('firstsecond');
      const timings = res.phaseTimings;
      expect(timings).toBeDefined();
      // The redirect hop answered immediately; its round-trip is real
      // but small — only its presence is pinned.
      expect(timings?.redirectMs).toBeGreaterThanOrEqual(0);
      expect(timings?.waitingMs).toBeGreaterThanOrEqual(30);
      expect(timings?.downloadMs).toBeGreaterThanOrEqual(20);
    } finally {
      server.close();
    }
  });
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

describe('createNodeRequestTransport — wire content decoding (real undici pipeline)', () => {
  it('a zstd-encoded body arrives decoded, Content-Encoding header preserved', async () => {
    // Pins undici's zstd decompression on the fetch path — the capture
    // relies on it, and it lives inside the body pipeline a mocked fetch
    // never exercises, so this test rides a real local server.
    const payload = JSON.stringify({ ok: true, host: 'api.openheaders.io' });
    const compressed = zstdCompressSync(Buffer.from(payload, 'utf8'));
    // Probe discipline: minted bytes must round-trip a real decoder.
    expect(zstdDecompressSync(compressed).toString('utf8')).toBe(payload);
    const server = createServer((_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Encoding', 'zstd');
      res.end(compressed);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/zstd` }));
      expect(res.body).toBe(payload);
      expect(res.bodyBytes).toBe(Buffer.byteLength(payload));
      expect(res.headers).toContainEqual({ key: 'content-encoding', value: 'zstd' });
    } finally {
      server.close();
    }
  });
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

describe('createNodeRequestTransport — instrumented network capture', () => {
  it('reports socket phases + connection facts for a captureNetwork send (real dial)', async () => {
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `http://127.0.0.1:${port}/net`, captureNetwork: true }),
      );
      expect(res.network).toBeDefined();
      expect(res.network?.httpVersion).toBe('http/1.1');
      expect(res.network?.remoteAddress).toBe('127.0.0.1');
      expect(res.network?.remotePort).toBe(port);
      expect(res.network?.localAddress).toBeDefined();
      expect(res.network?.localPort).toBeDefined();
      expect(res.phaseTimings?.connectMs).toBeDefined();
      // Cleartext dial — no TLS leg; IP-literal dial — no DNS leg.
      expect(res.phaseTimings?.tlsMs).toBeUndefined();
      expect(res.phaseTimings?.dnsMs).toBeUndefined();
      expect(res.phaseTimings?.waitingMs).toBeDefined();
    } finally {
      server.close();
    }
  });

  it('resolves a hostname dial with a DNS leg', async () => {
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `http://localhost:${port}/net`, captureNetwork: true }),
      );
      expect(res.network).toBeDefined();
      expect(res.phaseTimings?.dnsMs).toBeDefined();
      expect(res.phaseTimings?.connectMs).toBeDefined();
    } finally {
      server.close();
    }
  });

  it('omits the socket legs on a chained send but still attributes the final hop connection', async () => {
    const server = createServer((req, res) => {
      if (req.url === '/hop') {
        res.writeHead(302, { location: '/final' });
        res.end();
        return;
      }
      res.end('landed');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `http://127.0.0.1:${port}/hop`, captureNetwork: true }),
      );
      expect(res.body).toBe('landed');
      expect(res.redirectChain).toHaveLength(1);
      // The dial belongs to the first hop, inside the redirect phase —
      // no socket legs; the connection facts still attribute.
      expect(res.phaseTimings?.connectMs).toBeUndefined();
      expect(res.phaseTimings?.redirectMs).toBeDefined();
      expect(res.network?.remoteAddress).toBe('127.0.0.1');
    } finally {
      server.close();
    }
  });

  it('reports nothing without the opt-in (pooled dispatch untouched)', async () => {
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/net` }));
      expect(res.network).toBeUndefined();
      expect(res.phaseTimings?.connectMs).toBeUndefined();
    } finally {
      server.close();
    }
  });

  it('routes a captureNetwork send through a send-local Agent, never the shared cache', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    await transport().send(makeRequest({ captureNetwork: true }));
    await transport().send(makeRequest({ captureNetwork: true }));
    expect(callInit(0).dispatcher).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBeInstanceOf(Agent);
    // Send-local: each send minted its own agent.
    expect(callInit(0).dispatcher).not.toBe(callInit(1).dispatcher);
  });

  it('proxied sends skip instrumentation — the tunnel owns the dial', async () => {
    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
    const res = await transport().send(
      makeRequest({ captureNetwork: true, proxyUrl: 'http://proxy.openheaders.io:8080' }),
    );
    expect(callInit().dispatcher).toBeInstanceOf(ProxyAgent);
    expect(res.network).toBeUndefined();
  });
});

describe('createNodeRequestTransport — always-on negotiated-protocol report', () => {
  it("maps the knob to the dial's ALPN offer (pure policy)", () => {
    expect(httpVersionPolicy(undefined)).toEqual({ alpnProtocols: ['http/1.1', 'h2'], pinH2: false });
    expect(httpVersionPolicy('auto')).toEqual({ alpnProtocols: ['http/1.1', 'h2'], pinH2: false });
    expect(httpVersionPolicy('1.1')).toEqual({ alpnProtocols: ['http/1.1'], pinH2: false });
    expect(httpVersionPolicy('2')).toEqual({ alpnProtocols: ['h2'], pinH2: true });
  });

  it('reports the wire protocol WITHOUT the captureNetwork opt-in (real dial)', async () => {
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(makeRequest({ url: `http://127.0.0.1:${port}/net` }));
      // Cleartext — the only protocol undici fetch speaks without TLS.
      expect(res.httpVersion).toBe('http/1.1');
      // Still no instrumented facts: the always-on report is not the opt-in.
      expect(res.network).toBeUndefined();
    } finally {
      server.close();
    }
  });

  it('an instrumented send reports the same protocol on the always-on field', async () => {
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({ url: `http://127.0.0.1:${port}/net`, captureNetwork: true }),
      );
      expect(res.httpVersion).toBe('http/1.1');
      expect(res.network?.httpVersion).toBe('http/1.1');
    } finally {
      server.close();
    }
  });

  it("a pinned '2' send against a cleartext target fails honestly, naming the prior-knowledge route", async () => {
    const server = createServer((_req, res) => {
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = server.address() as AddressInfo;
    try {
      const attempt = createNodeRequestTransport().send(
        makeRequest({ url: `http://127.0.0.1:${port}/net`, httpVersion: '2' }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/cannot negotiate HTTP\/2.*prior knowledge/s);
    } finally {
      server.close();
    }
  });
});
