/**
 * Schema-less binary decodes for the response body's Preview: CBOR
 * (RFC 8949) and MessagePack are self-describing, so their captured
 * bytes decode to a JSON-like value the existing tree preview renders —
 * a Preview fork over a binary-like body, exactly the image/PDF
 * pattern. Hand-rolled decoders (static bundling: no new dependencies);
 * display-only throughout — the capture bytes are never rewritten, Hex
 * stays the base view, and a body that does not decode simply offers no
 * preview (never a crash, never a reclassification).
 *
 * Protobuf wire format is NOT self-describing — its decode here is
 * STRUCTURAL (field numbers, wire types, nested guesses for
 * length-delimited payloads), a best-effort view the caller labels as
 * such. gRPC bodies unwrap their 5-byte message framing first
 * (compressed frames don't decode and degrade to a diagnostic;
 * grpc-web's in-body trailers frame surfaces as text).
 *
 * Values JSON cannot carry render in CBOR diagnostic notation, kept
 * consistent across all decoders: byte strings as `h'…'`, CBOR tags as
 * `tag(content)`, MessagePack extensions as `ext(type, h'…')`,
 * protobuf fixed words as `fixed64(u64, double d)` / `fixed32(u32,
 * float f)` (both readings — schema-less can't know which), and
 * `undefined`/`simple(n)` verbatim. Integers past double precision ride
 * the F3 law — a {@link JsonNumber} leaf displays the exact value.
 */

import { JsonNumber } from './lossless-json';
import { contentTypeOf } from './response-format';

/** A non-JSON-mappable leaf carried as its diagnostic-notation text —
 *  rendered verbatim (unquoted) by the tree preview. A class so no
 *  genuine decoded string can impersonate it. */
export class DiagnosticText {
  readonly text: string;
  constructor(text: string) {
    this.text = text;
  }
  toString(): string {
    return this.text;
  }
}

export function isDiagnosticText(value: unknown): value is DiagnosticText {
  return value instanceof DiagnosticText;
}

export type BinaryDecodeKind = 'cbor' | 'msgpack' | 'protobuf' | 'grpc';

/** The decoder a response's Content-Type names — `application/cbor`,
 *  the MessagePack pair (`application/msgpack`, `…/x-msgpack`), the
 *  protobuf family (`application/x-protobuf`, `…/protobuf`,
 *  `…/vnd.google.protobuf`), and gRPC (`application/grpc*`, whose
 *  bodies carry the 5-byte message framing — checked before protobuf
 *  because `grpc+proto` contains both markers). Content-Type picks the
 *  RENDERER only (a preview to offer); whether the body is text or
 *  bytes stays decided by the bytes. `cbor-seq` is multi-item framing
 *  the single-item decoder does not cover. */
export function binaryDecodeKind(headers: ReadonlyArray<{ key: string; value: string }>): BinaryDecodeKind | null {
  const ct = contentTypeOf(headers);
  if (ct.includes('msgpack')) return 'msgpack';
  if (ct.includes('cbor') && !ct.includes('cbor-seq')) return 'cbor';
  if (ct.includes('grpc')) return 'grpc';
  if (ct.includes('protobuf')) return 'protobuf';
  return null;
}

/** Decode the captured wire bytes to a tree-previewable value — `null`
 *  on anything malformed (the caller offers no preview). Wrapped so a
 *  legitimately decoded `null` body stays distinguishable. One pass,
 *  strict: trailing bytes after the root item reject. */
export function decodeBinaryPreview(kind: BinaryDecodeKind, bytes: Uint8Array): { value: unknown } | null {
  try {
    switch (kind) {
      case 'cbor':
        return { value: decodeCbor(bytes) };
      case 'msgpack':
        return { value: decodeMessagePack(bytes) };
      case 'protobuf':
        return { value: decodeProtobuf(bytes) };
      case 'grpc':
        return { value: decodeGrpc(bytes) };
      default: {
        const _exhaustive: never = kind;
        void _exhaustive;
        return null;
      }
    }
  } catch {
    return null;
  }
}

