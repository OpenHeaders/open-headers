/**
 * gRPC response-message views — pure derivations from an executed
 * invoke's captured frames to what the Response tab renders. Decode is
 * a VIEW over the capture (the F5.2 posture): schema-driven canonical
 * JSON when the rpc's response type resolves against the linked spec's
 * registry, the schema-less STRUCTURAL decode when it doesn't, raw
 * base64 when the bytes decode as neither, and honest degradations for
 * compressed frames (v1 negotiates no compression, so one can't be
 * decoded) and empty replies. The wire bytes are never rewritten.
 */

import { decodeMessage, type ProtoRegistry } from '@openheaders/core/proto';
import type { ExecutedGrpcSnapshot } from '@openheaders/core/types';
import { decodeBase64Bytes } from '@openheaders/core/utils';
import { isJsonNumber } from '../request-editor/response/lossless-json';
import { decodeBinaryPreview, isDiagnosticText } from '../request-editor/response/response-binary-decode';

export type GrpcMessageView =
  /** Canonical JSON via the linked spec's registry — the full view. */
  | { kind: 'schema'; text: string }
  /** Field-number structural decode — the spec didn't resolve the
   *  response type (or the bytes don't match it). */
  | { kind: 'structural'; text: string }
  /** Neither decode fits — the captured bytes verbatim. */
  | { kind: 'raw'; base64: string }
  /** The frame's compression flag is set — undecodable by design. */
  | { kind: 'compressed' }
  /** The reply carried no message frame (error replies usually don't). */
  | { kind: 'none' };

/**
 * Derive one captured frame's view. `type` is the message type the
 * frame should decode as — the rpc's response type for received
 * frames, its request type for sent ones (null when the method or
 * spec doesn't resolve); `registry` is the editor's live derivation.
 */
export function deriveGrpcFrameView(
  frame: { dataBase64: string; compressed: boolean },
  registry: ProtoRegistry | null,
  type: string | null,
): GrpcMessageView {
  if (frame.compressed) return { kind: 'compressed' };
  const bytes = decodeBase64Bytes(frame.dataBase64);
  if (bytes === null) return { kind: 'raw', base64: frame.dataBase64 };
  if (registry !== null && type !== null && registry.messages.has(type)) {
    try {
      return { kind: 'schema', text: JSON.stringify(decodeMessage(registry, type, bytes), null, 2) };
    } catch {
      // Bytes that don't parse as the declared type fall through to the
      // structural view — the capture stays authoritative over the spec.
    }
  }
  const structural = decodeBinaryPreview('protobuf', bytes);
  if (structural !== null) return { kind: 'structural', text: printStructural(structural.value) };
  return { kind: 'raw', base64: frame.dataBase64 };
}

/**
 * Derive the Response tab's message view from the first captured frame.
 * `outputType` is the selected rpc's resolved response type full name
 * (null when the method or spec doesn't resolve).
 */
export function deriveGrpcMessageView(
  snapshot: ExecutedGrpcSnapshot,
  registry: ProtoRegistry | null,
  outputType: string | null,
): GrpcMessageView {
  const frame = snapshot.messages[0];
  if (frame === undefined) return { kind: 'none' };
  return deriveGrpcFrameView(frame, registry, outputType);
}

/**
 * Pretty-print a structural decode. JSON.stringify can't carry the
 * decoder's non-JSON leaves — `JsonNumber` (exact big integers, the F3
 * law) and `DiagnosticText` (`h'…'` byte strings, fixed-word dual
 * readings) print verbatim, unquoted, exactly as the HTTP preview's
 * tree renders them.
 */
export function printStructural(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);
  if (isJsonNumber(value) || isDiagnosticText(value)) return String(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map((item) => `${childPad}${printStructural(item, indent + 1)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const items = entries.map(([key, v]) => `${childPad}${JSON.stringify(key)}: ${printStructural(v, indent + 1)}`);
    return `{\n${items.join(',\n')}\n${pad}}`;
  }
  return String(value);
}

/**
 * Drop the `grpc-status` / `grpc-message` pair from a metadata field
 * list — that pair IS the status mechanism, already surfaced decoded
 * as the status pill and error chip, so the Metadata/Trailers grids
 * show only the fields beyond it (the Postman convention).
 */
export function withoutGrpcStatusPair(
  rows: ReadonlyArray<{ key: string; value: string }>,
): Array<{ key: string; value: string }> {
  return rows.filter((row) => {
    const key = row.key.toLowerCase();
    return key !== 'grpc-status' && key !== 'grpc-message';
  });
}

/** The selected rpc's resolved response-type full name, or null when
 *  the method / spec doesn't resolve it. */
export function grpcOutputTypeOf(
  registry: ProtoRegistry | null,
  method: { service: string; rpc: string } | undefined,
): string | null {
  if (registry === null || method === undefined) return null;
  const service = registry.services.find((s) => s.fullName === method.service);
  return service?.rpcs.find((r) => r.name === method.rpc)?.outputType ?? null;
}

/** The selected rpc's resolved request-type full name — sent (↑)
 *  timeline frames decode as it. Null when the method / spec doesn't
 *  resolve. */
export function grpcInputTypeOf(
  registry: ProtoRegistry | null,
  method: { service: string; rpc: string } | undefined,
): string | null {
  if (registry === null || method === undefined) return null;
  const service = registry.services.find((s) => s.fullName === method.service);
  return service?.rpcs.find((r) => r.name === method.rpc)?.inputType ?? null;
}
