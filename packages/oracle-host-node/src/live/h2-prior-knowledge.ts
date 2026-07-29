/**
 * Prior-knowledge HTTP/2 hop — the wire pipeline behind the seam's
 * `httpVersion: '2-prior-knowledge'`, hand-rolled over `node:http2`
 * (the gRPC transport's session leg generalized to REST hops). No
 * negotiation happens at all: the session speaks the h2 connection
 * preface from its first byte, over TLS **and** cleartext alike —
 * cleartext h2 is the entire point of the value (h2c backends, Node
 * `http2.createServer()` dev rigs), the route ALPN can never reach.
 *
 * One session per hop, the gRPC discipline: a hop is user-initiated
 * and cheap, so pooling is a demand-gated residual and a fresh session
 * keeps the failure story per-hop. The hop resolves at the response
 * HEAD with the stream itself as the body — shaped as the transport's
 * `NodeRequestResponse` so the policy layer above (redirect chain,
 * digest leg, jar, deadline, capped read) adapts it exactly like an
 * undici `request()` hop. Trailers ride the h2 stream natively: the
 * resolved `trailers` record is a live view that fills when the
 * stream's `trailers` event fires (after the body — same ask-after-
 * the-read contract as undici's).
 *
 * Honest failure: a server that answers the preface with anything but
 * h2 framing surfaces as the session's protocol error, rejected
 * pre-head for the transport's classifier to name the setting. A
 * pre-head failure wrapped in `ERR_HTTP2_STREAM_CANCEL` is unwrapped
 * to its cause (a dial failure reaches the stream as a bare cancel
 * whose `cause` carries the real error — the gRPC transport's probed
 * finding).
 *
 * The per-request connection policy rides the session's own dial:
 * the transport's `ConnectOptions` bag (TLS window, ciphers, pinned
 * lookup, client certificate, socket path) passes straight into
 * `http2.connect`, which forwards it to `tls.connect` / `net.connect`
 * — `socketPath` as the dial-winning `path`, TLS-only options dropped
 * on cleartext dials.
 */

import { connect } from 'node:http2';
import type { TransportHeader } from '@openheaders/oracle/live/request-exec/transport';
import { servernameFor } from './instrumented-connector';
import type { ConnectOptions, NodeRequestResponse } from './node-request-transport';

/** One prior-knowledge hop as the transport dispatches it — the hop's
 *  wire fields plus the per-send connection policy and the always-on
 *  spoken-protocol sink. */
export interface H2PriorKnowledgeHopRequest {
  url: string;
  method: string;
  headers: ReadonlyArray<TransportHeader>;
  /** Body bytes to write on the stream — absent ends the stream with
   *  the headers (no DATA frames). */
  payload?: string | Uint8Array;
  connect: ConnectOptions;
  signal?: AbortSignal;
  /**
   * Reports the protocol this connection SPOKE, keyed like the
   * connectors key their facts (`hostname:port`, or the socket path).
   * Fired at the response head — by then the connection has exchanged
   * h2 frames both ways, so `'h2'` is wire truth, not the knob echoed.
   */
  onProtocol?(origin: string, alpnProtocol: string): void;
}

/** Connection-specific headers HTTP/2 forbids — `node:http2` throws on
 *  them, so the fold drops what HTTP/1.1 carried. `te` survives only
 *  as `trailers` (the one value h2 allows). */
const H2_CONNECTION_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'http2-settings',
]);

/**
 * The hop's headers as an outgoing h2 header block: pseudo-headers
 * first, then the hop's own fields lowercased with repeated keys
 * folded into arrays (Node's repeat encoding), connection-specific
 * fields dropped, and a user-set `Host` translated to `:authority` —
 * its h2 spelling (the socket-path dial's cosmetic-host contract
 * rides that translation).
 */
function outgoingHeadersFor(
  method: string,
  url: URL,
  headers: ReadonlyArray<TransportHeader>,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {
    ':method': method,
    ':path': `${url.pathname}${url.search}`,
    ':authority': url.host,
    ':scheme': url.protocol === 'https:' ? 'https' : 'http',
  };
  for (const { key, value } of headers) {
    const name = key.toLowerCase();
    if (H2_CONNECTION_HEADERS.has(name)) continue;
    if (name === 'te' && value.trim().toLowerCase() !== 'trailers') continue;
    if (name === 'host') {
      out[':authority'] = value;
      continue;
    }
    const existing = out[name];
    if (existing === undefined) {
      out[name] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[name] = [existing, value];
    }
  }
  return out;
}

