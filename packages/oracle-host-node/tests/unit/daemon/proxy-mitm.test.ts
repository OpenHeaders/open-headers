/**
 * L7 MITM capture-core laws (PROXY_PLAN.md Phase 2). Read-only capture:
 *  - a plain `http://` request is re-originated upstream and captured as
 *    a lifecycle on the reserved proxy partition;
 *  - a CONNECT to a SCOPED host is TLS-terminated with a CA-signed leaf,
 *    re-originated over TLS, and captured (the client trusts our CA);
 *  - a CONNECT to an UN-scoped host is an opaque blind tunnel — the
 *    client's TLS reaches the real upstream and NOTHING is captured;
 *  - an upstream failure on a scoped host is captured as a failed
 *    lifecycle and answered 502 downstream.
 */

import 'reflect-metadata';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { PROXY_LIFECYCLE_TAB_ID } from '@openheaders/core/proxy';
import type { ProxyCaRecord } from '@openheaders/core/types';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mintLeafCertificate, mintProxyCa } from '../../../src/daemon/proxy/ca-store';
import { ProxyCaptureLifecycleMapper } from '../../../src/daemon/proxy/capture-lifecycle';
import { createProxyMitmServer, type ProxyMitmServer } from '../../../src/daemon/proxy/mitm-server';
import type { ProxyCaProvider, ProxyScope } from '../../../src/daemon/proxy/mitm-types';

const HOST = '127.0.0.1';

function keyPem(pkcs8B64: string): string {
  const body = pkcs8B64.match(/.{1,64}/g)?.join('\n') ?? pkcs8B64;
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}

function listen(server: http.Server | https.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, HOST, () => resolve((server.address() as net.AddressInfo).port));
  });
}

function closeServer(server: http.Server | https.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function startHttpUpstream(): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'x-upstream': 'plain' });
    res.end(`plain:${req.url}`);
  });
  return { server, port: await listen(server) };
}

async function startHttpsUpstream(ca: ProxyCaRecord): Promise<{ server: https.Server; port: number }> {
  const leaf = await mintLeafCertificate(ca, [HOST]);
  const server = https.createServer({ key: keyPem(leaf.privateKeyPkcs8B64), cert: leaf.certPem }, (_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'x-upstream': 'secure' });
    res.end('secure-body');
  });
  return { server, port: await listen(server) };
}

