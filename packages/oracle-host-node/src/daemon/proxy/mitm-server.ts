/**
 * L7 MITM capture core (`PROXY_PLAN.md` Phases 2+3). A forward HTTP(S)
 * proxy bound to a daemon-local port:
 *
 *  - plain `http://` requests (absolute-form) are re-originated upstream
 *    and captured;
 *  - `CONNECT host:port` for a SCOPED host is TLS-terminated with a
 *    locally-minted, CA-signed leaf, the decrypted requests parsed by an
 *    inner HTTP server, re-originated over TLS, and captured;
 *  - `CONNECT` for an UN-scoped host (or when no CA is on record) is an
 *    opaque blind tunnel — bytes piped verbatim, nothing decrypted or
 *    captured (`PROXY_SECURITY.md` §2.4 scoped-decrypt-by-default).
 *
 * Phase 3: when an enforcer is injected, every captured request runs the
 * rule engine before re-origination — block answers a synthesized 502
 * (`oh:rule-blocked` on the lifecycle), redirect/query-param rewrite the
 * target in place (recorded as internal hops), delay holds the exchange,
 * header mods rewrite the wire sets both directions. Blind tunnels stay
 * untouched — un-scoped traffic is never captured NOR enforced.
 *
 * L4 timings are measured on the proxy's own upstream sockets and
 * reported with the terminal callback; the lifecycle mapper folds them
 * into a synthesized HAR entry. Every capture is surfaced through a
 * {@link ProxyCaptureObserver}.
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import type { Duplex } from 'node:stream';
import * as tls from 'node:tls';
import { LeafContextCache } from './leaf-context';
import type { ProxyCaProvider, ProxyCaptureObserver, ProxyHeader, ProxyScope } from './mitm-types';
import type { ProxyRequestPlan, ProxyRuleEnforcer } from './rule-enforcement';

export interface ProxyMitmServerOptions {
  readonly caProvider: ProxyCaProvider;
  readonly scope: ProxyScope;
  readonly observer: ProxyCaptureObserver;
  /** Phase-3 rule enforcement; absent = read-only capture. */
  readonly enforcer?: ProxyRuleEnforcer;
  readonly now?: () => number;
  /**
   * Upstream TLS trust for re-origination. Defaults to normal system
   * verification (`rejectUnauthorized: true`) — we MITM the client but
   * still verify the real server. Tests point `ca` at their self-signed
   * upstream CA.
   */
  readonly upstreamTls?: { ca?: string | readonly string[]; rejectUnauthorized?: boolean };
}

interface TunnelTarget {
  readonly host: string;
  readonly port: number;
}

interface ResolvedTarget {
  readonly scheme: 'http' | 'https';
  readonly host: string;
  readonly port: number;
  readonly path: string;
  readonly url: string;
}

export interface ProxyMitmServer {
  /** Bind and resolve the actual port (pass `0` for an ephemeral port). */
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
  readonly port: number | null;
}

/** Parse a CONNECT authority (`host:port`, `[::1]:443`, bare host). */
function parseConnectAuthority(authority: string): TunnelTarget {
  const trimmed = authority.trim();
  if (trimmed.startsWith('[')) {
    const close = trimmed.indexOf(']');
    const host = close === -1 ? trimmed.slice(1) : trimmed.slice(1, close);
    const rest = close === -1 ? '' : trimmed.slice(close + 1);
    const port = rest.startsWith(':') ? Number(rest.slice(1)) : 443;
    return { host, port: Number.isFinite(port) ? port : 443 };
  }
  const colon = trimmed.lastIndexOf(':');
  if (colon === -1) return { host: trimmed, port: 443 };
  const port = Number(trimmed.slice(colon + 1));
  return { host: trimmed.slice(0, colon), port: Number.isFinite(port) ? port : 443 };
}

/** Flatten `rawHeaders` (`[name, value, name, value, …]`) preserving order + case. */
function rawHeaderPairs(rawHeaders: readonly string[]): ProxyHeader[] {
  const out: ProxyHeader[] = [];
  for (let i = 0; i + 1 < rawHeaders.length; i += 2) {
    out.push({ name: rawHeaders[i], value: rawHeaders[i + 1] });
  }
  return out;
}