/** Nesting ceiling — hostile `[[[[…]]]]` bodies must not blow the
 *  stack; genuine payloads never approach it. */
const MAX_DEPTH = 100;

/** Total decoded-item ceiling — a few bytes can claim million-entry
 *  containers; the budget bounds work to the body cap's order. */
const MAX_ITEMS = 1_000_000;

/** Bytes of a byte string / extension payload shown as hex before the
 *  diagnostic truncates — a multi-KB blob as one hex leaf helps nobody. */
const BYTE_PREVIEW_CAP = 256;

/** Strict UTF-8 — a text item whose bytes aren't valid UTF-8 fails the
 *  decode (garbage presented as data helps nobody). */
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });

class DecodeFailure extends Error {}

const fail = (): never => {
  throw new DecodeFailure();
};

const HEX = '0123456789ABCDEF';

function hexOf(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 0x0f];
  return out;
}

/** `h'…'` diagnostic for a byte string, hex-capped; the suffix keeps
 *  the true size visible when the preview cuts. */
function bytesDiagnostic(bytes: Uint8Array): DiagnosticText {
  if (bytes.length <= BYTE_PREVIEW_CAP) return new DiagnosticText(`h'${hexOf(bytes)}'`);
  return new DiagnosticText(`h'${hexOf(bytes.subarray(0, BYTE_PREVIEW_CAP))}…' (${bytes.length} bytes)`);
}

/** Integers ride the F3 display law: exact as a double → plain number;
 *  past safe-integer range → the source-text leaf, displayed verbatim. */
