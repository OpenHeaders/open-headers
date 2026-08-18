/**
 * Node gRPC transport — the node hosts' implementation of the engine's
 * {@link GrpcTransport} seam, hand-rolled over `node:http2` (no
 * `@grpc/grpc-js`, per the S1 fork ratification). One HTTP/2 session
 * per call — unary `invoke` and the streaming `openStream` twin alike:
 * a call is user-initiated and cheap, so pooling is a demand-gated
 * residual, and a fresh session keeps the failure story per-call.
 * `openStream` hands raw framed body chunks to the executor's
 * callbacks (frame unwrapping is the executor's core-proto pass) and
 * returns the upstream writer; the deadline and abort discipline is
 * `invoke`'s verbatim, settling through `onEnd` exactly once.
 *
 * Wire ceremony owned here:
 *   - `POST /{service}/{rpc}` with `content-type: application/grpc+proto`
 *     and `te: trailers`; the encoded message rides ONE gRPC frame
 *     (compression flag 0 — v1 negotiates no compression, and the flag
 *     is never claimed falsely: F5.2 flag honesty).
 *   - TLS per the request's flag: `https://` connect (verified against
 *     the system roots unless the request's `sslVerification: false`
 *     opts out — the self-signed dev-server knob) or cleartext h2c.
 *     Prior-knowledge h2c — gRPC servers speak HTTP/2 directly, no
 *     upgrade dance.
 *   - Socket-path dial: `unixSocketPath` pins the session's own
 *     `createConnection` to the local socket / named pipe (the
 *     prior-knowledge hop's hoisted-dial idiom) — the authority stays
 *     cosmetic for dialing while `:authority`, SNI, and certificate
 *     verification keep it.
 *   - Ambient proxy coverage (the request-engine proxy design,
 *     P6): a call consults the host's system plane per target —
 *     gRPC editors carry no request-plane proxy knobs (the H5
 *     ruling), so the plane's answer is the whole story. An HTTP(S)
 *     answer pre-dials the shared hand-rolled CONNECT tunnel
 *     (`connect-tunnel.ts` — the prior-knowledge hop's exact idiom),
 *     then the session's own `createConnection` runs the target leg
 *     over the tunnel socket: TLS wrapped with `:authority`-derived
 *     SNI and an h2 ALPN offer, or the raw tunnel for h2c. The
 *     session speaks HTTP CONNECT only, so ambient SOCKS5 entries
 *     skip like a failed dial (the pinned-h2 posture — a chain with
 *     nothing else fails honestly pre-wire); the chain walks like
 *     HTTP sends on dial-level failures REACHING a proxy; a
 *     socket-pinned call makes the ambient proxy stand down
 *     (recorded). The winning route reports on the unary response /
 *     through `onHead` as wire truth. ONE deadline spans resolution,
 *     tunnel dials, and every attempt.
 *   - Deadline: `grpc-timeout` header (so the SERVER can enforce it)
 *     plus a local abort spanning connect, response head, and body
 *     read — the HTTP transport's one-deadline discipline.
 *   - Body read capped at `maxBodyBytes`, streaming with an abort past
 *     the cap (the always-on host's memory bound). Once the response
 *     head is in, arrived bytes are never discarded: an abort or
 *     connection failure mid-body resolves with the partial body and
 *     the truth lands on the capture (missing trailers read as the
 *     null grpc-status they are).
 *   - Trailers off the stream's own `trailers` event, verbatim.
 *     Trailers-only replies need nothing special here — their status
 *     rides the initial HEADERS and the executor's extraction knows.
 *
 * Error classification mirrors the HTTP transport's: pre-head failures
 * throw a {@link GrpcTransportError} with a user-actionable message
 * (undici isn't in this path, so the `err.code` is Node's own);
 * proxied dials classify against the PROXY leg (407 names the
 * credentials, a refused dial names the proxy).
 */