/** Establish a CONNECT tunnel through the proxy, then TLS over it. */
function connectTunnelTls(proxyPort: number, host: string, port: number, ca: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const raw = net.connect(proxyPort, HOST, () => {
      raw.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n\r\n`);
    });
    let buf = Buffer.alloc(0);
    const onData = (chunk: Buffer): void => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf('\r\n\r\n');
      if (idx === -1) return;
      raw.removeListener('data', onData);
      const header = buf.subarray(0, idx).toString();
      if (!/^HTTP\/1\.\d 200/.test(header)) {
        reject(new Error(`CONNECT failed: ${header}`));
        return;
      }
      const tlsSock = tls.connect({ socket: raw, host, ca }, () => resolve(tlsSock));
      tlsSock.on('error', reject);
    };
    raw.on('data', onData);
    raw.on('error', reject);
  });
}

interface HttpResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/** Speak plain HTTP/1.1 over an already-connected socket (the decrypted tunnel). */
function httpOverSocket(socket: net.Socket, host: string, port: number, path: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { createConnection: () => socket, host, port, path, method: 'GET', headers: { host: `${host}:${port}` } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

/** A plain proxied GET — absolute-form request URL through the proxy port. */
function proxiedHttpGet(proxyPort: number, targetUrl: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const req = http.request(
      { host: HOST, port: proxyPort, method: 'GET', path: targetUrl, headers: { host: u.host } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

function scopeOf(patterns: readonly string[]): ProxyScope {
  return { isDecrypted: (host) => patterns.some((p) => host === p) };
}

function caProviderOf(ca: ProxyCaRecord | null): ProxyCaProvider {
  return { getCa: async () => ca };
}

describe('proxy MITM capture core', () => {
  let ca: ProxyCaRecord;
  let store: RequestLifecycleStore;
  let mapper: ProxyCaptureLifecycleMapper;
  let proxy: ProxyMitmServer;
  const cleanups: Array<() => Promise<void>> = [];

  beforeEach(async () => {
    ca = await mintProxyCa();
    store = new RequestLifecycleStore();
    mapper = new ProxyCaptureLifecycleMapper((u) => store.apply(u));
  });

  afterEach(async () => {
    if (proxy !== undefined) await proxy.close();
    for (const c of cleanups.splice(0)) await c();
  });

  function proxyRows() {
    return store.snapshotTab(PROXY_LIFECYCLE_TAB_ID);
  }

  it('re-originates and captures a plain HTTP request', async () => {
    const upstream = await startHttpUpstream();
    cleanups.push(() => closeServer(upstream.server));

    proxy = createProxyMitmServer({ caProvider: caProviderOf(ca), scope: scopeOf([]), observer: mapper });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstream.port}/hello`);
    expect(res.status).toBe(200);
    expect(res.headers['x-upstream']).toBe('plain');
    expect(res.body).toBe('plain:/hello');

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed'));
    const [row] = proxyRows();
    expect(row.tabId).toBe(PROXY_LIFECYCLE_TAB_ID);
    expect(row.method).toBe('GET');
    expect(row.url).toBe(`http://${HOST}:${upstream.port}/hello`);
    expect(row.statusCode).toBe(200);
    expect(row.responseHeaders?.some((h) => h.name.toLowerCase() === 'x-upstream')).toBe(true);
  });

  it('TLS-terminates and captures a scoped CONNECT host', async () => {
    const upstream = await startHttpsUpstream(ca);
    cleanups.push(() => closeServer(upstream.server));

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([HOST]),
      observer: mapper,
      upstreamTls: { ca: ca.certPem },
    });
    const port = await proxy.listen();

    // The client trusts OUR CA — proof the proxy presented a leaf it minted.
    const tunnel = await connectTunnelTls(port, HOST, upstream.port, ca.certPem);
    const res = await httpOverSocket(tunnel, HOST, upstream.port, '/secure');
    expect(res.status).toBe(200);
    expect(res.headers['x-upstream']).toBe('secure');
    expect(res.body).toBe('secure-body');

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed'));
    const [row] = proxyRows();
    expect(row.url).toBe(`https://${HOST}:${upstream.port}/secure`);
    expect(row.statusCode).toBe(200);
  });

  it('blind-tunnels an un-scoped CONNECT host and captures NOTHING', async () => {
    const upstream = await startHttpsUpstream(ca);
    cleanups.push(() => closeServer(upstream.server));

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]), // nothing scoped ⇒ passthrough
      observer: mapper,
    });
    const port = await proxy.listen();

    // The client trusts the UPSTREAM CA, not ours — the TLS is end-to-end,
    // proving the proxy never terminated it.
    const tunnel = await connectTunnelTls(port, HOST, upstream.port, ca.certPem);
    const res = await httpOverSocket(tunnel, HOST, upstream.port, '/secure');
    expect(res.status).toBe(200);
    expect(res.body).toBe('secure-body');

    // Give any (erroneous) capture a chance to land, then assert none did.
    await new Promise((r) => setTimeout(r, 50));
    expect(proxyRows()).toHaveLength(0);
  });

  it('passes through a scoped host opaquely when no CA is on record', async () => {
    const upstream = await startHttpsUpstream(ca);
    cleanups.push(() => closeServer(upstream.server));

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(null), // no CA ⇒ cannot terminate
      scope: scopeOf([HOST]),
      observer: mapper,
    });
    const port = await proxy.listen();

    const tunnel = await connectTunnelTls(port, HOST, upstream.port, ca.certPem);
    const res = await httpOverSocket(tunnel, HOST, upstream.port, '/secure');
    expect(res.status).toBe(200);
    await new Promise((r) => setTimeout(r, 50));
    expect(proxyRows()).toHaveLength(0);
  });

  it('captures an upstream failure on a scoped host as a failed lifecycle', async () => {
    // A scoped host whose upstream port has no listener → ECONNREFUSED.
    const deadPort = await freePort();

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([HOST]),
      observer: mapper,
      upstreamTls: { ca: ca.certPem },
    });
    const port = await proxy.listen();

    const tunnel = await connectTunnelTls(port, HOST, deadPort, ca.certPem);
    const res = await httpOverSocket(tunnel, HOST, deadPort, '/gone');
    expect(res.status).toBe(502);

    await waitFor(() => proxyRows().some((r) => r.phase === 'failed'));
    const [row] = proxyRows();
    expect(row.phase).toBe('failed');
    expect(row.error?.code).toBe('ECONNREFUSED');
  });
});

/** Bind then immediately free a port so a connect to it is refused. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, HOST, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
  });
}
