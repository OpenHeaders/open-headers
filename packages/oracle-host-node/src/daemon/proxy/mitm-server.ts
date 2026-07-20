/**
 * L7 MITM capture core (`PROXY_PLAN.md` Phase 2). A forward HTTP(S)
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
 * Read-only in this phase: the server observes and relays; it does not
 * yet run the rule engine (Phase 3). Every capture is surfaced through a
 * {@link ProxyCaptureObserver}; the lifecycle mapper owns turning those
 * into `RequestLifecycleUpdate`s.
 */

import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import type { Duplex } from 'node:stream';
import * as tls from 'node:tls';
import { LeafContextCache } from './leaf-context';
import type { ProxyCaProvider, ProxyCaptureObserver, ProxyHeader, ProxyScope } from './mitm-types';

export interface ProxyMitmServerOptions {
  readonly caProvider: ProxyCaProvider;
  readonly scope: ProxyScope;
  readonly observer: ProxyCaptureObserver;
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

/** Headers to forward upstream — drop the hop-by-hop proxy control header. */
function outboundHeaders(headers: http.IncomingHttpHeaders): http.OutgoingHttpHeaders {
  const out: http.OutgoingHttpHeaders = { ...headers };
  delete out['proxy-connection'];
  return out;
}

class ProxyMitmServerImpl implements ProxyMitmServer {
  private readonly caProvider: ProxyCaProvider;
  private readonly scope: ProxyScope;
  private readonly observer: ProxyCaptureObserver;
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
    let target: URL;
    try {
      target = new URL(req.url ?? '');
    } catch {
      res.writeHead(400).end();
      return;
    }
    const scheme = target.protocol === 'https:' ? 'https' : 'http';
    const port = target.port !== '' ? Number(target.port) : scheme === 'https' ? 443 : 80;
    this.reoriginate(req, res, {
      scheme,
      host: target.hostname,
      port,
      path: `${target.pathname}${target.search}`,
      url: target.toString(),
    });
  }

  // ── Decrypted HTTP (origin-form, from a terminated tunnel) ──────────
  private handleDecryptedRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const tunnel = this.tunnelTargetBySocket.get(req.socket);
    if (tunnel === undefined) {
      res.writeHead(500).end();
      return;
    }
    const path = req.url ?? '/';
    this.reoriginate(req, res, {
      scheme: 'https',
      host: tunnel.host,
      port: tunnel.port,
      path,
      url: `https://${tunnel.host}${tunnel.port === 443 ? '' : `:${tunnel.port}`}${path}`,
    });
  }

  private reoriginate(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    target: { scheme: 'http' | 'https'; host: string; port: number; path: string; url: string },
  ): void {
    const id = this.nextId();
    const startedAtMs = this.now();
    this.observer.onRequestStart({
      id,
      scheme: target.scheme,
      method: req.method ?? 'GET',
      url: target.url,
      host: target.host,
      headers: rawHeaderPairs(req.rawHeaders),
      startedAtMs,
    });

    const requestOptions: https.RequestOptions = {
      host: target.host,
      port: target.port,
      method: req.method,
      path: target.path,
      headers: outboundHeaders(req.headers),
    };
    if (target.scheme === 'https' && this.upstreamTls !== undefined) {
      if (this.upstreamTls.ca !== undefined) requestOptions.ca = this.upstreamTls.ca as string | string[];
      if (this.upstreamTls.rejectUnauthorized !== undefined) {
        requestOptions.rejectUnauthorized = this.upstreamTls.rejectUnauthorized;
      }
    }

    const transport = target.scheme === 'https' ? https : http;
    const upstream = transport.request(requestOptions, (upRes) => {
      this.observer.onResponseHeaders(id, {
        statusCode: upRes.statusCode ?? 0,
        statusText: upRes.statusMessage ?? '',
        headers: rawHeaderPairs(upRes.rawHeaders),
        atMs: this.now(),
      });
      res.writeHead(upRes.statusCode ?? 502, upRes.statusMessage, upRes.headers);
      let bytes = 0;
      upRes.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
      });
      upRes.on('end', () => {
        this.observer.onComplete(id, { completedAtMs: this.now(), responseBytes: bytes });
      });
      upRes.pipe(res);
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
