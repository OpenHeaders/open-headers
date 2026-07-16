/**
 * Node gRPC transport — the node hosts' implementation of the engine's
 * {@link GrpcTransport} seam, hand-rolled over `node:http2` (no
 * `@grpc/grpc-js`, per the S1 fork ratification). One HTTP/2 session
 * per invoke: a unary call is user-initiated and cheap, so pooling is
 * a demand-gated residual, and a fresh session keeps the failure
 * story per-call.
 *
 * Wire ceremony owned here:
 *   - `POST /{service}/{rpc}` with `content-type: application/grpc+proto`
 *     and `te: trailers`; the encoded message rides ONE gRPC frame
 *     (compression flag 0 — v1 negotiates no compression, and the flag
 *     is never claimed falsely: F5.2 flag honesty).
 *   - TLS per the request's flag: `https://` connect (verified against
 *     the system roots) or cleartext h2c. Prior-knowledge h2c — gRPC
 *     servers speak HTTP/2 directly, no upgrade dance.
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
 * (undici isn't in this path, so the `err.code` is Node's own).
 */

import { type ClientHttp2Session, type ClientHttp2Stream, connect, constants } from 'node:http2';
import { encodeGrpcTimeout, writeGrpcFrame } from '@openheaders/core/proto';
import {
  type GrpcTransport,
  GrpcTransportError,
  type GrpcTransportHeader,
  type GrpcTransportRequest,
  type GrpcTransportResponse,
} from '@openheaders/oracle/live/grpc-exec/transport';

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
function buildOutgoingHeaders(request: GrpcTransportRequest): Record<string, string | string[]> {
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

/**
 * Classify a pre-head failure into a user-actionable message. `err` is
 * Node's own (no undici layers here); the codes below are the ones a
 * dial, handshake, or protocol mismatch actually surfaces.
 */
function classifyGrpcFailure(authority: string, tls: boolean, err: unknown): string {
  const code = grpcFailureCode(err);
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
      return tls
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

export function createNodeGrpcTransport(): GrpcTransport {
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
      return new Promise<GrpcTransportResponse>((resolve, reject) => {
        let settled = false;
        let headArrived = false;
        let httpStatus = 0;
        let headers: GrpcTransportHeader[] = [];
        let trailers: GrpcTransportHeader[] = [];
        const parts: Buffer[] = [];
        let bytesRead = 0;
        let truncated = false;
        let deadlineExpired = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let stream: ClientHttp2Stream | null = null;

        const session: ClientHttp2Session = connect(target.origin);

        const cleanup = (): void => {
          if (timer !== null) clearTimeout(timer);
          signal?.removeEventListener('abort', onAbort);
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
          reject(new GrpcTransportError(classifyGrpcFailure(request.authority, request.tls, err)));
        };
        const settleResponse = (): void => {
          if (settled) return;
          settled = true;
          cleanup();
          const body = Buffer.concat(parts, Math.min(bytesRead, request.maxBodyBytes));
          resolve({
            httpStatus,
            headers,
            trailers,
            body: new Uint8Array(body.buffer, body.byteOffset, body.byteLength),
            bodyTruncated: truncated,
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

        if (request.timeoutMs !== undefined) {
          timer = setTimeout(() => {
            deadlineExpired = true;
            abortExchange();
          }, request.timeoutMs);
        }
        if (signal !== undefined) {
          if (signal.aborted) {
            session.destroy();
            settleError(new Error('aborted'));
            return;
          }
          signal.addEventListener('abort', onAbort);
        }

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
    },
  };
}
