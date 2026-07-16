/**
 * gRPC-over-HTTP/2 wire ceremony — the protocol layer between the
 * protobuf codec and an HTTP/2 stream: the 5-byte message framing that
 * wraps every encoded message on the wire, the `grpc-timeout` header
 * value a deadline travels as, and `grpc-status`/`grpc-message`
 * extraction from response metadata (trailers-first, with the
 * trailers-only reply shape where the status rides the initial
 * headers). Pure data in, pure data out — the node transport, the
 * playground probe server, and the response surface all speak through
 * this one module so the framing rules never fork.
 */

/** One unwrapped message frame: the compression flag byte verbatim
 *  (0 = uncompressed, 1 = compressed per `grpc-encoding`; anything
 *  else is recorded as-received — flag honesty, never a rewrite) and
 *  the payload bytes. */
export interface GrpcWireFrame {
  flag: number;
  data: Uint8Array;
}

/** Wrap one encoded message in the gRPC frame: 1 flag byte + 4-byte
 *  big-endian length prefix. v1 never compresses, so the flag is 0
 *  unless the caller explicitly says otherwise. */
export function writeGrpcFrame(data: Uint8Array, compressed = false): Uint8Array {
  const frame = new Uint8Array(5 + data.byteLength);
  frame[0] = compressed ? 1 : 0;
  new DataView(frame.buffer).setUint32(1, data.byteLength, false);
  frame.set(data, 5);
  return frame;
}

/**
 * Unwrap a buffered wire body into its message frames. Never throws:
 * a body cut mid-frame (capped read, severed connection) yields the
 * complete frames plus `incomplete: true` — record what arrived, the
 * capture law. Payloads are subarray views over the input.
 */
export function readGrpcFrames(bytes: Uint8Array): { frames: GrpcWireFrame[]; incomplete: boolean } {
  const frames: GrpcWireFrame[] = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 0;
  while (at < bytes.byteLength) {
    if (at + 5 > bytes.byteLength) return { frames, incomplete: true };
    const flag = bytes[at];
    const length = view.getUint32(at + 1, false);
    if (at + 5 + length > bytes.byteLength) return { frames, incomplete: true };
    frames.push({ flag, data: bytes.subarray(at + 5, at + 5 + length) });
    at += 5 + length;
  }
  return { frames, incomplete: false };
}

/**
 * Encode a millisecond deadline as the `grpc-timeout` header value —
 * at most 8 ASCII digits plus a unit. Milliseconds up to 8 digits ride
 * verbatim; longer deadlines climb the unit ladder (rounding UP so the
 * server never times out before the client's own local abort).
 */
export function encodeGrpcTimeout(timeoutMs: number): string {
  const ms = Math.max(0, Math.ceil(timeoutMs));
  if (ms < 100_000_000) return `${ms}m`;
  const seconds = Math.ceil(ms / 1_000);
  if (seconds < 100_000_000) return `${seconds}S`;
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 100_000_000) return `${minutes}M`;
  return `${Math.ceil(ms / 3_600_000)}H`;
}

/** Canonical gRPC status-code names (google.rpc.Code). */
export const GRPC_STATUS_NAMES: Readonly<Record<number, string>> = {
  0: 'OK',
  1: 'CANCELLED',
  2: 'UNKNOWN',
  3: 'INVALID_ARGUMENT',
  4: 'DEADLINE_EXCEEDED',
  5: 'NOT_FOUND',
  6: 'ALREADY_EXISTS',
  7: 'PERMISSION_DENIED',
  8: 'RESOURCE_EXHAUSTED',
  9: 'FAILED_PRECONDITION',
  10: 'ABORTED',
  11: 'OUT_OF_RANGE',
  12: 'UNIMPLEMENTED',
  13: 'INTERNAL',
  14: 'UNAVAILABLE',
  15: 'DATA_LOSS',
  16: 'UNAUTHENTICATED',
};

/** `0 OK`-style display label; unknown codes show bare (`42`). */
export function grpcStatusLabel(code: number): string {
  const name = GRPC_STATUS_NAMES[code];
  return name === undefined ? `${code}` : `${code} ${name}`;
}

/** One metadata field as captured off the wire. */
export interface GrpcMetadataField {
  key: string;
  value: string;
}

/**
 * The call status extracted from a reply's metadata. `code: null` =
 * the server sent no parseable `grpc-status` anywhere — rendered
 * honestly, never defaulted to 0. `source` records where the status
 * was found: `'trailers'` for the normal reply shape, `'headers'` for
 * a trailers-only reply (the whole status arrived in the initial
 * HEADERS frame and no message ever followed).
 */
export interface GrpcCallStatus {
  code: number | null;
  /** `grpc-message`, percent-decoded per the gRPC spec; absent when
   *  the server sent none. */
  message?: string;
  source: 'trailers' | 'headers' | null;
}

function statusIn(fields: ReadonlyArray<GrpcMetadataField>): { code: number; message?: string } | null {
  let code: number | null = null;
  let message: string | undefined;
  for (const field of fields) {
    const key = field.key.toLowerCase();
    if (key === 'grpc-status' && code === null) {
      const parsed = Number.parseInt(field.value, 10);
      if (Number.isFinite(parsed)) code = parsed;
    } else if (key === 'grpc-message' && message === undefined) {
      message = decodeGrpcMessage(field.value);
    }
  }
  if (code === null) return null;
  return { code, ...(message !== undefined ? { message } : {}) };
}

/**
 * Extract the call status: trailers first (the normal shape), then the
 * initial headers (trailers-only replies put the whole status there).
 * A reply carrying `grpc-status` in neither place resolves
 * `{ code: null, source: null }` — the surface says so instead of
 * inventing an OK.
 */
export function extractGrpcStatus(
  headers: ReadonlyArray<GrpcMetadataField>,
  trailers: ReadonlyArray<GrpcMetadataField>,
): GrpcCallStatus {
  const fromTrailers = statusIn(trailers);
  if (fromTrailers !== null) return { ...fromTrailers, source: 'trailers' };
  const fromHeaders = statusIn(headers);
  if (fromHeaders !== null) return { ...fromHeaders, source: 'headers' };
  return { code: null, source: null };
}

/** Percent-decode a `grpc-message` value (the spec's encoding);
 *  malformed sequences surface the raw text rather than throwing. */
export function decodeGrpcMessage(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