function intValue(value: bigint): number | JsonNumber {
  if (value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(value);
  return new JsonNumber(value.toString());
}

/** Inline diagnostic for a decoded primitive — tag contents and map
 *  keys print through this; containers summarize (`[…]` / `{…}`)
 *  rather than re-serializing arbitrarily deep values. */
function primitiveDiagnostic(value: unknown): string {
  if (value instanceof JsonNumber) return value.source;
  if (value instanceof DiagnosticText) return value.text;
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return '[…]';
  if (typeof value === 'object') return '{…}';
  return String(value);
}

const isPrimitiveLeaf = (value: unknown): boolean =>
  value === null || typeof value !== 'object' || value instanceof JsonNumber || value instanceof DiagnosticText;

/** Tree keys must be strings: string keys stay verbatim, every other
 *  key prints its diagnostic (`7`, `true`, `h'00'`) — colliding
 *  stringifications keep the last value, the JSON display precedent. */
function keyOf(value: unknown): string {
  return typeof value === 'string' ? value : primitiveDiagnostic(value);
}

interface Cursor {
  pos: number;
  items: number;
}

/** Bounds guard for a container's claimed length: it must fit the
 *  remaining bytes (each item costs ≥1 byte) — rejecting headers that
 *  claim 2^60 entries — and fit the item budget. A precheck only; the
 *  per-item counting happens as items actually decode. */
function claim(cursor: Cursor, count: number, remaining: number): void {
  if (count > remaining) fail();
  if (cursor.items + count > MAX_ITEMS) fail();
}

// ---------------------------------------------------------------- CBOR

/** IEEE 754 half-precision → number (CBOR additional info 25). */
function halfToNumber(u16: number): number {
  const sign = u16 & 0x8000 ? -1 : 1;
  const exp = (u16 >> 10) & 0x1f;
  const frac = u16 & 0x3ff;
  if (exp === 0) return sign * frac * 2 ** -24;
  if (exp === 31) return frac !== 0 ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * (1024 + frac) * 2 ** (exp - 25);
}

function decodeCbor(bytes: Uint8Array): unknown {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cursor: Cursor = { pos: 0, items: 0 };

  const need = (n: number): number => {
    if (cursor.pos + n > bytes.length) fail();
    const at = cursor.pos;
    cursor.pos += n;
    return at;
  };

  /** The argument of a data item head — `null` for indefinite length. */
  const readArgument = (info: number): bigint | null => {
    if (info < 24) return BigInt(info);
    if (info === 24) return BigInt(bytes[need(1)]);
    if (info === 25) return BigInt(view.getUint16(need(2)));
    if (info === 26) return BigInt(view.getUint32(need(4)));
    if (info === 27) return view.getBigUint64(need(8));
    if (info === 31) return null;
    return fail();
  };

  const readDefiniteLength = (info: number): number => {
    const arg = readArgument(info);
    if (arg === null || arg > BigInt(bytes.length)) fail();
    return Number(arg);
  };

  /** One string of major type `major` (2 bytes / 3 text), definite or
   *  indefinite (chunks of the same major, definite-length, `break`
   *  terminated) — returned raw; the caller decides bytes vs text. */
  const readStringBytes = (major: number, info: number): Uint8Array => {
    if (info !== 31) {
      const length = readDefiniteLength(info);
      const at = need(length);
      return bytes.subarray(at, at + length);
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const initial = bytes[need(1)];
      if (initial === 0xff) break;
      if (initial >> 5 !== major || (initial & 0x1f) === 31) fail();
      const length = readDefiniteLength(initial & 0x1f);
      const at = need(length);
      chunks.push(bytes.subarray(at, at + length));
      total += length;
    }
    const joined = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
      joined.set(chunk, at);
      at += chunk.length;
    }
    return joined;
  };

  const readItem = (depth: number): unknown => {
    if (depth > MAX_DEPTH) fail();
    cursor.items++;
    if (cursor.items > MAX_ITEMS) fail();
    const initial = bytes[need(1)];
    const major = initial >> 5;
    const info = initial & 0x1f;
    switch (major) {
      case 0: {
        const arg = readArgument(info);
        if (arg === null) fail();
        return intValue(arg as bigint);
      }
      case 1: {
        const arg = readArgument(info);
        if (arg === null) fail();
        return intValue(-1n - (arg as bigint));
      }
      case 2:
        return bytesDiagnostic(readStringBytes(2, info));
      case 3:
        return UTF8_STRICT.decode(readStringBytes(3, info));
      case 4: {
        const arr: unknown[] = [];
        if (info === 31) {
          while (true) {
            if (cursor.pos >= bytes.length) fail();
            if (bytes[cursor.pos] === 0xff) {
              cursor.pos++;
              return arr;
            }
            arr.push(readItem(depth + 1));
          }
        }
        const length = readDefiniteLength(info);
        claim(cursor, length, bytes.length - cursor.pos);
        for (let i = 0; i < length; i++) arr.push(readItem(depth + 1));
        return arr;
      }
      case 5: {
        const obj: Record<string, unknown> = {};
        const readPair = () => {
          const key = keyOf(readItem(depth + 1));
          obj[key] = readItem(depth + 1);
        };
        if (info === 31) {
          while (true) {
            if (cursor.pos >= bytes.length) fail();
            if (bytes[cursor.pos] === 0xff) {
              cursor.pos++;
              return obj;
            }
            readPair();
          }
        }
        const length = readDefiniteLength(info);
        claim(cursor, length, bytes.length - cursor.pos);
        for (let i = 0; i < length; i++) readPair();
        return obj;
      }
      case 6: {
        const arg = readArgument(info);
        if (arg === null) fail();
        const tag = arg as bigint;
        // Tags 2/3 are the standard bignum carriers — their byte-string
        // content IS an integer; decode it to the exact-display leaf
        // instead of a hex diagnostic.
        if (tag === 2n || tag === 3n) {
          const head = bytes[need(1)];
          if (head >> 5 !== 2) fail();
          const raw = readStringBytes(2, head & 0x1f);
          let magnitude = 0n;
          for (const byte of raw) magnitude = (magnitude << 8n) | BigInt(byte);
          return intValue(tag === 2n ? magnitude : -1n - magnitude);
        }
        const content = readItem(depth + 1);
        if (isPrimitiveLeaf(content)) return new DiagnosticText(`${tag}(${primitiveDiagnostic(content)})`);
        // Container content keeps its tree — the tag rides as the
        // single wrapping key, diagnostic-style.
        return { [`${tag}(…)`]: content };
      }
      default: {
        // Major 7 — simple values, floats, break.
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        if (info === 23) return new DiagnosticText('undefined');
        if (info < 20) return new DiagnosticText(`simple(${info})`);
        if (info === 24) {
          const simple = bytes[need(1)];
          if (simple < 32) fail(); // not well-formed per RFC 8949
          return new DiagnosticText(`simple(${simple})`);
        }
        if (info === 25) return halfToNumber(view.getUint16(need(2)));
        if (info === 26) return view.getFloat32(need(4));
        if (info === 27) return view.getFloat64(need(8));
        // 28–30 reserved; 31 is a break with no open container.
        return fail();
      }
    }
  };

  const value = readItem(0);
  if (cursor.pos !== bytes.length) fail();
  return value;
}