import { type ClientHttp2Session, type ClientHttp2Stream, connect, constants } from 'node:http2';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { encodeGrpcTimeout, writeGrpcFrame } from '@openheaders/core/proto';
import {
  type GrpcProxyRoute,
  type GrpcStreamCallbacks,
  type GrpcStreamWriter,
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportHeader,
  type GrpcTransportRequest,
  type GrpcTransportResponse,
  type GrpcTransportStreamRequest,
} from '@openheaders/oracle/live/grpc-exec/transport';
import { servernameFor } from './instrumented-connector';
import { dialConnectTunnel, proxyConnectRejectedStatus } from './request-transport/connect-tunnel';
import { systemProxyResolver } from './system-proxy/registry';
import {
  isSessionProxyDialFailure,
  resolveSessionProxyAttempts,
  type SessionProxyAttempt,
  type SessionRouteResult,
} from './system-proxy/session-route';
import type { SystemProxyResolver } from './system-proxy/types';

export interface NodeGrpcTransportOptions {
  /** The system-plane resolver — injectable so unit rigs drive
   *  ambient-proxy calls with fake resolvers. `null` turns the plane
   *  off for this transport; omitted = the host's registered resolver
   *  (see `system-proxy/registry`). */
  systemProxy?: SystemProxyResolver | null;
}

/**
 * TLS connect options for one session: verify against the system roots
 * unless the request explicitly opted out (`sslVerification: false` —
 * the self-signed dev-server knob). Cleartext connects ignore it.
 */
function sessionOptions(request: {
  tls: boolean;
  sslVerification?: boolean;
}): { rejectUnauthorized: false } | undefined {
  return request.tls && request.sslVerification === false ? { rejectUnauthorized: false } : undefined;
}

/**
 * Session options for one call's dial shape. A TCP call hands the dial
 * to `http2.connect` with the TLS policy above; a socket-pinned call
 * owns its `createConnection` instead (the prior-knowledge hop's
 * hoisted-dial idiom): `path` wins over host+port inside
 * `net.connect` / `tls.connect`, so the authority stays COSMETIC for
 * dialing while `:authority`, SNI, and certificate verification keep
 * it — a TLS channel over the socket verifies against the target's
 * hostname. TLS-only options ride only a TLS dial. Exported pure so
 * the mapping is testable without inspecting a live session (the HTTP
 * transport's `connectOptionsFor` discipline).
 */
export function sessionOptionsFor(
  request: { tls: boolean; sslVerification?: boolean; unixSocketPath?: string },
  target: URL,
): Parameters<typeof connect>[1] {
  const socketPath = request.unixSocketPath;
  if (socketPath === undefined) return sessionOptions(request);
  const servername = servernameFor(target.hostname);
  return {
    createConnection: (): net.Socket =>
      request.tls
        ? tls.connect({
            path: socketPath,
            ...(servername !== undefined ? { servername } : {}),
            ALPNProtocols: ['h2'],
            ...(request.sslVerification === false ? { rejectUnauthorized: false } : {}),
          })
        : net.connect({ path: socketPath }),
  };
}

/**
 * Session options for one call over an ESTABLISHED CONNECT tunnel —
 * the ambient-proxy leg (the prior-knowledge hop's tunnel idiom): the
 * target leg wraps the tunnel socket in TLS with the authority's SNI
 * and an h2 ALPN offer, or rides the raw tunnel for cleartext h2c.
 * Exported pure like {@link sessionOptionsFor}.
 */
export function tunnelSessionOptionsFor(
  request: { tls: boolean; sslVerification?: boolean },
  target: URL,
  tunnel: net.Socket,
): Parameters<typeof connect>[1] {
  const servername = servernameFor(target.hostname);
  return {
    createConnection: (): net.Socket =>
      request.tls
        ? tls.connect({
            socket: tunnel,
            ...(servername !== undefined ? { servername } : {}),
            ALPNProtocols: ['h2'],
            ...(request.sslVerification === false ? { rejectUnauthorized: false } : {}),
          })
        : tunnel,
  };
}

/** Node's incoming header shape flattened to seam headers — repeated
 *  keys entry-wise, HTTP/2 pseudo-headers (`:status` etc.) excluded. */
function seamHeadersOf(record: Record<string, string | string[] | undefined>): GrpcTransportHeader[] {
  const out: GrpcTransportHeader[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith(':') || value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) out.push({ key, value: v });
    } else {
      out.push({ key, value });
    }
  }
  return out;
}

/** Outgoing headers: the ceremony fields plus the request's metadata,
 *  repeated keys folded into arrays (Node's repeat encoding). */
