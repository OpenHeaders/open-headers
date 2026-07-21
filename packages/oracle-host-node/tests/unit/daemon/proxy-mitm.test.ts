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
import type { ProxyCaRecord, Rule, RuleCondition } from '@openheaders/core/types';
import { RequestLifecycleStore } from '@openheaders/oracle/request-lifecycle-store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProxyBodyStore } from '../../../src/daemon/proxy/body-store';
import { mintLeafCertificate, mintProxyCa } from '../../../src/daemon/proxy/ca-store';
import { ProxyCaptureLifecycleMapper } from '../../../src/daemon/proxy/capture-lifecycle';
import { createProxyMitmServer, type ProxyMitmServer } from '../../../src/daemon/proxy/mitm-server';
import type { ProxyCaProvider, ProxyScope } from '../../../src/daemon/proxy/mitm-types';
import { createProxyRuleEnforcer } from '../../../src/daemon/proxy/rule-enforcement';

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

/** A plain proxied POST with a body — same absolute-form shape. */
function proxiedHttpPost(proxyPort: number, targetUrl: string, body: string): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const u = new URL(targetUrl);
    const req = http.request(
      {
        host: HOST,
        port: proxyPort,
        method: 'POST',
        path: targetUrl,
        headers: { host: u.host, 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on('error', reject);
    req.end(body);
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
  let bodyStore: ProxyBodyStore;
  let mapper: ProxyCaptureLifecycleMapper;
  let proxy: ProxyMitmServer;
  const cleanups: Array<() => Promise<void>> = [];

  beforeEach(async () => {
    ca = await mintProxyCa();
    store = new RequestLifecycleStore();
    bodyStore = new ProxyBodyStore();
    mapper = new ProxyCaptureLifecycleMapper((u) => store.apply(u), bodyStore);
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

  // ── Phase 3: rule enforcement + L4 timings ────────────────────────

  let fixtureSeq = 0;
  const uid = (): string => `fixture-${++fixtureSeq}`;
  const matchAll = (): RuleCondition[] => [{ uid: uid(), type: 'url-filter', values: ['*'] }];
  const ruleBase = (type: Rule['type']) => ({
    schemaVersion: 5,
    uid: uid(),
    path: `rules/collection/${type}`,
    name: `${type}-rule`,
    enabled: true,
    published: true,
    conditions: matchAll(),
  });

  function enforcerOf(rules: Rule[]) {
    return createProxyRuleEnforcer({ getRules: () => rules });
  }

  it('enforces header rules both directions on a captured exchange', async () => {
    let seenUpstream: http.IncomingHttpHeaders = {};
    const server = http.createServer((req, res) => {
      seenUpstream = req.headers;
      res.writeHead(200, { 'content-type': 'text/plain', 'x-upstream-only': 'strip-me' });
      res.end('ok');
    });
    const upstreamPort = await listen(server);
    cleanups.push(() => closeServer(server));

    const rule: Rule = {
      ...ruleBase('header'),
      type: 'header',
      action: {
        requestHeaders: [{ uid: uid(), operation: 'override', headerName: 'X-Minted', value: 'proxy-plane' }],
        responseHeaders: [
          { uid: uid(), operation: 'remove', headerName: 'X-Upstream-Only' },
          { uid: uid(), operation: 'add', headerName: 'Via', value: 'oh-proxy' },
        ],
      },
    } as Rule;

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstreamPort}/mod`);
    expect(res.status).toBe(200);
    expect(seenUpstream['x-minted']).toBe('proxy-plane');
    expect(res.headers['x-upstream-only']).toBeUndefined();
    expect(res.headers.via).toBe('oh-proxy');

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed'));
    const [row] = proxyRows();
    // The lifecycle reports the wire-truth sets — post-rewrite both ways.
    expect(row.requestHeaders?.some((h) => h.name === 'X-Minted' && h.value === 'proxy-plane')).toBe(true);
    expect(row.responseHeaders?.some((h) => h.name.toLowerCase() === 'x-upstream-only')).toBe(false);
    expect(row.responseHeaders?.some((h) => h.name === 'Via' && h.value === 'oh-proxy')).toBe(true);
  });

  it('answers a block rule with a synthesized 502 and a failed lifecycle', async () => {
    const rule: Rule = { ...ruleBase('block'), type: 'block', action: {} } as Rule;
    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:1/blocked`);
    expect(res.status).toBe(502);

    await waitFor(() => proxyRows().some((r) => r.phase === 'failed'));
    const [row] = proxyRows();
    expect(row.error?.code).toBe('oh:rule-blocked');
    expect(row.error?.reason).toContain(rule.uid);
  });

  it('rewrites the target in place for a redirect rule and records the internal hop', async () => {
    const paths: string[] = [];
    const server = http.createServer((req, res) => {
      paths.push(req.url ?? '');
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('rewritten');
    });
    const upstreamPort = await listen(server);
    cleanups.push(() => closeServer(server));

    const rule: Rule = {
      ...ruleBase('redirect'),
      type: 'redirect',
      action: { redirectTo: `http://${HOST}:${upstreamPort}/rewritten` },
    } as Rule;
    rule.conditions = [{ uid: uid(), type: 'url-filter', values: [`*://${HOST}:${upstreamPort}/original`] }];

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstreamPort}/original`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('rewritten');
    expect(paths).toEqual(['/rewritten']);

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed'));
    const [row] = proxyRows();
    expect(row.url).toBe(`http://${HOST}:${upstreamPort}/rewritten`);
    expect(row.redirectHops).toHaveLength(1);
    expect(row.redirectHops[0]).toMatchObject({
      sourceUrl: `http://${HOST}:${upstreamPort}/original`,
      redirectUrl: `http://${HOST}:${upstreamPort}/rewritten`,
      internal: true,
    });
  });

  it('holds a matched delay rule’s duration before re-originating', async () => {
    const upstream = await startHttpUpstream();
    cleanups.push(() => closeServer(upstream.server));

    const rule: Rule = { ...ruleBase('delay'), type: 'delay', action: { delayMs: 120 } } as Rule;
    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const before = Date.now();
    const res = await proxiedHttpGet(port, `http://${HOST}:${upstream.port}/slow`);
    expect(res.status).toBe(200);
    expect(Date.now() - before).toBeGreaterThanOrEqual(115);

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed'));
    const [row] = proxyRows();
    const timings = row.har[0]?.timings;
    // The rule's hold lands in the queueing leg — deliberate, honest.
    expect(timings?.blocked).toBeGreaterThanOrEqual(115);
  });

  it('attaches a synthesized HAR entry with measured L4 legs and byte counts', async () => {
    const upstream = await startHttpUpstream();
    cleanups.push(() => closeServer(upstream.server));

    proxy = createProxyMitmServer({ caProvider: caProviderOf(ca), scope: scopeOf([]), observer: mapper });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstream.port}/timed`);
    expect(res.status).toBe(200);

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed' && r.har[0] != null));
    const [row] = proxyRows();
    const har = row.har[0];
    expect(har?._ohEntrySource).toBe('proxy');
    expect(har?._ohHeaderCapture).toEqual({ request: 'effective', response: 'effective' });
    expect(har?.request?.url).toBe(`http://${HOST}:${upstream.port}/timed`);
    expect(har?.response?.status).toBe(200);
    expect(har?.response?.bodySize).toBe(Buffer.byteLength(res.body));
    const timings = har?.timings;
    expect(timings).toBeDefined();
    // A fresh loopback socket: connect leg measured, no TLS leg.
    expect(timings?.connect).toBeGreaterThanOrEqual(0);
    expect(timings?.ssl).toBe(-1);
    expect(timings?.wait).toBeGreaterThanOrEqual(0);
    expect(timings?.receive).toBeGreaterThanOrEqual(0);
    expect(har?.time).toBeGreaterThanOrEqual(0);
  });

  // ── Body tee + body-touching rules ─────────────────────────────────

  it('tees the response body out-of-row and states the identity content size', async () => {
    const upstream = await startHttpUpstream();
    cleanups.push(() => closeServer(upstream.server));

    proxy = createProxyMitmServer({ caProvider: caProviderOf(ca), scope: scopeOf([]), observer: mapper });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstream.port}/teed`);
    expect(res.status).toBe(200);

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed' && r.har[0] != null));
    const [row] = proxyRows();
    expect(row.har[0]?.response?.content.size).toBe(Buffer.byteLength(res.body));
    // The lazy pull's answer — resolved from the store, shaped as text.
    expect(bodyStore.resolve(row.requestId, 0)).toMatchObject({ content: 'plain:/teed', encoding: '' });
  });

  it('substitutes a static request-body rule and records the two-sided override', async () => {
    let seenBody = '';
    let seenLength: string | undefined;
    const server = http.createServer((req, res) => {
      seenLength = req.headers['content-length'];
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        seenBody = Buffer.concat(chunks).toString();
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{"ok":true}');
      });
    });
    const upstreamPort = await listen(server);
    cleanups.push(() => closeServer(server));

    const rule: Rule = {
      ...ruleBase('request-body'),
      type: 'request-body',
      action: { bodyType: 'static', requestBody: '{"sent":"literal"}', resourceType: 'rest' },
    } as Rule;

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpPost(port, `http://${HOST}:${upstreamPort}/replace`, '{"original":1}');
    expect(res.status).toBe(200);
    expect(seenBody).toBe('{"sent":"literal"}');
    expect(seenLength).toBe(String(Buffer.byteLength('{"sent":"literal"}')));

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed' && r.har[0] != null));
    const [row] = proxyRows();
    expect(row.requestOverride?.ruleUid).toBe(rule.uid);
    expect(row.requestOverride?.sent.body).toEqual({ content: '{"sent":"literal"}', encoding: '' });
    expect(row.requestOverride?.original?.body).toEqual({ content: '{"original":1}', encoding: '' });
    // The HAR carries the WIRE body — the substituted literal.
    expect(row.har[0]?.request?.postData?.text).toBe('{"sent":"literal"}');
    expect(row.har[0]?.request?.bodySize).toBe(Buffer.byteLength('{"sent":"literal"}'));
  });

  it('answers a mock response rule without re-originating', async () => {
    // A dead upstream port — a mock that tried to dial it would 502.
    const deadPort = await freePort();

    const rule: Rule = {
      ...ruleBase('response'),
      type: 'response',
      action: {
        responseSource: 'mock',
        bodyType: 'static',
        responseBody: '{"mocked":true}',
        statusCode: 0,
        contentType: '',
        responseHeaders: { 'X-Mock': 'yes' },
      },
    } as Rule;

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${deadPort}/mocked`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json');
    expect(res.headers['x-mock']).toBe('yes');
    expect(res.body).toBe('{"mocked":true}');

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed' && r.har[0] != null));
    const [row] = proxyRows();
    expect(row.statusCode).toBe(200);
    expect(row.responseOverride?.ruleUid).toBe(rule.uid);
    expect(row.responseOverride?.served.body).toEqual({ content: '{"mocked":true}', encoding: '' });
    expect(row.responseOverride?.original).toBeUndefined();
    expect(bodyStore.resolve(row.requestId, 0)).toMatchObject({ content: '{"mocked":true}' });
  });

  it('substitutes a network-source response and captures the real reply as the original', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(418, 'Teapot', { 'content-type': 'text/plain', 'x-real': 'kept' });
      res.end('real-body');
    });
    const upstreamPort = await listen(server);
    cleanups.push(() => closeServer(server));

    const rule: Rule = {
      ...ruleBase('response'),
      type: 'response',
      action: {
        responseSource: 'network',
        bodyType: 'static',
        responseBody: 'served-body',
        statusCode: 0,
        contentType: '',
        responseHeaders: {},
      },
    } as Rule;

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstreamPort}/substituted`);
    // The 0-sentinel keeps the real status; the body is the literal.
    expect(res.status).toBe(418);
    expect(res.headers['x-real']).toBe('kept');
    expect(res.body).toBe('served-body');

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed' && r.responseOverride !== undefined));
    const [row] = proxyRows();
    expect(row.statusCode).toBe(418);
    expect(row.responseOverride?.served.body).toEqual({ content: 'served-body', encoding: '' });
    expect(row.responseOverride?.original?.statusCode).toBe(418);
    expect(row.responseOverride?.original?.body).toEqual({ content: 'real-body', encoding: '' });
    expect(bodyStore.resolve(row.requestId, 0)).toMatchObject({ content: 'served-body' });
  });

  it('releases the reply untouched when a response-gated network rule fails at arrival', async () => {
    const upstream = await startHttpUpstream();
    cleanups.push(() => closeServer(upstream.server));

    const rule: Rule = {
      ...ruleBase('response'),
      type: 'response',
      action: {
        responseSource: 'network',
        bodyType: 'static',
        responseBody: 'never-served',
        statusCode: 0,
        contentType: '',
        responseHeaders: {},
      },
    } as Rule;
    rule.conditions.push({ uid: uid(), type: 'response-header', values: [], headerName: 'X-Absent' });

    proxy = createProxyMitmServer({
      caProvider: caProviderOf(ca),
      scope: scopeOf([]),
      observer: mapper,
      enforcer: enforcerOf([rule]),
    });
    const port = await proxy.listen();

    const res = await proxiedHttpGet(port, `http://${HOST}:${upstream.port}/untouched`);
    expect(res.status).toBe(200);
    expect(res.body).toBe('plain:/untouched');

    await waitFor(() => proxyRows().some((r) => r.phase === 'completed'));
    const [row] = proxyRows();
    expect(row.responseOverride).toBeUndefined();
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
