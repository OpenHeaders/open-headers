/**
 * gRPC execution snapshot — the response shape the runtime returns to
 * UI surfaces after invoking a GrpcRequest. Own shape beside
 * `ExecutedRequestSnapshot` (own entity kind, own executor plane —
 * never a discriminant on the HTTP snapshot).
 *
 * Capture law: the snapshot records what the call DID, verbatim —
 * unframed message wire bytes with each frame's compression flag as
 * received, initial metadata and trailers as answered, and the
 * grpc-status the reply actually carried (`null` when it carried
 * none). Schema-driven decode is a display-side VIEW over these bytes;
 * nothing here is ever rewritten to make a reply look well-formed.
 */

/** One response message frame, unwrapped from the wire: the payload
 *  bytes base64-encoded and the frame's compression flag as received
 *  (v1 negotiates no compression, so a compressed frame renders as a
 *  diagnostic rather than decoding). */
export interface ExecutedGrpcMessageFrame {
  dataBase64: string;
  compressed: boolean;
}

export interface ExecutedGrpcSnapshot {
  /** HTTP/2 `:status` of the reply (200 on any well-formed gRPC
   *  exchange, error statuses included). `0` when the call never
   *  produced a response (connect failure, pre-head deadline, abort). */
  httpStatus: number;
  /** Initial metadata (the response HEADERS frame), wire order. */
  headers: Array<{ key: string; value: string }>;
  /** Trailer fields, verbatim — empty for trailers-only replies
   *  (their status rides `headers`; see `grpcStatusSource`). */
  trailers: Array<{ key: string; value: string }>;
  /** The reply's `grpc-status` code; `null` = the server sent none
   *  anywhere — surfaced honestly, never defaulted to 0. */
  grpcStatus: number | null;
  /** `grpc-message`, percent-decoded; absent when the server sent none. */
  grpcMessage?: string;
  /** Where the status was found: `'trailers'` (the normal shape) or
   *  `'headers'` (a trailers-only reply). `null` with a null status. */
  grpcStatusSource: 'trailers' | 'headers' | null;
  /** Unwrapped response message frames in wire order — one entry for a
   *  well-behaved unary reply; extras are captured and surfaced. */
  messages: ExecutedGrpcMessageFrame[];
  /** True when the body ended mid-frame (capped read, severed
   *  connection) — `messages` holds the complete frames that arrived. */
  incompleteTail?: boolean;
  /** True when the response body exceeded the byte cap and the read
   *  was aborted. */
  bodyTruncated: boolean;
  /** The cap in force when `bodyTruncated` — labels the actual limit. */
  bodyCapBytes?: number;
  /** Framed body bytes read off the wire before any truncation. */
  bodyBytes: number;
  durationMs: number;
  /** Non-null when the call failed before producing a response. */
  error: string | null;
}
