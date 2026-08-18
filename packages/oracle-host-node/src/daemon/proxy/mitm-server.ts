/**
 * L7 MITM capture core (the proxy plan Phases 2+3). A forward HTTP(S)
 * proxy bound to a daemon-local port:
 *
 *  - plain `http://` requests (absolute-form) are re-originated upstream
 *    and captured;
 *  - `CONNECT host:port` for a SCOPED host is TLS-terminated with a
 *    locally-minted, CA-signed leaf, the decrypted requests parsed by an
 *    inner HTTP server, re-originated over TLS, and captured;
 *  - `CONNECT` for an UN-scoped host (or when no CA is on record) is an
 *    opaque blind tunnel — bytes piped verbatim, nothing decrypted or
 *    captured (the proxy-security design §2.4 scoped-decrypt-by-default).
 *
 * Phase 3: when an enforcer is injected, every captured request runs the
 * rule engine before re-origination — block answers a synthesized 502
 * (`oh:rule-blocked` on the lifecycle), redirect/query-param rewrite the
 * target in place (recorded as internal hops), delay holds the exchange,
 * header mods rewrite the wire sets both directions. Blind tunnels stay
 * untouched — un-scoped traffic is never captured NOR enforced.
 *
 * Body plane (§6 capture contract): both directions tee into bounded
 * buffers on the existing stream listeners — forwarding never awaits
 * capture; over-cap captures truncate, throughput is untouched. The
 * static body-touching rule types ride the tee: `request-body`
 * substitutes the outgoing body, a `mock` response answers without
 * re-originating, a `network` response substitutes the arrived reply
 * while the real body drains into the two-sided override capture.
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
import type { InspectorOverrideBody } from '@openheaders/core/request-lifecycle';
import {
  BoundedBodyBuffer,
  type CapturedBody,
  decodeContentEncoding,
  PROXY_BODY_CAPTURE_CAP_BYTES,
  PROXY_BODY_GATE_CAP_BYTES,
  shapeBodyContent,
} from './body-store';
import { LeafContextCache } from './leaf-context';
import type { ProxyCaProvider, ProxyCaptureObserver, ProxyExchangeEnd, ProxyHeader, ProxyScope } from './mitm-types';
import type { ProxyBodyPlan, ProxyRequestPlan, ProxyRuleEnforcer, ProxyServedResponse } from './rule-enforcement';

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

/** Request framing headers recomputed when a rule substitutes the body. */
const REQUEST_FRAMING_HEADERS: ReadonlySet<string> = new Set([
  'content-length',
  'transfer-encoding',
  'content-encoding',
]);

/** The wire header set for a substituted request body — framing recomputed. */
function substitutedBodyHeaders(pairs: readonly ProxyHeader[], byteLength: number): ProxyHeader[] {
  const out = pairs.filter((h) => !REQUEST_FRAMING_HEADERS.has(h.name.toLowerCase()));
  out.push({ name: 'Content-Length', value: String(byteLength) });
  return out;
}

const toPlainHeaders = (pairs: readonly ProxyHeader[]): Array<{ name: string; value: string }> =>
  pairs.map((h) => ({ name: h.name, value: h.value }));

/** Case-insensitive first-match header lookup. */
function headerValue(pairs: readonly ProxyHeader[], target: string): string | undefined {
  const lower = target.toLowerCase();
  for (const h of pairs) {
    if (h.name.toLowerCase() === lower) return h.value;
  }
  return undefined;
}

/** A fully-known wire buffer as a capture (tee-capped like any other body). */
function wireBodyOf(bytes: Buffer): CapturedBody {
  const tee = new BoundedBodyBuffer(PROXY_BODY_CAPTURE_CAP_BYTES);
  tee.push(bytes);
  return tee.snapshot();
}

/** The read-ahead prefix of an inbound body — collected until the gate
 *  bound or EOF, with the stream paused when more remains. */
interface InboundReadAhead {
  readonly prefix: Buffer;
  readonly ended: boolean;
}

function readAhead(req: http.IncomingMessage, capBytes: number): Promise<InboundReadAhead> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const finish = (ended: boolean): void => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      resolve({ prefix: Buffer.concat(chunks), ended });
    };
    const onData = (chunk: Buffer): void => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= capBytes) {
        req.pause();
        finish(false);
      }
    };
    const onEnd = (): void => finish(true);
    req.on('data', onData);
    req.on('end', onEnd);
  });
}

