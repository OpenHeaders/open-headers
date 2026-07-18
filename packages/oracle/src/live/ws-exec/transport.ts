/**
 * WebSocket transport seam — the host-specific port the host-neutral
 * WS session executor calls out to for one live session. A deliberate
 * SIBLING of `RequestTransport` and `GrpcTransport`, never an
 * extension of either: the buffered HTTP contract and the gRPC plane
 * stay untouched (the S8 scope law's executor twin), and a WebSocket
 * session's anatomy — one long-lived bidirectional message stream with
 * a Close handshake — shares no shape with a fetch exchange or an
 * HTTP/2 call.
 *
 * Same seam discipline as the siblings: plain data in both directions,
 * so the contract holds whether the transport is in-process (the
 * desktop main process, the daemon) or behind a forwarding wire later.
 * There is no unary leg — a session IS the exchange, so the seam is
 * connect-only (the gRPC `openStream` twin's posture, mandatory here).
 *
 * The transport owns the platform socket ceremony: the handshake
 * (custom headers and subprotocol offers — node-host capabilities),
 * TLS verification policy, the connect deadline, and classifying
 * pre-open failures into user-actionable messages. Payloads cross the
 * seam as bytes with the wire frame type tagged (`binary`) — decode
 * to text is display-side, never a transport rewrite.
 */

/** One handshake header, already resolved and filtered of the fields
 *  the platform socket owns. Node-host capability. */
export interface WsTransportHeader {
  key: string;
  value: string;
}

export interface WsTransportRequest {
  /** Full session URL, `ws://` or `wss://`, params already appended —
   *  unlike the gRPC authority split, the WS URL carries its scheme. */
  url: string;
  /** Custom handshake headers (node-only knob). */
  headers: ReadonlyArray<WsTransportHeader>;
  /** `Sec-WebSocket-Protocol` offers, preference order. */
  subprotocols: ReadonlyArray<string>;
  /** Verify the server certificate against the system roots. Absent =
   *  verify (the safe default); `false` accepts self-signed servers.
   *  Meaningful only for `wss:`. */
  sslVerification?: boolean;
  /**
   * Handshake deadline (ms): connect + upgrade must complete inside
   * it or the attempt aborts with a classified error. An OPEN session
   * has no ceiling — it lives until a close, Stop, or Disconnect.
   */
  timeoutMs?: number;
}

/** One inbound message as the wire carried it: payload bytes plus the
 *  frame type (`binary`) — a text frame's bytes are its UTF-8. */
export interface WsTransportMessage {
  data: Uint8Array;
  binary: boolean;
}

/** The Close event as the platform socket reports it. Code 1006 is
 *  the platform's marker for "no Close frame arrived" (by spec it
 *  never crosses the wire) — the executor records that absence as the
 *  `null` close it is; anything else is the handshake verbatim. */
export interface WsTransportClose {
  code: number;
  reason: string;
  wasClean: boolean;
}

/**
 * Thrown (via `onEnd`) when the session never opened — DNS/connect
 * failure, TLS handshake, upgrade rejection, connect deadline.
 * `message` is the host's classified, user-actionable string — the
 * executor surfaces it verbatim on the snapshot's `error`.
 */
export class WsTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WsTransportError';
  }
}

/**
 * Observer for one session, plain data per callback so the contract
 * holds across a forwarding wire. Delivery discipline: `onOpen` at
 * most once (the handshake settled — negotiated subprotocol and
 * extensions attached; the platform socket exposes no further
 * handshake response headers, an honesty note the capture carries),
 * then `onMessage` per inbound message, `onClose` at most once with
 * the platform's Close accounting, and `onEnd` EXACTLY once on every
 * path — clean close, abort, deadline, severed connection. An `onEnd`
 * without a prior `onOpen` carries the classified pre-open failure.
 */
export interface WsSessionCallbacks {
  onOpen(protocol: string, extensions: string): void;
  onMessage(message: WsTransportMessage): void;
  onClose(close: WsTransportClose): void;
  onEnd(error?: WsTransportError): void;
}

/**
 * The client side of an open session. Writes after close are quiet
 * no-ops — the executor's registry unregisters on settle, so a late
 * RPC rider already answers "no such session".
 */
export interface WsSessionWriter {
  /** Write one text message verbatim (v1 composes text only). */
  send(text: string): void;
  /** Start the Close handshake — Disconnect sends the clean 1000. */
  close(code: number, reason: string): void;
}

export interface WsTransport {
  /**
   * Open one session. `signal` aborts it at any point (the Stop
   * hook): before the handshake it settles through `onEnd` with a
   * classified error; after `onOpen` it tears the socket down and
   * still settles through `onEnd()` with no error, so the executor
   * records what arrived.
   */
  connect(request: WsTransportRequest, callbacks: WsSessionCallbacks, signal?: AbortSignal): WsSessionWriter;
}
