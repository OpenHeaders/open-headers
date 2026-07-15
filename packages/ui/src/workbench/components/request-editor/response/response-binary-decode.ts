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
 * Values JSON cannot carry render in CBOR diagnostic notation, kept
 * consistent across both decoders: byte strings as `h'…'`, CBOR tags as
 * `tag(content)`, MessagePack extensions as `ext(type, h'…')`,
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

export type BinaryDecodeKind = 'cbor' | 'msgpack';

/** The decoder a response's Content-Type names — `application/cbor`
 *  and the MessagePack pair (`application/msgpack`, `…/x-msgpack`).
 *  Content-Type picks the RENDERER only (a preview to offer); whether
 *  the body is text or bytes stays decided by the bytes. `cbor-seq`
 *  is multi-item framing the single-item decoder does not cover. */
export function binaryDecodeKind(headers: ReadonlyArray<{ key: string; value: string }>): BinaryDecodeKind | null {
  const ct = contentTypeOf(headers);
  if (ct.includes('msgpack')) return 'msgpack';
  if (ct.includes('cbor') && !ct.includes('cbor-seq')) return 'cbor';
  return null;
}

/** Decode the captured wire bytes to a tree-previewable value — `null`
 *  on anything malformed (the caller offers no preview). Wrapped so a
 *  legitimately decoded `null` body stays distinguishable. One pass,
 *  strict: trailing bytes after the root item reject. */
export function decodeBinaryPreview(kind: BinaryDecodeKind, bytes: Uint8Array): { value: unknown } | null {
  try {
    return { value: kind === 'cbor' ? decodeCbor(bytes) : decodeMessagePack(bytes) };
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