function buildOutgoingHeaders(
  request: Pick<GrpcTransportRequest, 'path' | 'metadata' | 'timeoutMs'>,
): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {
    ':method': 'POST',
    ':path': request.path,
    'content-type': 'application/grpc+proto',
    te: 'trailers',
    ...(request.timeoutMs !== undefined ? { 'grpc-timeout': encodeGrpcTimeout(request.timeoutMs) } : {}),
  };
  for (const { key, value } of request.metadata) {
    const existing = headers[key];
    if (existing === undefined) {
      headers[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      headers[key] = [existing, value];
    }
  }
  return headers;
}

/**
 * The failure's meaningful code, walking the `cause` chain: a dial
 * failure reaches the STREAM as a bare `ERR_HTTP2_STREAM_CANCEL` whose
 * `cause` carries the real error (probed live: connect-refused streams
 * cancel with `cause.code: 'ECONNREFUSED'` before the session's own
 * error fires). The cancel code itself is the fallback, never the
 * preferred answer.
 */
function grpcFailureCode(err: unknown): string | undefined {
  let current: unknown = err;
  let fallback: string | undefined;
  for (let depth = 0; depth < 6 && current !== null && typeof current === 'object'; depth++) {
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === 'string') {
      if (record.code !== 'ERR_HTTP2_STREAM_CANCEL') return record.code;
      fallback ??= record.code;
    }
    current = record.cause;
  }
  return fallback;
}

/** `host[:port]` of a proxy URL, for error messages. */
function proxyHostOf(proxyUrl: string): string {
  try {
    return new URL(proxyUrl).host;
  } catch {
    return proxyUrl;
  }
}

/**
 * Classify a pre-head failure into a user-actionable message. `err` is
 * Node's own (no undici layers here); the codes below are the ones a
 * dial, handshake, or protocol mismatch actually surfaces. With
 * `proxyUrl` set the dial rode the ambient CONNECT tunnel — a rejected
 * CONNECT is the proxy's own answer, and a dial-level failure can only
 * be the proxy itself (target dialing happens at the proxy);
 * target-leg failures past the tunnel fall through to the shared
 * classification, because by then the proxy is a transparent pipe.
 */