// ------------------------------------------------------------ Protobuf

/** Highest legal protobuf field number (2^29 − 1) — the tag varint
 *  reserves 3 bits for the wire type. */
const FIELD_NUMBER_MAX = 536870911;

/** Both readings of a fixed 64-bit word — schema-less can't know
 *  whether the field is a fixed64/sfixed64 or a double, so the
 *  diagnostic shows the unsigned integer and, when finite, the double. */
function fixed64Diagnostic(view: DataView, at: number): DiagnosticText {
  const word = view.getBigUint64(at, true);
  const asDouble = view.getFloat64(at, true);
  return new DiagnosticText(Number.isFinite(asDouble) ? `fixed64(${word}, double ${asDouble})` : `fixed64(${word})`);
}

/** Both readings of a fixed 32-bit word — see {@link fixed64Diagnostic}. */
function fixed32Diagnostic(view: DataView, at: number): DiagnosticText {
  const word = view.getUint32(at, true);
  const asFloat = view.getFloat32(at, true);
  return new DiagnosticText(Number.isFinite(asFloat) ? `fixed32(${word}, float ${asFloat})` : `fixed32(${word})`);
}

/**
 * A length-delimited payload's display value — the structural guess
 * ladder, in locked order: the bytes parse as a protobuf message → a
 * nested tree; valid UTF-8 → text; anything else → `h'…'` bytes. The
 * item budget is shared with the caller, so a failed guess's work
 * still counts against the hostile-input ceiling.
 */
function lengthDelimitedValue(payload: Uint8Array, budget: Cursor, depth: number): unknown {
  if (payload.length > 0) {
    try {
      return parseProtobufMessage(payload, budget, depth + 1);
    } catch {
      // Not a message — fall through the ladder.
    }
  }
  try {
    return UTF8_STRICT.decode(payload);
  } catch {
    return bytesDiagnostic(payload);
  }
}

/**
 * Parse one protobuf message covering EXACTLY the given bytes —
 * throws on anything malformed (invalid wire types, field number out
 * of range, truncated values, the deprecated group wire types).
 * Fields keyed by field number; a number seen more than once collects
 * into an array (repeated fields). Varints ride the F3 exact-display
 * law; fixed words show both readings; length-delimited payloads run
 * the guess ladder above.
 */