/** Parse an absolute URL into the upstream connection target. */
function resolveTarget(url: string): ResolvedTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const scheme = parsed.protocol === 'https:' ? 'https' : 'http';
  const port = parsed.port !== '' ? Number(parsed.port) : scheme === 'https' ? 443 : 80;
  return { scheme, host: parsed.hostname, port, path: `${parsed.pathname}${parsed.search}`, url: parsed.toString() };
}

/**
 * Header pairs → the outgoing-request shape. Duplicate names collapse
 * to array values (Node re-expands them on the wire). Drops the
 * hop-by-hop proxy control header; when a rule rewrite changed the
 * target authority, `Host` is re-pointed at it.
 */
function outboundHeaders(pairs: readonly ProxyHeader[], authority: string | null): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const { name, value } of pairs) {
    const lower = name.toLowerCase();
    if (lower === 'proxy-connection') continue;
    if (lower === 'host' && authority !== null) {
      out[name] = authority;
      continue;
    }
    const existing = out[name] ?? out[lower];
    const key = out[name] !== undefined ? name : out[lower] !== undefined ? lower : name;
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [String(existing), value];
    }
  }
  return out;
}

/** Header pairs → the downstream `writeHead` shape (same collapsing). */
function downstreamHeaders(pairs: readonly ProxyHeader[]): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = {};
  for (const { name, value } of pairs) {
    const existing = out[name];
    if (existing === undefined) {
      out[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[name] = [String(existing), value];
    }
  }
  return out;
}

class ProxyMitmServerImpl implements ProxyMitmServer {
  private readonly caProvider: ProxyCaProvider;
  private readonly scope: ProxyScope;
  private readonly observer: ProxyCaptureObserver;
  private readonly enforcer: ProxyRuleEnforcer | null;
  private readonly now: () => number;
  private readonly upstreamTls: ProxyMitmServerOptions['upstreamTls'];

  private readonly outer: http.Server;
  /** Parses decrypted requests fed from terminated CONNECT tunnels. */
  private readonly inner: http.Server;
  private readonly sockets = new Set<Duplex>();
  /** Decrypted-tunnel target for a socket the inner server is parsing. */
  private readonly tunnelTargetBySocket = new WeakMap<Duplex, TunnelTarget>();
  /** Lazily built once a CA is resolved; reset on close. */
  private leafCache: LeafContextCache | null = null;
  private seq = 0;
  private boundPort: number | null = null;

  constructor(options: ProxyMitmServerOptions) {
    this.caProvider = options.caProvider;
    this.scope = options.scope;
    this.observer = options.observer;
    this.enforcer = options.enforcer ?? null;
    this.now = options.now ?? Date.now;
    this.upstreamTls = options.upstreamTls;

    this.outer = http.createServer((req, res) => this.handlePlainRequest(req, res));
    this.outer.on('connect', (req, socket, head) => this.handleConnect(req, socket, head));
    this.outer.on('connection', (socket) => this.trackSocket(socket));

    this.inner = http.createServer((req, res) => this.handleDecryptedRequest(req, res));
  }

  get port(): number | null {
    return this.boundPort;
  }

