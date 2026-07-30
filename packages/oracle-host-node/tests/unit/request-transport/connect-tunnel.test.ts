/**
 * CONNECT-tunnel legs for the pinned pipelines — `'2-prior-knowledge'`
 * and the `'2'` ALPN pin dialed through a live local CONNECT proxy,
 * exercised end-to-end through the transport seam. Wire truth is the
 * law under test: the reported protocol comes from the tunnel's
 * negotiated socket (or the h2 frames it exchanged), never the knob;
 * failures classify per leg — proxy unreachable vs CONNECT rejected
 * (407 names the credentials setting) vs the pin's own honest
 * negotiation failure on the target leg.
 */

import * as http from 'node:http';
import { createServer as createH2cServer, createSecureServer } from 'node:http2';
import type { AddressInfo } from 'node:net';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { TransportError, type TransportRequest } from '@openheaders/oracle/live/request-exec/transport';
import { describe, expect, it } from 'vitest';
import { createNodeRequestTransport } from '../../../src/live/node-request-transport';

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

/** Self-signed localhost EC key + cert for the TLS rigs (SAN:
 *  localhost + 127.0.0.1) — requests dial with `sslVerification:
 *  false`, the self-signed dev-server knob. */
const TLS_RIG_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg+VtrunHMTXZgAibU
F2qvGK8NSsUZWHvQm8AVlNVmWFGhRANCAASDgxJ3TvvNgyCz2VshK+YrOxzEAEWx
0cpcyNNuVXO1o0b+qVJ7DbkV7ovHTz4JmNbiRBS6tFSI7XMxSQ0rScZZ
-----END PRIVATE KEY-----`;
const TLS_RIG_CERT = `-----BEGIN CERTIFICATE-----
MIIBmDCCAT+gAwIBAgIUUQH6jJxRPNXg/ZbEIFfgQX9jTWQwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MDcyOTA5MTI0NloXDTM2MDcyNjA5
MTI0NlowFDESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAEg4MSd077zYMgs9lbISvmKzscxABFsdHKXMjTblVztaNG/qlSew25Fe6L
x08+CZjW4kQUurRUiO1zMUkNK0nGWaNvMG0wHQYDVR0OBBYEFPXsX/To4JL36hvC
ltH5CbNutUaWMB8GA1UdIwQYMBaAFPXsX/To4JL36hvCltH5CbNutUaWMA8GA1Ud
EwEB/wQFMAMBAf8wGgYDVR0RBBMwEYIJbG9jYWxob3N0hwR/AAABMAoGCCqGSM49
BAMCA0cAMEQCIB0tJC0hYo5VLj5dDo5pjjNYWGkCMAg/+MY3yUvg20w5AiBopnqk
1hvixhrpP4hunsMqznTiTa07e7tnUcx6as6gpw==
-----END CERTIFICATE-----`;

interface ProxyRig {
  url: string;
  /** `host:port` CONNECT targets, arrival order — refused CONNECTs
   *  are never recorded. */
  tunnels: string[];
  /** `Proxy-Authorization` value of every CONNECT, arrival order. */
  authHeaders: Array<string | undefined>;
  close(): Promise<void>;
}

/** A minimal live CONNECT proxy. `requireAuth` (`user:password`)
 *  demands a matching Basic `Proxy-Authorization` and refuses with 407;
 *  `rejectStatus` refuses EVERY tunnel with that status — the
 *  proxy-reachable-but-tunnel-failed leg. */
async function startConnectProxy(options: { requireAuth?: string; rejectStatus?: number } = {}): Promise<ProxyRig> {
  const tunnels: string[] = [];
  const authHeaders: Array<string | undefined> = [];
  const sockets = new Set<{ destroy(): void }>();
  const server = http.createServer((_req, res) => {
    res.statusCode = 405;
    res.end();
  });
  server.on('connect', (req, clientSocket, head) => {
    authHeaders.push(req.headers['proxy-authorization']);
    if (options.requireAuth !== undefined) {
      const expected = `Basic ${Buffer.from(options.requireAuth).toString('base64')}`;
      if (req.headers['proxy-authorization'] !== expected) {
        clientSocket.write(
          'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="rig"\r\n\r\n',
        );
        clientSocket.destroy();
        return;
      }
    }
    if (options.rejectStatus !== undefined) {
      clientSocket.write(`HTTP/1.1 ${options.rejectStatus} Tunnel Refused\r\n\r\n`);
      clientSocket.destroy();
      return;
    }
    const target = req.url ?? '';
    tunnels.push(target);
    const [host, portStr] = target.split(':');
    const upstream = net.connect(Number(portStr ?? 443), host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    sockets.add(clientSocket).add(upstream);
    const drop = (): void => {
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on('error', drop);
    clientSocket.on('error', drop);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    tunnels,
    authHeaders,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

async function listenPort(server: net.Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  return (server.address() as AddressInfo).port;
}

/** An ephemeral port with nothing listening — bound once, then freed. */
async function closedPort(): Promise<number> {
  const probe = net.createServer();
  const port = await listenPort(probe);
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

describe('prior-knowledge HTTP/2 through a CONNECT tunnel', () => {
  it('carries cleartext h2 framing through the tunnel — wire truth from the exchanged frames', async () => {
    const origin = createH2cServer((req, res) => {
      res.end(JSON.stringify({ proto: req.httpVersion, path: req.url }));
    });
    const originPort = await listenPort(origin);
    const proxy = await startConnectProxy();
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `http://127.0.0.1:${originPort}/h2c`,
          httpVersion: '2-prior-knowledge',
          proxyUrl: proxy.url,
        }),
      );
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ proto: '2.0', path: '/h2c' });
      expect(res.httpVersion).toBe('h2');
      expect(proxy.tunnels).toEqual([`127.0.0.1:${originPort}`]);
    } finally {
      await proxy.close();
      origin.close();
    }
  });

  it('runs target-leg TLS over the tunnel socket with the trust knobs riding the wrap', async () => {
    const origin = createSecureServer({ key: TLS_RIG_KEY, cert: TLS_RIG_CERT }, (req, res) => {
      res.end(`spoke ${req.httpVersion}`);
    });
    const originPort = await listenPort(origin);
    const proxy = await startConnectProxy();
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `https://127.0.0.1:${originPort}/h2`,
          httpVersion: '2-prior-knowledge',
          proxyUrl: proxy.url,
          sslVerification: false,
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe('spoke 2.0');
      expect(res.httpVersion).toBe('h2');
      expect(proxy.tunnels).toEqual([`127.0.0.1:${originPort}`]);
    } finally {
      await proxy.close();
      origin.close();
    }
  });

  it('sends the resolved credential as Proxy-Authorization on the CONNECT', async () => {
    const origin = createH2cServer((_req, res) => {
      res.end('ok');
    });
    const originPort = await listenPort(origin);
    const proxy = await startConnectProxy({ requireAuth: 'user:secret' });
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `http://127.0.0.1:${originPort}/auth`,
          httpVersion: '2-prior-knowledge',
          proxyUrl: proxy.url,
          proxyCredentialRef: 'corp-proxy',
          proxyCredential: 'user:secret',
        }),
      );
      expect(res.status).toBe(200);
      expect(proxy.authHeaders).toEqual([`Basic ${Buffer.from('user:secret').toString('base64')}`]);
    } finally {
      await proxy.close();
      origin.close();
    }
  });

  it('a 407 CONNECT names the proxy-credentials setting and the vault entry', async () => {
    const proxy = await startConnectProxy({ requireAuth: 'user:secret' });
    try {
      const attempt = createNodeRequestTransport().send(
        makeRequest({
          url: 'http://api.openheaders.io/v1/ping',
          httpVersion: '2-prior-knowledge',
          proxyUrl: proxy.url,
          proxyCredentialRef: 'corp-proxy',
          proxyCredential: 'user:wrong',
        }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/rejected the credentials \(407\).*"corp-proxy"/s);
      expect(proxy.tunnels).toEqual([]);
    } finally {
      await proxy.close();
    }
  });

  it('a rejected CONNECT surfaces the proxy status as a tunnel failure, not an origin one', async () => {
    const proxy = await startConnectProxy({ rejectStatus: 502 });
    try {
      const attempt = createNodeRequestTransport().send(
        makeRequest({
          url: 'http://api.openheaders.io/v1/ping',
          httpVersion: '2-prior-knowledge',
          proxyUrl: proxy.url,
        }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/could not open a tunnel to api\.openheaders\.io \(HTTP 502\)/);
    } finally {
      await proxy.close();
    }
  });

  it('an unreachable proxy classifies as the proxy leg, keeping its raw refusal', async () => {
    const port = await closedPort();
    const attempt = createNodeRequestTransport().send(
      makeRequest({
        url: 'http://api.openheaders.io/v1/ping',
        httpVersion: '2-prior-knowledge',
        proxyUrl: `http://127.0.0.1:${port}`,
      }),
    );
    await expect(attempt).rejects.toBeInstanceOf(TransportError);
    await expect(attempt).rejects.toThrow(/Connection refused by the proxy at 127\.0\.0\.1:\d+/);
  });
});