function classifyGrpcFailure(
  authority: string,
  tlsChannel: boolean,
  err: unknown,
  socketPath?: string,
  proxyUrl?: string,
): string {
  const code = grpcFailureCode(err);
  // A socket-pinned call never dials TCP, so every dial-level failure
  // is about the socket itself — name the setting and the path (the
  // HTTP classifier's socket prose). Codes outside this set (TLS
  // handshake, protocol mismatch) fall through to the shared
  // classification below.
  if (socketPath !== undefined) {
    switch (code) {
      case 'ENOENT': {
        // An overlong path fails as ENOENT too — the OS truncates or
        // rejects anything past its sun_path limit.
        const lengthHint =
          socketPath.length > 100
            ? ' Paths longer than the OS limit on socket paths (~104 characters) also fail this way.'
            : '';
        return `No socket at ${socketPath} — the request's Unix-socket setting dials it. Is the service running and the path right?${lengthHint}`;
      }
      case 'ENOTSOCK':
        return `The path ${socketPath} exists but is not a socket — the request's Unix-socket setting dials it.`;
      case 'EACCES':
        return `Permission denied opening the socket at ${socketPath} — the request's Unix-socket setting dials it.`;
      case 'ECONNREFUSED':
        return `Connection refused on the socket at ${socketPath} — the request's Unix-socket setting dials it. Is the service still listening on that socket?`;
      case 'ETIMEDOUT':
        return `Connection on the socket at ${socketPath} timed out — the request's Unix-socket setting dials it.`;
    }
  }
  if (proxyUrl !== undefined) {
    const proxyHost = proxyHostOf(proxyUrl);
    const rejected = proxyConnectRejectedStatus(err);
    if (rejected === 407) {
      return `The proxy at ${proxyHost} requires authentication (407) — this machine's proxy configuration routes this call through it. Check the system plane's proxy credentials in the app settings.`;
    }
    if (rejected !== undefined) {
      return `The proxy at ${proxyHost} could not open a tunnel to ${authority} (HTTP ${rejected}). The proxy is reachable — the failure is between the proxy and the target.`;
    }
    switch (code) {
      case 'ENOTFOUND':
      case 'EAI_AGAIN':
        return `Could not resolve the proxy host ${proxyHost} (DNS lookup failed) — this machine's proxy configuration routes this call through it.`;
      case 'ECONNREFUSED':
        return `Connection refused by the proxy at ${proxyHost} — this machine's proxy configuration routes this call through it. Is the proxy running?`;
      case 'EHOSTUNREACH':
      case 'ENETUNREACH':
        return `No route to the proxy at ${proxyHost} (${code}) — this machine's proxy configuration routes this call through it.`;
      case 'ETIMEDOUT':
        return `Connection to the proxy at ${proxyHost} timed out — this machine's proxy configuration routes this call through it.`;
    }
  }
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Could not resolve host ${authority} (DNS lookup failed). Check the target and your network.`;
    case 'ECONNREFUSED':
      return `Connection refused by ${authority}. Is the gRPC server running on that host/port?`;
    case 'EHOSTUNREACH':
    case 'ENETUNREACH':
      return `No route to ${authority} (${code}).`;
    case 'ETIMEDOUT':
      return `Connection to ${authority} timed out.`;
    case 'ECONNRESET':
      return tlsChannel
        ? `Connection to ${authority} was reset. If the server is plaintext (no TLS), turn the channel's TLS lock off.`
        : `Connection to ${authority} was reset. If the server expects TLS, turn the channel's TLS lock on.`;
    case 'CERT_HAS_EXPIRED':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
      return `TLS certificate error reaching ${authority} (${code}).`;
    default: {
      if (code !== undefined && (code.startsWith('ERR_SSL_') || code === 'EPROTO')) {
        return `TLS handshake with ${authority} failed (${code}). If the server is plaintext (no TLS), turn the channel's TLS lock off.`;
      }
      if (code?.startsWith('ERR_HTTP2_')) {
        return `${authority} did not speak HTTP/2 for this call (${code}). Is it a gRPC endpoint?`;
      }
      const message = err instanceof Error ? err.message : String(err);
      return `Could not reach ${authority}: ${message}`;
    }
  }
}

/** The target's dial port — the authority's own, or the scheme
 *  default (the URL keeps `port` empty for defaults). */
function targetPortOf(target: URL, tlsChannel: boolean): number {
  return target.port !== '' ? Number(target.port) : tlsChannel ? 443 : 80;
}

/** A pending upstream write queued while the ambient route was still
 *  resolving — flushed in order the moment the stream exists. */
type PendingStreamWrite = { kind: 'message'; message: Uint8Array } | { kind: 'half-close' };