  listen(port = 0, host = '127.0.0.1'): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error): void => reject(err);
      this.outer.once('error', onError);
      this.outer.listen(port, host, () => {
        this.outer.removeListener('error', onError);
        const addr = this.outer.address();
        this.boundPort = typeof addr === 'object' && addr !== null ? addr.port : null;
        resolve(this.boundPort ?? 0);
      });
    });
  }

  close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    this.sockets.clear();
    this.leafCache = null;
    this.boundPort = null;
    return new Promise((resolve) => {
      this.inner.close(() => {
        this.outer.close(() => resolve());
      });
    });
  }

  private trackSocket(socket: Duplex): void {
    this.sockets.add(socket);
    socket.once('close', () => this.sockets.delete(socket));
  }

  private nextId(): string {
    this.seq += 1;
    return `proxy-${this.seq}`;
  }

  // ── Plain HTTP (absolute-form request URL) ─────────────────────────
  private handlePlainRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const target = resolveTarget(req.url ?? '');
    if (target === null) {
      res.writeHead(400).end();
      return;
    }
    void this.reoriginate(req, res, target);
  }

  // ── Decrypted HTTP (origin-form, from a terminated tunnel) ──────────
  private handleDecryptedRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const tunnel = this.tunnelTargetBySocket.get(req.socket);
    if (tunnel === undefined) {
      res.writeHead(500).end();
      return;
    }
    const path = req.url ?? '/';
    void this.reoriginate(req, res, {
      scheme: 'https',
      host: tunnel.host,
      port: tunnel.port,
      path,
      url: `https://${tunnel.host}${tunnel.port === 443 ? '' : `:${tunnel.port}`}${path}`,
    });
  }

  private async reoriginate(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    requested: ResolvedTarget,
  ): Promise<void> {
    const id = this.nextId();
    const startedAtMs = this.now();
    const inboundHeaders = rawHeaderPairs(req.rawHeaders);
    const method = req.method ?? 'GET';

    const plan: ProxyRequestPlan | null =
      this.enforcer !== null
        ? this.enforcer.planRequest({ url: requested.url, method, headers: inboundHeaders })
        : null;
    const wireHeaders = plan?.requestHeaders ?? inboundHeaders;

    this.observer.onRequestStart({
      id,
      scheme: requested.scheme,
      method,
      url: requested.url,
      host: requested.host,
      headers: wireHeaders,
      startedAtMs,
    });

    if (plan !== null && plan.blockedBy !== undefined) {
      this.observer.onError(id, {
        atMs: this.now(),
        code: 'oh:rule-blocked',
        reason: `blocked by rule ${plan.blockedBy}`,
      });
      res.writeHead(502, 'Blocked').end('Blocked by an Open Headers rule.');
      req.resume();
      return;
    }

    // A rule rewrite retargets the exchange; a rewritten URL that fails
    // to parse (or leaves http/https) is refused rather than half-sent.
    let target = requested;
    let rewritten = false;
    if (plan !== null && plan.url !== requested.url) {
      const next = resolveTarget(plan.url);
      if (next === null) {
        this.observer.onError(id, {
          atMs: this.now(),
          code: 'oh:rule-rewrite-invalid',
          reason: `rule rewrite produced an unusable URL: ${plan.url}`,
        });
        res.writeHead(502).end();
        req.resume();
        return;
      }
      for (const rewrite of plan.rewrites) {
        this.observer.onInternalRedirect(id, { ...rewrite, atMs: this.now() });
      }
      target = next;
      rewritten = true;
    }

    if (plan !== null && plan.delayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, plan.delayMs));
    }

    const atStartMs = this.now();
    const timing: {
      reusedSocket: boolean;
      dnsResolvedAtMs?: number;
      connectedAtMs?: number;
      tlsEstablishedAtMs?: number;
      requestSentAtMs?: number;
      responseAtMs?: number;
    } = { reusedSocket: false };

    const authority = rewritten
      ? `${target.host}${target.port === (target.scheme === 'https' ? 443 : 80) ? '' : `:${target.port}`}`
      : null;
    const requestOptions: https.RequestOptions = {
      host: target.host,
      port: target.port,
      method,
      path: target.path,
      headers: outboundHeaders(wireHeaders, authority),
    };
    if (target.scheme === 'https' && this.upstreamTls !== undefined) {
      if (this.upstreamTls.ca !== undefined) requestOptions.ca = this.upstreamTls.ca as string | string[];
      if (this.upstreamTls.rejectUnauthorized !== undefined) {
        requestOptions.rejectUnauthorized = this.upstreamTls.rejectUnauthorized;
      }
    }

    const transport = target.scheme === 'https' ? https : http;
    const upstream = transport.request(requestOptions, (upRes) => {
      timing.responseAtMs = this.now();
      const upstreamHeadPairs = rawHeaderPairs(upRes.rawHeaders);
      const served =
        plan !== null && this.enforcer !== null
          ? this.enforcer.applyResponseHeaders(plan, upstreamHeadPairs).headers
          : upstreamHeadPairs;
      this.observer.onResponseHeaders(id, {
        statusCode: upRes.statusCode ?? 0,
        statusText: upRes.statusMessage ?? '',
        headers: served,
        atMs: this.now(),
      });
      res.writeHead(upRes.statusCode ?? 502, upRes.statusMessage, downstreamHeaders(served));
      let bytes = 0;
      upRes.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
      });
      upRes.on('end', () => {
        this.observer.onComplete(id, {
          completedAtMs: this.now(),
          responseBytes: bytes,
          requestBytes,
          timing: { atStartMs, ...timing },
        });
      });
      upRes.pipe(res);
    });

    upstream.on('socket', (socket) => {
      if (!socket.connecting) {
        timing.reusedSocket = true;
        return;
      }
      socket.once('lookup', () => {
        timing.dnsResolvedAtMs = this.now();
      });
      socket.once('connect', () => {
        timing.connectedAtMs = this.now();
      });
      socket.once('secureConnect', () => {
        timing.tlsEstablishedAtMs = this.now();
      });
    });
    upstream.on('finish', () => {
      timing.requestSentAtMs = this.now();
    });

    upstream.on('error', (err: NodeJS.ErrnoException) => {
      this.observer.onError(id, {
        atMs: this.now(),
        code: err.code ?? 'ERR_PROXY_UPSTREAM',
        reason: err.message,
      });
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });

    let requestBytes = 0;
    req.on('data', (chunk: Buffer) => {
      requestBytes += chunk.length;
    });
    req.pipe(upstream);
  }

  // ── CONNECT ────────────────────────────────────────────────────────
  private handleConnect(req: http.IncomingMessage, clientSocket: Duplex, head: Buffer): void {
    const target = parseConnectAuthority(req.url ?? '');
    this.trackSocket(clientSocket);
    if (this.scope.isDecrypted(target.host)) {
      void this.terminate(target, clientSocket, head);
    } else {
      this.blindTunnel(target, clientSocket, head);
    }
  }

  private async terminate(target: TunnelTarget, clientSocket: Duplex, head: Buffer): Promise<void> {
    let context: tls.SecureContext;
    try {
      context = await this.secureContextFor(target.host);
    } catch {
      // No CA on record, or leaf minting failed — never present an
      // untrusted leaf; fall back to an opaque tunnel.
      this.blindTunnel(target, clientSocket, head);
      return;
    }
    if (clientSocket.destroyed) return;
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head.length > 0) clientSocket.unshift(head);

    const tlsSocket = new tls.TLSSocket(clientSocket, { isServer: true, secureContext: context });
    tlsSocket.on('error', () => tlsSocket.destroy());
    this.tunnelTargetBySocket.set(tlsSocket, target);
    this.trackSocket(tlsSocket);
    this.inner.emit('connection', tlsSocket);
  }

  private async secureContextFor(host: string): Promise<tls.SecureContext> {
    if (this.leafCache === null) {
      const ca = await this.caProvider.getCa();
      if (ca === null) throw new Error('no proxy CA on record');
      this.leafCache = new LeafContextCache(ca, { now: this.now });
    }
    return this.leafCache.contextForHost(host);
  }

  private blindTunnel(target: TunnelTarget, clientSocket: Duplex, head: Buffer): void {
    const upstream = net.connect(target.port, target.host, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
    const teardown = (): void => {
      upstream.destroy();
      clientSocket.destroy();
    };
    upstream.on('error', teardown);
    clientSocket.on('error', teardown);
  }
}

export function createProxyMitmServer(options: ProxyMitmServerOptions): ProxyMitmServer {
  return new ProxyMitmServerImpl(options);
}