function parseProtobufMessage(bytes: Uint8Array, budget: Cursor, depth: number): Record<string, unknown> {
  if (depth > MAX_DEPTH) fail();
  if (bytes.length === 0) fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;

  const need = (n: number): number => {
    if (pos + n > bytes.length) fail();
    const at = pos;
    pos += n;
    return at;
  };

  /** Base-128 varint, 10 bytes max (the 64-bit ceiling). */
  const readVarint = (): bigint => {
    let value = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
      const byte = bytes[need(1)];
      value |= BigInt(byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) return value;
      shift += 7n;
    }
    return fail();
  };

  const fields = new Map<number, unknown[]>();
  while (pos < bytes.length) {
    budget.items++;
    if (budget.items > MAX_ITEMS) fail();
    const tag = readVarint();
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 7n);
    if (fieldNumber < 1 || fieldNumber > FIELD_NUMBER_MAX) fail();
    let value: unknown;
    switch (wireType) {
      case 0:
        value = intValue(readVarint());
        break;
      case 1:
        value = fixed64Diagnostic(view, need(8));
        break;
      case 5:
        value = fixed32Diagnostic(view, need(4));
        break;
      case 2: {
        const length = Number(readVarint());
        if (length > bytes.length - pos) fail();
        const at = need(length);
        value = lengthDelimitedValue(bytes.subarray(at, at + length), budget, depth);
        break;
      }
      default:
        // 3/4 are the deprecated group delimiters, 6/7 are unassigned.
        return fail();
    }
    const seen = fields.get(fieldNumber);
    if (seen === undefined) {
      fields.set(fieldNumber, [value]);
    } else {
      seen.push(value);
    }
  }
  if (fields.size === 0) fail();
  const obj: Record<string, unknown> = {};
  for (const [fieldNumber, values] of fields) obj[String(fieldNumber)] = values.length === 1 ? values[0] : values;
  return obj;
}

function decodeProtobuf(bytes: Uint8Array): unknown {
  return parseProtobufMessage(bytes, { pos: 0, items: 0 }, 0);
}

/**
 * gRPC message framing: each frame is 1 flag byte + a 4-byte
 * big-endian length + the payload. Flag 0 payloads run the protobuf
 * guess ladder (so `grpc+json` frames still show as text); flag 1
 * (compressed) doesn't decode without the codec — it degrades to a
 * `compressed(N bytes)` diagnostic; flag 0x80 is grpc-web's in-body
 * trailers frame — HTTP field lines, shown as text. A single frame
 * IS the preview value; multiple frames list in arrival order.
 */
function decodeGrpc(bytes: Uint8Array): unknown {
  if (bytes.length === 0) fail();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const budget: Cursor = { pos: 0, items: 0 };
  const frames: unknown[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    if (pos + 5 > bytes.length) fail();
    const flag = bytes[pos];
    const length = view.getUint32(pos + 1);
    pos += 5;
    if (length > bytes.length - pos) fail();
    const payload = bytes.subarray(pos, pos + length);
    pos += length;
    budget.items++;
    if (budget.items > MAX_ITEMS) fail();
    if (flag === 0x80) {
      frames.push({ trailers: UTF8_STRICT.decode(payload) });
    } else if (flag === 1) {
      frames.push(new DiagnosticText(`compressed(${length} bytes)`));
    } else if (flag === 0) {
      frames.push(lengthDelimitedValue(payload, budget, 0));
    } else {
      fail();
    }
  }
  return frames.length === 1 ? frames[0] : frames;
}

// --------------------------------------------------------- MessagePack