export function createNodeGrpcTransport(options: NodeGrpcTransportOptions = {}): GrpcTransport {
  const resolverFor = (): SystemProxyResolver | null =>
    options.systemProxy !== undefined ? options.systemProxy : systemProxyResolver();
  const resolveCallAttempts = (target: URL, unixSocketPath: string | undefined): Promise<SessionRouteResult> =>
    resolveSessionProxyAttempts(
      {
        url: target.origin,
        ...(unixSocketPath !== undefined ? { unixSocketPath } : {}),
        capability: 'connect-only',
      },
      resolverFor(),
    );

  return {
    invoke(request: GrpcTransportRequest, signal?: AbortSignal): Promise<GrpcTransportResponse> {
      const scheme = request.tls ? 'https' : 'http';
      let target: URL;
      try {
        target = new URL(`${scheme}://${request.authority}`);
      } catch {
        return Promise.reject(new GrpcTransportError(`Invalid target: "${request.authority}".`));
      }
      if (target.pathname !== '/' || target.search !== '' || target.username !== '') {
        return Promise.reject(
          new GrpcTransportError(`The target must be host or host:port — got "${request.authority}".`),
        );
      }

      // The walk's shared abort: ONE deadline spans resolution, tunnel
      // dials, and every attempt; the caller's Stop signal merges onto
      // the same abort.
      const walk = new AbortController();
      let deadlineExpired = false;

      // One attempt's full exchange over an already-decided session
      // shape — the original single-shot body, its deadline and abort
      // now the walk's.
      const invokeAttempt = (
        sessionOpts: Parameters<typeof connect>[1],
        attempt: SessionProxyAttempt,
      ): Promise<GrpcTransportResponse> =>
        new Promise<GrpcTransportResponse>((resolve, reject) => {
          let settled = false;
          let headArrived = false;
          let httpStatus = 0;
          let headers: GrpcTransportHeader[] = [];
          let trailers: GrpcTransportHeader[] = [];
          const parts: Buffer[] = [];
          let bytesRead = 0;
          let truncated = false;
          let stream: ClientHttp2Stream | null = null;

          const session: ClientHttp2Session = connect(target.origin, sessionOpts);

          const cleanup = (): void => {
            walk.signal.removeEventListener('abort', onAbort);
            session.close();
          };
          const settleError = (err: unknown): void => {
            if (settled) return;
            settled = true;
            cleanup();
            if (deadlineExpired) {
              reject(
                new GrpcTransportError(`Call deadline of ${request.timeoutMs} ms elapsed before a response arrived.`),
              );
              return;
            }
            if (signal?.aborted) {
              reject(new GrpcTransportError('Call aborted before a response arrived.'));
              return;
            }
            reject(
              new GrpcTransportError(
                classifyGrpcFailure(request.authority, request.tls, err, request.unixSocketPath, attempt.proxy?.url),
              ),
            );
          };
          const settleResponse = (): void => {
            if (settled) return;
            settled = true;
            cleanup();
            const body = Buffer.concat(parts, Math.min(bytesRead, request.maxBodyBytes));
            const route: GrpcProxyRoute | undefined = attempt.route;
            resolve({
              httpStatus,
              headers,
              trailers,
              body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
              bodyTruncated: truncated,
              ...(route !== undefined ? { proxyRoute: route } : {}),
            });
          };
          const abortExchange = (): void => {
            // Once the head is in, arrived bytes materialize instead of
            // erroring — destroying the stream fires 'close', which
            // settles with the partial body below.
            stream?.close(constants.NGHTTP2_CANCEL);
            session.destroy();
            if (!headArrived) settleError(new Error('aborted'));
            else settleResponse();
          };
          const onAbort = (): void => abortExchange();

          if (walk.signal.aborted) {
            session.destroy();
            settleError(new Error('aborted'));
            return;
          }
          walk.signal.addEventListener('abort', onAbort);

          session.on('error', settleError);
          stream = session.request(buildOutgoingHeaders(request));
          stream.on('error', (err: unknown) => {
            if (headArrived) {
              settleResponse();
              return;
            }
            settleError(err);
          });
          stream.on('response', (incoming) => {
            headArrived = true;
            const status = incoming[':status'];
            httpStatus = typeof status === 'number' ? status : 0;
            headers = seamHeadersOf(incoming);
          });
          stream.on('trailers', (incoming) => {
            trailers = seamHeadersOf(incoming);
          });
          stream.on('data', (chunk: Buffer) => {
            if (truncated) return;
            parts.push(chunk);
            bytesRead += chunk.byteLength;
            if (bytesRead > request.maxBodyBytes) {
              truncated = true;
              stream?.close(constants.NGHTTP2_CANCEL);
            }
          });
          stream.on('close', () => {
            if (headArrived) settleResponse();
            else settleError(new Error(`stream closed (HTTP/2 code ${stream?.rstCode ?? 'unknown'})`));
          });
          stream.write(Buffer.from(writeGrpcFrame(request.message)));
          stream.end();
        });

      const runInvoke = async (): Promise<GrpcTransportResponse> => {
        const resolved = await resolveCallAttempts(target, request.unixSocketPath);
        if ('errorMessage' in resolved) throw new GrpcTransportError(resolved.errorMessage);
        const attempts = resolved.attempts;
        const timer =
          request.timeoutMs !== undefined
            ? setTimeout(() => {
                deadlineExpired = true;
                walk.abort();
              }, request.timeoutMs)
            : null;
        const onExternalAbort = (): void => walk.abort();
        if (signal !== undefined) {
          if (signal.aborted) walk.abort();
          else signal.addEventListener('abort', onExternalAbort);
        }
        try {
          for (let i = 0; i < attempts.length; i += 1) {
            const attempt = attempts[i];
            let tunnel: net.Socket | undefined;
            if (attempt.proxy !== undefined) {
              try {
                tunnel = await dialConnectTunnel(
                  { hostname: target.hostname, port: targetPortOf(target, request.tls) },
                  { proxy: attempt.proxy, signal: walk.signal },
                );
              } catch (err) {
                // Chain walking: a dial-level failure REACHING the
                // proxy falls through to the next entry (Chromium's
                // own fallback semantics); everything else surfaces.
                const nextExists = i < attempts.length - 1;
                if (
                  attempt.environmentChain === true &&
                  nextExists &&
                  !walk.signal.aborted &&
                  isSessionProxyDialFailure(err)
                ) {
                  continue;
                }
                if (deadlineExpired) {
                  throw new GrpcTransportError(
                    `Call deadline of ${request.timeoutMs} ms elapsed before a response arrived.`,
                  );
                }
                if (signal?.aborted) {
                  throw new GrpcTransportError('Call aborted before a response arrived.');
                }
                throw new GrpcTransportError(
                  classifyGrpcFailure(request.authority, request.tls, err, request.unixSocketPath, attempt.proxy.url),
                );
              }
            }
            const sessionOpts =
              tunnel !== undefined
                ? tunnelSessionOptionsFor(request, target, tunnel)
                : sessionOptionsFor(request, target);
            return await invokeAttempt(sessionOpts, attempt);
          }
          // Unreachable while the attempt list is non-empty (the last
          // attempt never falls through) — defensive for the type
          // system.
          throw new GrpcTransportError('The proxy fallback chain produced no attempt to dial.');
        } finally {
          if (timer !== null) clearTimeout(timer);
          signal?.removeEventListener('abort', onExternalAbort);
        }
      };
      return runInvoke();
    },

    openStream(
      request: GrpcTransportStreamRequest,
      callbacks: GrpcStreamCallbacks,
      signal?: AbortSignal,
    ): GrpcStreamWriter {
      const scheme = request.tls ? 'https' : 'http';
      let target: URL | null = null;
      try {
        const parsed = new URL(`${scheme}://${request.authority}`);
        if (parsed.pathname === '/' && parsed.search === '' && parsed.username === '') target = parsed;
      } catch {
        // Reported below — openStream must return a writer, so the
        // failure surfaces through onEnd instead of a throw.
      }
      if (target === null) {
        queueMicrotask(() =>
          callbacks.onEnd(new GrpcTransportError(`The target must be host or host:port — got "${request.authority}".`)),
        );
        return { sendMessage: () => {}, halfClose: () => {} };
      }
      const resolvedTarget = target;

      let ended = false;
      let headArrived = false;
      let deadlineExpired = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let stream: ClientHttp2Stream | null = null;
      let session: ClientHttp2Session | null = null;
      let activeProxyUrl: string | undefined;
      // Upstream writes issued while the ambient route was still
      // resolving (a server-stream call writes and half-closes the
      // moment this returns) — flushed in order once the stream exists.
      const pending: PendingStreamWrite[] = [];
      const walk = new AbortController();

      const cleanup = (): void => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        signal?.removeEventListener('abort', onExternalAbort);
        walk.signal.removeEventListener('abort', onWalkAbort);
        session?.close();
      };
      const endWithError = (err: unknown): void => {
        if (ended) return;
        ended = true;
        cleanup();
        if (deadlineExpired) {
          callbacks.onEnd(
            new GrpcTransportError(`Call deadline of ${request.timeoutMs} ms elapsed before a response arrived.`),
          );
          return;
        }
        if (signal?.aborted) {
          callbacks.onEnd(new GrpcTransportError('Call aborted before a response arrived.'));
          return;
        }
        callbacks.onEnd(
          new GrpcTransportError(
            classifyGrpcFailure(request.authority, request.tls, err, request.unixSocketPath, activeProxyUrl),
          ),
        );
      };
      const endMessage = (message: string): void => {
        if (ended) return;
        ended = true;
        cleanup();
        callbacks.onEnd(new GrpcTransportError(message));
      };
      const endComplete = (): void => {
        if (ended) return;
        ended = true;
        cleanup();
        callbacks.onEnd();
      };
      const abortExchange = (): void => {
        // Same discipline as unary: once the head is in, arrived data
        // materializes — the close settles without an error.
        stream?.close(constants.NGHTTP2_CANCEL);
        session?.destroy();
        if (!headArrived) endWithError(new Error('aborted'));
        else endComplete();
      };
      const onWalkAbort = (): void => abortExchange();
      const onExternalAbort = (): void => walk.abort();

      if (signal?.aborted) {
        queueMicrotask(() => endWithError(new Error('aborted')));
        return { sendMessage: () => {}, halfClose: () => {} };
      }
      // ONE deadline spans resolution, tunnel dials, and the whole
      // exchange (the unary walk's discipline).
      if (request.timeoutMs !== undefined) {
        timer = setTimeout(() => {
          deadlineExpired = true;
          walk.abort();
        }, request.timeoutMs);
      }
      signal?.addEventListener('abort', onExternalAbort);
      walk.signal.addEventListener('abort', onWalkAbort);

      // Open the session over the decided dial shape and flush the
      // queued upstream writes — post-open failures settle through the
      // shared paths.
      const openAttempt = (sessionOpts: Parameters<typeof connect>[1], attempt: SessionProxyAttempt): void => {
        session = connect(resolvedTarget.origin, sessionOpts);
        session.on('error', endWithError);
        const opened = session.request(buildOutgoingHeaders(request));
        stream = opened;
        opened.on('error', (err: unknown) => {
          if (headArrived) endComplete();
          else endWithError(err);
        });
        opened.on('response', (incoming) => {
          headArrived = true;
          const status = incoming[':status'];
          const route: GrpcProxyRoute | undefined = attempt.route;
          callbacks.onHead(typeof status === 'number' ? status : 0, seamHeadersOf(incoming), route);
        });
        opened.on('trailers', (incoming) => {
          callbacks.onTrailers(seamHeadersOf(incoming));
        });
        opened.on('data', (chunk: Buffer) => {
          callbacks.onData(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
        });
        opened.on('close', () => {
          if (headArrived) endComplete();
          else endWithError(new Error(`stream closed (HTTP/2 code ${opened.rstCode ?? 'unknown'})`));
        });
        for (const write of pending) {
          if (opened.destroyed || opened.writableEnded) break;
          if (write.kind === 'message') opened.write(Buffer.from(writeGrpcFrame(write.message)));
          else opened.end();
        }
        pending.length = 0;
      };

      const runOpen = async (): Promise<void> => {
        const resolved = await resolveCallAttempts(resolvedTarget, request.unixSocketPath);
        if (ended) return;
        if ('errorMessage' in resolved) {
          endMessage(resolved.errorMessage);
          return;
        }
        const attempts = resolved.attempts;
        for (let i = 0; i < attempts.length; i += 1) {
          if (ended) return;
          const attempt = attempts[i];
          activeProxyUrl = attempt.proxy?.url;
          let tunnel: net.Socket | undefined;
          if (attempt.proxy !== undefined) {
            try {
              tunnel = await dialConnectTunnel(
                { hostname: resolvedTarget.hostname, port: targetPortOf(resolvedTarget, request.tls) },
                { proxy: attempt.proxy, signal: walk.signal },
              );
            } catch (err) {
              const nextExists = i < attempts.length - 1;
              if (
                attempt.environmentChain === true &&
                nextExists &&
                !walk.signal.aborted &&
                isSessionProxyDialFailure(err)
              ) {
                continue;
              }
              endWithError(err);
              return;
            }
          }
          const sessionOpts =
            tunnel !== undefined
              ? tunnelSessionOptionsFor(request, resolvedTarget, tunnel)
              : sessionOptionsFor(request, resolvedTarget);
          openAttempt(sessionOpts, attempt);
          return;
        }
      };
      void runOpen();

      return {
        sendMessage(message: Uint8Array): void {
          if (ended) return;
          if (stream === null) {
            pending.push({ kind: 'message', message });
            return;
          }
          if (stream.destroyed || stream.writableEnded) return;
          stream.write(Buffer.from(writeGrpcFrame(message)));
        },
        halfClose(): void {
          if (ended) return;
          if (stream === null) {
            pending.push({ kind: 'half-close' });
            return;
          }
          if (stream.destroyed || stream.writableEnded) return;
          stream.end();
        },
      };
    },
  };
}