/** Drain the rest of an inbound body into the capture tee (nothing forwards). */
function drainRemaining(req: http.IncomingMessage, ended: boolean, tee: BoundedBodyBuffer): Promise<void> {
  if (ended) return Promise.resolve();
  return new Promise((resolve) => {
    req.on('data', (chunk: Buffer) => tee.push(chunk));
    req.once('end', () => resolve());
    req.once('error', () => resolve());
    req.resume();
  });
}

/** Shape a captured original body for an override snapshot — omitted when
 *  truncated or undecodable (an honest absence, never partial bytes posing
 *  as the whole). */
function snapshotBody(capture: CapturedBody, contentEncoding?: string): InspectorOverrideBody | undefined {
  if (capture.truncated || capture.totalBytes === 0) return undefined;
  let bytes = capture.bytes;
  if (contentEncoding !== undefined && contentEncoding !== 'identity') {
    const decoded = decodeContentEncoding(bytes, contentEncoding);
    if (decoded === null) return undefined;
    bytes = decoded;
  }
  return shapeBodyContent(bytes);
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
    let wireHeaders = plan?.requestHeaders ?? inboundHeaders;

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

    // ── Body-rule resolution (§6 tee + body-touching rule types) ─────
    // The inbound body is read ahead only when a body candidate exists;
    // the gate text is bounded exactly as the CDP plane's inline bound.
    const requestTee = new BoundedBodyBuffer(PROXY_BODY_CAPTURE_CAP_BYTES);
    let inboundPrefix: Buffer = Buffer.alloc(0);
    let inboundEnded = false;
    let bodyPlan: ProxyBodyPlan | null = null;
    if (plan !== null && this.enforcer !== null && plan.bodyRules.length > 0) {
      const ahead = await readAhead(req, PROXY_BODY_GATE_CAP_BYTES);
      inboundPrefix = ahead.prefix;
      inboundEnded = ahead.ended;
      requestTee.push(inboundPrefix);
      const gateText =
        this.enforcer.needsRequestBodyText(plan) && ahead.ended ? ahead.prefix.toString('utf8') : undefined;
      bodyPlan = this.enforcer.planBody(plan, gateText);
    }

    if (bodyPlan !== null && bodyPlan.kind === 'mock') {
      await drainRemaining(req, inboundEnded, requestTee);
      this.serveMock(id, plan, bodyPlan, res, requestTee.snapshot());
      return;
    }

    let sentBodyBytes: Buffer | null = null;
    if (bodyPlan !== null && bodyPlan.kind === 'request-body') {
      await drainRemaining(req, inboundEnded, requestTee);
      sentBodyBytes = Buffer.from(bodyPlan.body, 'utf8');
      wireHeaders = substitutedBodyHeaders(wireHeaders, sentBodyBytes.length);
      const original = requestTee.snapshot();
      const originalBody = snapshotBody(original);
      this.observer.onRequestOverride(id, {
        ruleUid: bodyPlan.ruleUid,
        sent: { headers: toPlainHeaders(wireHeaders), body: shapeBodyContent(sentBodyBytes) },
        ...(originalBody !== undefined ? { original: { body: originalBody } } : {}),
      });
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
      const arrived = {
        statusCode: upRes.statusCode ?? 0,
        statusText: upRes.statusMessage ?? '',
        headers: upstreamHeadPairs,
      };

      const substitution =
        bodyPlan !== null && bodyPlan.kind === 'network-response' && this.enforcer !== null
          ? this.enforcer.resolveNetworkResponse(bodyPlan, arrived)
          : null;
      if (substitution !== null) {
        this.serveSubstitutedResponse(id, plan, substitution, upRes, arrived, res, () => ({
          requestBytes,
          timing: { atStartMs, ...timing },
        }));
        return;
      }

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
      const responseTee = new BoundedBodyBuffer(PROXY_BODY_CAPTURE_CAP_BYTES);
      let bytes = 0;
      upRes.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        responseTee.push(chunk);
      });
      upRes.on('end', () => {
        const contentEncoding = headerValue(upstreamHeadPairs, 'content-encoding');
        this.observer.onComplete(id, {
          completedAtMs: this.now(),
          responseBytes: bytes,
          requestBytes,
          timing: { atStartMs, ...timing },
          requestBody: sentBodyBytes !== null ? wireBodyOf(sentBodyBytes) : requestTee.snapshot(),
          responseBody: responseTee.snapshot(),
          ...(contentEncoding !== undefined ? { responseContentEncoding: contentEncoding.toLowerCase() } : {}),
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
    if (sentBodyBytes !== null) {
      // Substituted body — the original inbound stream is already drained.
      requestBytes = sentBodyBytes.length;
      upstream.end(sentBodyBytes);
    } else if (inboundEnded) {
      // Read-ahead consumed the whole body; `end` has already fired, so a
      // pipe would never close the upstream side.
      requestBytes = inboundPrefix.length;
      if (inboundPrefix.length > 0) upstream.write(inboundPrefix);
      upstream.end();
    } else {
      if (inboundPrefix.length > 0) {
        requestBytes += inboundPrefix.length;
        upstream.write(inboundPrefix);
      }
      req.on('data', (chunk: Buffer) => {
        requestBytes += chunk.length;
        requestTee.push(chunk);
      });
      req.pipe(upstream);
    }
  }

  /** Answer a `mock` response rule — the exchange never re-originates. */
  private serveMock(
    id: string,
    plan: ProxyRequestPlan | null,
    mock: Extract<ProxyBodyPlan, { kind: 'mock' }>,
    res: http.ServerResponse,
    requestBody: CapturedBody,
  ): void {
    const served =
      this.enforcer !== null && plan !== null
        ? this.enforcer.applyResponseHeaders(plan, mock.headers).headers
        : mock.headers;
    const bodyBytes = Buffer.from(mock.body, 'utf8');
    this.observer.onResponseHeaders(id, {
      statusCode: mock.statusCode,
      statusText: '',
      headers: served,
      atMs: this.now(),
    });
    this.observer.onResponseOverride(id, {
      ruleUid: mock.ruleUid,
      served: {
        statusCode: mock.statusCode,
        headers: toPlainHeaders(served),
        body: shapeBodyContent(bodyBytes),
      },
    });
    res.writeHead(mock.statusCode, downstreamHeaders(served));
    res.end(bodyBytes);
    this.observer.onComplete(id, {
      completedAtMs: this.now(),
      responseBytes: bodyBytes.length,
      requestBytes: requestBody.totalBytes,
      requestBody,
      responseBody: wireBodyOf(bodyBytes),
    });
  }

  /**
   * Serve a `network`-source response substitution: the literal goes
   * downstream immediately; the real reply keeps draining into the
   * bounded original tee so the two-sided override lands at upstream end.
   */
  private serveSubstitutedResponse(
    id: string,
    plan: ProxyRequestPlan | null,
    served: ProxyServedResponse,
    upRes: http.IncomingMessage,
    arrived: { statusCode: number; statusText: string; headers: readonly ProxyHeader[] },
    res: http.ServerResponse,
    endFacts: () => { requestBytes: number; timing: ProxyExchangeEnd['timing'] },
  ): void {
    const finalHeaders =
      this.enforcer !== null && plan !== null
        ? this.enforcer.applyResponseHeaders(plan, served.headers).headers
        : served.headers;
    const bodyBytes = Buffer.from(served.body, 'utf8');
    this.observer.onResponseHeaders(id, {
      statusCode: served.statusCode,
      statusText: served.statusText,
      headers: finalHeaders,
      atMs: this.now(),
    });
    res.writeHead(served.statusCode, served.statusText, downstreamHeaders(finalHeaders));
    res.end(bodyBytes);

    const originalTee = new BoundedBodyBuffer(PROXY_BODY_CAPTURE_CAP_BYTES);
    upRes.on('data', (chunk: Buffer) => originalTee.push(chunk));
    upRes.on('end', () => {
      const originalBody = snapshotBody(originalTee.snapshot(), headerValue(arrived.headers, 'content-encoding'));
      this.observer.onResponseOverride(id, {
        ruleUid: served.ruleUid,
        served: {
          statusCode: served.statusCode,
          statusText: served.statusText,
          headers: toPlainHeaders(finalHeaders),
          body: shapeBodyContent(bodyBytes),
        },
        original: {
          statusCode: arrived.statusCode,
          statusText: arrived.statusText,
          headers: toPlainHeaders(arrived.headers),
          ...(originalBody !== undefined ? { body: originalBody } : {}),
        },
      });
      const facts = endFacts();
      this.observer.onComplete(id, {
        completedAtMs: this.now(),
        responseBytes: bodyBytes.length,
        requestBytes: facts.requestBytes,
        timing: facts.timing,
        responseBody: wireBodyOf(bodyBytes),
      });
    });
    upRes.resume();
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
