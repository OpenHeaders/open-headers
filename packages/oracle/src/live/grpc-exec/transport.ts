/**
 * gRPC transport seam — the host-specific port the host-neutral gRPC
 * executor calls out to for one wire exchange. A deliberate SIBLING of
 * the HTTP `RequestTransport` seam, never an extension of it: the
 * buffered HTTP contract stays untouched (the S8 scope law's executor
 * twin), and a gRPC call's anatomy — an HTTP/2 session with trailer
 * reads and message framing — shares no shape with a fetch exchange.
 *
 * Same seam discipline as `request-exec/transport.ts`: plain data in
 * both directions, so the contract holds whether the transport is
 * in-process (the desktop main process) or behind a forwarding wire
 * (the extension's Phase F peer sends). Hosts without an HTTP/2 stack
 * that surfaces trailers (the browser SW) simply have no
 * implementation to inject — the capability gap IS the honest answer.
 *
 * The transport owns the wire ceremony: message framing, the
 * `content-type: application/grpc+proto` / `te: trailers` headers, the
 * `grpc-timeout` deadline (header AND local abort), TLS vs cleartext
 * connect, and error classification into user-actionable messages. The
 * executor hands it an ENCODED, UNFRAMED message and reads back the
 * raw capped body plus metadata — frame unwrapping and status
 * extraction are pure `@openheaders/core/proto` calls the executor
 * runs itself, so the framing rules never fork per host.
 */

/** One metadata field on the wire (request or response side).
 *  Repeated keys are allowed — the host appends them in order. */
export interface GrpcTransportHeader {
  key: string;
  value: string;
}

export interface GrpcTransportRequest {
  /** Target authority (`host` or `host:port`), scheme-free — the
   *  channel's TLS question rides the separate flag. */
  authority: string;
  /** TLS channel flag; `false` = cleartext HTTP/2 (h2c). */
  tls: boolean;
  /** Verify the server certificate against the system roots. Absent =
   *  verify (the safe default); `false` accepts self-signed servers.
   *  Meaningful only when `tls` is true. */
  sslVerification?: boolean;
  /** Request path: `/{service full name}/{rpc}`. */
  path: string;
  /** Custom metadata, already resolved and filtered of the fields the
   *  transport owns (pseudo-headers, content-type, te). */
  metadata: ReadonlyArray<GrpcTransportHeader>;
  /** The request message, encoded but UNFRAMED — the transport wraps
   *  it in the 5-byte gRPC frame (compression flag 0; v1 never
   *  compresses). */
  message: Uint8Array;
  /**
   * Whole-call deadline (ms). The transport sends it as the
   * `grpc-timeout` header AND enforces it locally — connect, response,
   * and body read all abort once it elapses, surfacing a
   * {@link GrpcTransportError} that names the deadline. Absent = no
   * ceiling beyond the host network stack's own.
   */
  timeoutMs?: number;
  /** Hard ceiling (bytes) on the response body read off the wire —
   *  the transport streams and aborts past it (the HTTP transport's
   *  memory-bound law; the always-on host never buffers unbounded). */
  maxBodyBytes: number;
}

export interface GrpcTransportResponse {
  /** HTTP/2 `:status` (200 on any well-formed gRPC reply). */
  httpStatus: number;
  /** Initial metadata (the response HEADERS frame), pseudo-headers
   *  excluded, wire order. */
  headers: ReadonlyArray<GrpcTransportHeader>;
  /** Trailer fields, verbatim; empty for trailers-only replies (their
   *  status rides `headers`). */
  trailers: ReadonlyArray<GrpcTransportHeader>;
  /** Raw framed body bytes as read off the wire, capped at
   *  {@link GrpcTransportRequest.maxBodyBytes} — never rewritten. */
  body: Uint8Array;
  /** True when the upstream body overran the cap and the read aborted
   *  — `body` is the capped prefix. */
  bodyTruncated: boolean;
}

/**
 * Thrown when the call never produced a response head (DNS/connect
 * failure, TLS handshake, deadline or abort before headers). `message`
 * is the host's classified, user-actionable string — the executor
 * surfaces it verbatim on the snapshot's `error`. A reply carrying a
 * non-zero `grpc-status` is NOT an error here: the transport resolves
 * normally and the status renders honestly on the response surface.
 */
export class GrpcTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GrpcTransportError';
  }
}

/**
 * The streaming twin's request: {@link GrpcTransportRequest} minus the
 * message and the body cap — upstream messages ride the returned
 * {@link GrpcStreamWriter} (a server-stream call writes its one
 * composed message and half-closes immediately; client/bidi write on
 * user action), and the response byte cap is the EXECUTOR's to enforce
 * (it counts `onData` bytes and aborts past the cap — the framing
 * twin of the unary law that keeps wire policy from forking per host).
 */
export interface GrpcTransportStreamRequest {
  authority: string;
  tls: boolean;
  /** See {@link GrpcTransportRequest.sslVerification}. */
  sslVerification?: boolean;
  path: string;
  metadata: ReadonlyArray<GrpcTransportHeader>;
  timeoutMs?: number;
}

/**
 * Observer for one streaming call, plain data per callback so the
 * contract holds across a forwarding wire. Delivery discipline:
 * `onHead` at most once, then `onData` per wire chunk (raw FRAMED
 * bytes — frame unwrapping stays a core-proto call the executor runs),
 * `onTrailers` at most once, and `onEnd` EXACTLY once on every path —
 * completion, abort, deadline, connection loss. An `onEnd` without a
 * prior `onHead` carries the classified pre-head failure.
 */
export interface GrpcStreamCallbacks {
  onHead(httpStatus: number, headers: ReadonlyArray<GrpcTransportHeader>): void;
  onData(chunk: Uint8Array): void;
  onTrailers(trailers: ReadonlyArray<GrpcTransportHeader>): void;
  onEnd(error?: GrpcTransportError): void;
}

/**
 * The client side of an open streaming call. Writes after half-close
 * or call end are quiet no-ops — the executor's registry unregisters
 * on settle, so a late RPC rider already answers "no such stream".
 */
export interface GrpcStreamWriter {
  /** Write one message, encoded but UNFRAMED — the transport wraps
   *  the 5-byte frame (flag 0; v1 never compresses upstream). */
  sendMessage(message: Uint8Array): void;
  /** Half-close the client side — the end of the request stream. */
  halfClose(): void;
}

export interface GrpcTransport {
  /**
   * One unary exchange. `signal` aborts the whole call (the Stop
   * hook); an abort before the response head throws a
   * {@link GrpcTransportError}, an abort mid-body resolves with the
   * partial bytes (record what arrived).
   */
  invoke(request: GrpcTransportRequest, signal?: AbortSignal): Promise<GrpcTransportResponse>;
  /**
   * Open one streaming call (any non-unary shape — the executor
   * drives the per-shape ceremony through the writer). `signal`
   * aborts the whole call; after the head arrived an abort still
   * settles through `onEnd()` with no error, so the executor records
   * what arrived. OPTIONAL: a host without a streaming-capable stack
   * simply doesn't implement it, and unary keeps working — the
   * executor answers streaming invokes with a structured capability
   * gap.
   */
  openStream?(
    request: GrpcTransportStreamRequest,
    callbacks: GrpcStreamCallbacks,
    signal?: AbortSignal,
  ): GrpcStreamWriter;
}
