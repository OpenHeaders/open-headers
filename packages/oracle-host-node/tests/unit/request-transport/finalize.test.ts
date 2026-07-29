/**
 * Response finalization attribution: phase timing marks, instrumented
 * network capture (socket legs + connection facts), and the always-on
 * negotiated-protocol report.
 */

import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TransportError, type TransportStreamObserver } from '@openheaders/oracle/live/request-exec/transport';
import { Agent, ProxyAgent, Response } from 'undici';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNodeRequestTransport, httpVersionPolicy } from '../../../src/live/node-request-transport';
import { makeRequest, makeRig, redirectResponse } from './helpers';

const { fetchMock, requestMock, transport, callInit } = makeRig();

beforeEach(() => {
  fetchMock.mockReset();
  requestMock.mockReset();
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