describe("pinned '2' through a CONNECT tunnel", () => {
  it('negotiates h2 on the target leg over the tunnel — wire truth from the negotiated socket', async () => {
    const origin = createSecureServer({ key: TLS_RIG_KEY, cert: TLS_RIG_CERT }, (req, res) => {
      res.end(`spoke ${req.httpVersion}`);
    });
    const originPort = await listenPort(origin);
    const proxy = await startConnectProxy();
    try {
      const res = await createNodeRequestTransport().send(
        makeRequest({
          url: `https://127.0.0.1:${originPort}/pin`,
          httpVersion: '2',
          proxyUrl: proxy.url,
          sslVerification: false,
        }),
      );
      expect(res.status).toBe(200);
      expect(res.body).toBe('spoke 2.0');
      expect(res.httpVersion).toBe('h2');
      expect(proxy.tunnels).toEqual([`127.0.0.1:${originPort}`]);
    } finally {
      await proxy.close();
      origin.close();
    }
  });

  it('fails honestly when the tunneled target ignores the h2-only offer — never a silent downgrade', async () => {
    // A TLS server with no ALPN seat at all: the handshake completes
    // with no protocol negotiated, the client-side fallback reads
    // http/1.1, and the pin destroys the socket instead of speaking it.
    const origin = tls.createServer({ key: TLS_RIG_KEY, cert: TLS_RIG_CERT }, () => {});
    const originPort = await listenPort(origin);
    const proxy = await startConnectProxy();
    try {
      const attempt = createNodeRequestTransport().send(
        makeRequest({
          url: `https://127.0.0.1:${originPort}/legacy`,
          httpVersion: '2',
          proxyUrl: proxy.url,
          sslVerification: false,
        }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(
        /negotiated http\/1\.1 instead of the pinned HTTP\/2.*"HTTP version" setting/s,
      );
    } finally {
      await proxy.close();
      origin.close();
    }
  });

  it('a 407 CONNECT under the pin still names the proxy-credentials setting', async () => {
    const proxy = await startConnectProxy({ requireAuth: 'user:secret' });
    try {
      const attempt = createNodeRequestTransport().send(
        makeRequest({
          url: 'https://api.openheaders.io/v1/ping',
          httpVersion: '2',
          proxyUrl: proxy.url,
        }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/requires authentication \(407\)/);
      expect(proxy.tunnels).toEqual([]);
    } finally {
      await proxy.close();
    }
  });

  it('a plain http:// target under the pin fails before any tunnel is dialed', async () => {
    const proxy = await startConnectProxy();
    try {
      const attempt = createNodeRequestTransport().send(
        makeRequest({
          url: 'http://api.openheaders.io/v1/ping',
          httpVersion: '2',
          proxyUrl: proxy.url,
        }),
      );
      await expect(attempt).rejects.toBeInstanceOf(TransportError);
      await expect(attempt).rejects.toThrow(/cannot negotiate HTTP\/2/);
      expect(proxy.tunnels).toEqual([]);
      expect(proxy.authHeaders).toEqual([]);
    } finally {
      await proxy.close();
    }
  });
});