function decodeMessagePack(bytes: Uint8Array): unknown {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cursor: Cursor = { pos: 0, items: 0 };

  const need = (n: number): number => {
    if (cursor.pos + n > bytes.length) fail();
    const at = cursor.pos;
    cursor.pos += n;
    return at;
  };

  const readRaw = (length: number): Uint8Array => {
    const at = need(length);
    return bytes.subarray(at, at + length);
  };

  const readString = (length: number): string => UTF8_STRICT.decode(readRaw(length));

  const extDiagnostic = (type: number, payload: Uint8Array): DiagnosticText => {
    const inner = bytesDiagnostic(payload);
    return new DiagnosticText(`ext(${type}, ${inner.text})`);
  };

  const readArray = (length: number, depth: number): unknown[] => {
    claim(cursor, length, bytes.length - cursor.pos);
    cursor.items -= length;
    const arr: unknown[] = [];
    for (let i = 0; i < length; i++) arr.push(readItem(depth + 1));
    return arr;
  };

  const readMap = (length: number, depth: number): Record<string, unknown> => {
    claim(cursor, length, bytes.length - cursor.pos);
    cursor.items -= length;
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < length; i++) {
      const key = keyOf(readItem(depth + 1));
      obj[key] = readItem(depth + 1);
    }
    return obj;
  };

  const readItem = (depth: number): unknown => {
    if (depth > MAX_DEPTH) fail();
    cursor.items++;
    if (cursor.items > MAX_ITEMS) fail();
    const head = bytes[need(1)];
    if (head <= 0x7f) return head; // positive fixint
    if (head >= 0xe0) return head - 0x100; // negative fixint
    if (head >= 0x80 && head <= 0x8f) return readMap(head & 0x0f, depth);
    if (head >= 0x90 && head <= 0x9f) return readArray(head & 0x0f, depth);
    if (head >= 0xa0 && head <= 0xbf) return readString(head & 0x1f);
    switch (head) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xc4:
        return bytesDiagnostic(readRaw(bytes[need(1)]));
      case 0xc5:
        return bytesDiagnostic(readRaw(view.getUint16(need(2))));
      case 0xc6:
        return bytesDiagnostic(readRaw(view.getUint32(need(4))));
      case 0xc7: {
        const length = bytes[need(1)];
        return extDiagnostic(view.getInt8(need(1)), readRaw(length));
      }
      case 0xc8: {
        const length = view.getUint16(need(2));
        return extDiagnostic(view.getInt8(need(1)), readRaw(length));
      }
      case 0xc9: {
        const length = view.getUint32(need(4));
        return extDiagnostic(view.getInt8(need(1)), readRaw(length));
      }
      case 0xca:
        return view.getFloat32(need(4));
      case 0xcb:
        return view.getFloat64(need(8));
      case 0xcc:
        return bytes[need(1)];
      case 0xcd:
        return view.getUint16(need(2));
      case 0xce:
        return view.getUint32(need(4));
      case 0xcf:
        return intValue(view.getBigUint64(need(8)));
      case 0xd0:
        return view.getInt8(need(1));
      case 0xd1:
        return view.getInt16(need(2));
      case 0xd2:
        return view.getInt32(need(4));
      case 0xd3:
        return intValue(view.getBigInt64(need(8)));
      case 0xd4:
        return extDiagnostic(view.getInt8(need(1)), readRaw(1));
      case 0xd5:
        return extDiagnostic(view.getInt8(need(1)), readRaw(2));
      case 0xd6:
        return extDiagnostic(view.getInt8(need(1)), readRaw(4));
      case 0xd7:
        return extDiagnostic(view.getInt8(need(1)), readRaw(8));
      case 0xd8:
        return extDiagnostic(view.getInt8(need(1)), readRaw(16));
      case 0xd9:
        return readString(bytes[need(1)]);
      case 0xda:
        return readString(view.getUint16(need(2)));
      case 0xdb:
        return readString(view.getUint32(need(4)));
      case 0xdc:
        return readArray(view.getUint16(need(2)), depth);
      case 0xdd:
        return readArray(view.getUint32(need(4)), depth);
      case 0xde:
        return readMap(view.getUint16(need(2)), depth);
      case 0xdf:
        return readMap(view.getUint32(need(4)), depth);
      default:
        // 0xc1 — the one head byte the format reserves as never-used.
        return fail();
    }
  };

  const value = readItem(0);
  if (cursor.pos !== bytes.length) fail();
  return value;
}
