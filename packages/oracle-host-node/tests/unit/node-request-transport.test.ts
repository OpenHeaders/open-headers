/**
 * Node request transport — the desktop host's RequestTransport over
 * undici fetch. Verifies body materialization (raw / urlencoded /
 * multipart), response mapping, per-request TLS policy (dispatcher
 * selection + agent reuse), and the rich error classification undici
 * affords via `err.cause.code` (vs. the browser's opaque failure).
 */

import { Readable } from 'node:stream';
import { createSecureContext } from 'node:tls';
import { TransportError, type TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, FormData, Headers, ProxyAgent, Response } from 'undici';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetCookieJars } from '../../src/live/cookie-jar';
import {
  connectOptionsFor,
  createNodeRequestTransport,
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
  it('rides the default dispatcher when no TLS-affecting option is set', async () => {
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

describe('createNodeRequestTransport — per-request HTTP/2 offer', () => {
  it('an allowHttp2-only tuple mints a dedicated agent, reused per tuple', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ allowHttp2: true }));
    await transport().send(makeRequest({ allowHttp2: true }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
  });

  it('allowHttp2 false or absent keeps the default dispatcher', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    await transport().send(makeRequest({ allowHttp2: false }));
    expect(callInit(0).dispatcher).toBeUndefined();
    expect(callInit(1).dispatcher).toBeUndefined();
  });

  it('allowHttp2 combines with TLS options into its own distinct tuples', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest({ allowHttp2: true }));
    await transport().send(makeRequest({ allowHttp2: true, tlsMinVersion: '1.2' }));
    await transport().send(makeRequest({ tlsMinVersion: '1.2' }));
    const agents = [callInit(0).dispatcher, callInit(1).dispatcher, callInit(2).dispatcher];
    for (const a of agents) expect(a).toBeInstanceOf(Agent);
    expect(new Set(agents).size).toBe(3);
  });

  it('the redirect loop is protocol-blind: the h2-offering dispatcher rides every hop', async () => {
    fetchMock
      .mockResolvedValueOnce(redirectResponse(302, 'https://sso.openheaders.io/callback'))
      .mockResolvedValueOnce(new Response('ok'));
    await transport().send(makeRequest({ allowHttp2: true }));
    const first = callInit(0).dispatcher;
    expect(first).toBeInstanceOf(Agent);
    expect(callInit(1).dispatcher).toBe(first);
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

  it('an absent pin keeps the default dispatcher', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    expect(callInit(0).dispatcher).toBeUndefined();
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
    await transport().send(makeRequest({ resolveToAddress: '10.0.0.7', allowHttp2: true }));
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

  it('an absent ref keeps the default dispatcher', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    expect(callInit(0).dispatcher).toBeUndefined();
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
    await transport().send(makeRequest({ proxyUrl: PROXY_URL, allowHttp2: true }));
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

  it('a credential ref WITHOUT a proxy URL contributes nothing — default dispatcher, no failure', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    const res = await transport().send(makeRequest({ proxyCredentialRef: 'corp-proxy' }));
    expect(res.status).toBe(200);
    expect(callInit(0).dispatcher).toBeUndefined();
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

  it('an absent socket path keeps the default dispatcher', async () => {
    fetchMock.mockResolvedValue(new Response('ok'));
    await transport().send(makeRequest());
    expect(callInit(0).dispatcher).toBeUndefined();
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
    await transport().send(makeRequest({ unixSocketPath: SOCKET_PATH, allowHttp2: true }));
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