/** Incoming h2 header block flattened to the `request()`-shaped record
 *  the transport's adapter reads — pseudo-headers (`:status`) excluded. */
function plainHeadersOf(
  incoming: Record<string, string | string[] | number | undefined>,
): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (key.startsWith(':')) continue;
    if (typeof value === 'string' || Array.isArray(value)) out[key] = value;
  }
  return out;
}

/** A pre-head failure's meaningful error: a dial failure reaches the
 *  stream as a bare `ERR_HTTP2_STREAM_CANCEL` whose `cause` carries
 *  the real error — hand the cause to the classifier, not the wrap. */
function unwrapStreamCancel(err: unknown): unknown {
  if (err !== null && typeof err === 'object') {
    const record = err as { code?: unknown; cause?: unknown };
    if (record.code === 'ERR_HTTP2_STREAM_CANCEL' && record.cause !== null && record.cause !== undefined) {
      return record.cause;
    }
  }
  return err;
}

/**
 * One prior-knowledge wire round-trip. Resolves at the response head
 * with the stream as the readable body (post-head failures propagate
 * through the stream, the `request()` contract); rejects pre-head with
 * the raw failure for the transport's classifier. The caller's signal
 * (the merged deadline) destroys the session — pre-head that rejects,
 * post-head it errors the body read.
 */
export function h2PriorKnowledgeHop(request: H2PriorKnowledgeHopRequest): Promise<NodeRequestResponse> {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const { socketPath, lookup, ...tlsOptions } = request.connect;
  const port = url.port !== '' ? url.port : secure ? '443' : '80';
  const origin = socketPath ?? `${url.hostname}:${port}`;
  const servername = servernameFor(url.hostname);
  return new Promise<NodeRequestResponse>((resolve, reject) => {
    let settled = false;
    const session = connect(`${url.protocol}//${url.host}`, {
      // TLS-only options ride only a TLS dial; the shared dial options
      // (pinned lookup, socket path) ride both. `path` wins over
      // host+port inside net/tls.connect — the socket-path contract.
      ...(secure ? tlsOptions : {}),
      ...(lookup !== undefined ? { lookup } : {}),
      ...(socketPath !== undefined ? { path: socketPath } : {}),
      ...(secure && servername !== undefined ? { servername } : {}),
    });

    const onAbort = (): void => {
      session.destroy(new Error('aborted'));
    };
    session.once('close', () => {
      request.signal?.removeEventListener('abort', onAbort);
    });
    if (request.signal !== undefined) {
      if (request.signal.aborted) {
        session.destroy();
        reject(new Error('aborted'));
        return;
      }
      request.signal.addEventListener('abort', onAbort);
    }

    const fail = (err: unknown): void => {
      if (settled) return;
      settled = true;
      session.destroy();
      reject(unwrapStreamCancel(err));
    };
    session.on('error', fail);

    const payload = request.payload;
    const stream = session.request(outgoingHeadersFor(request.method, url, request.headers), {
      endStream: payload === undefined,
    });
    // Live view: fills when the event fires, after the body — the
    // transport's adapter asks only once the capped read has consumed
    // the stream, the same ask-after contract as undici's trailers.
    const trailers: Record<string, string | string[] | undefined> = {};
    stream.on('trailers', (incoming) => {
      for (const [key, value] of Object.entries(plainHeadersOf(incoming))) trailers[key] = value;
    });
    stream.on('error', fail);
    stream.on('close', () => {
      // Pre-head close without an error event still means no response
      // is coming (a refused stream); post-head the session just winds
      // down behind the consumed body.
      if (!settled) {
        fail(new Error(`stream closed (HTTP/2 code ${stream.rstCode})`));
        return;
      }
      session.close();
    });
    stream.on('response', (incoming) => {
      if (settled) return;
      settled = true;
      request.onProtocol?.(origin, 'h2');
      const status = incoming[':status'];
      resolve({
        statusCode: typeof status === 'number' ? status : 0,
        headers: plainHeadersOf(incoming),
        body: stream,
        trailers,
      });
    });
    if (payload !== undefined) {
      stream.end(typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload));
    }
  });
}
