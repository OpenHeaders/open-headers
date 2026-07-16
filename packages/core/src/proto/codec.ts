/**
 * Schema-driven protobuf codec — canonical protobuf JSON ⇄ wire bytes
 * over a `ProtoRegistry`. A NEW plane beside the display-only
 * structural decode in the response surfaces: this one knows the
 * schema, so fields carry names, enums carry value names, and the
 * well-known `google.protobuf` types speak their canonical JSON forms
 * (Timestamp as RFC 3339, Duration as `1.5s`, wrappers as bare
 * values, Struct/Value as plain JSON, Any as `@type`-tagged objects,
 * FieldMask as a comma-joined camelCase string).
 *
 * Contract highlights:
 * - 64-bit integers are strings both ways — exact end to end (F3).
 * - Decode retains unknown fields structurally under `$unknown`
 *   (field number → varints/fixed words as exact decimals,
 *   length-delimited payloads as base64) so nothing silently drops.
 * - Decode emits only wire-present fields; absent proto3 defaults
 *   stay absent (an honest view of what the bytes say).
 * - Encode rejects unknown JSON fields, double-set oneof arms, and
 *   unresolved-type fields with a clear error (compose-side honesty);
 *   `null` means absent (skipped), except for `google.protobuf.Value`
 *   where null is a value.
 * - Repeated scalar/enum fields encode packed (proto3 default) and
 *   decode both packed and expanded forms.
 */

import { decodeBase64Bytes, encodeBase64Bytes } from '../utils/base64';
import {
  jsonNameOf,
  type ProtoMapKeyType,
  type ProtoRegistry,
  type ProtoScalarType,
  type RegistryField,
  type RegistryMessage,
} from './registry';
import { ProtoCodecError, ProtoReader, type ProtoWireType, ProtoWriter, zigzagDecode64, zigzagEncode64 } from './wire';

/** A JSON-shaped value tree — what decode produces and what the
 *  message composer hands to encode. */
export type ProtoJsonValue = null | boolean | number | string | ProtoJsonValue[] | { [key: string]: ProtoJsonValue };

type ProtoJsonObject = { [key: string]: ProtoJsonValue };

/** Reserved output key for structurally-retained unknown fields —
 *  proto field names cannot contain `$`, so it never collides. */
export const PROTO_UNKNOWN_FIELDS_KEY = '$unknown';

/** Nesting ceiling — hostile recursion must not blow the stack. */
const MAX_DEPTH = 100;

const UTF8_ENCODER = new TextEncoder();
const UTF8_STRICT = new TextDecoder('utf-8', { fatal: true });

const TIMESTAMP = 'google.protobuf.Timestamp';
const DURATION = 'google.protobuf.Duration';
const STRUCT = 'google.protobuf.Struct';
const VALUE = 'google.protobuf.Value';
const LIST_VALUE = 'google.protobuf.ListValue';
const ANY = 'google.protobuf.Any';
const FIELD_MASK = 'google.protobuf.FieldMask';

/** Wrapper messages whose JSON form is the bare inner value. */
const WRAPPER_SCALARS: ReadonlyMap<string, ProtoScalarType> = new Map([
  ['google.protobuf.DoubleValue', 'double'],
  ['google.protobuf.FloatValue', 'float'],
  ['google.protobuf.Int64Value', 'int64'],
  ['google.protobuf.UInt64Value', 'uint64'],
  ['google.protobuf.Int32Value', 'int32'],
  ['google.protobuf.UInt32Value', 'uint32'],
  ['google.protobuf.BoolValue', 'bool'],
  ['google.protobuf.StringValue', 'string'],
  ['google.protobuf.BytesValue', 'bytes'],
]);

/** Well-knowns with a custom JSON form (`Empty` maps generically). */
export const PROTO_WELL_KNOWN_JSON: ReadonlySet<string> = new Set([
  TIMESTAMP,
  DURATION,
  STRUCT,
  VALUE,
  LIST_VALUE,
  ANY,
  FIELD_MASK,
  ...WRAPPER_SCALARS.keys(),
]);

const TIMESTAMP_MIN_SECONDS = -62135596800n; // 0001-01-01T00:00:00Z
const TIMESTAMP_MAX_SECONDS = 253402300799n; // 9999-12-31T23:59:59Z
const DURATION_MAX_SECONDS = 315576000000n;

const INT32_MIN = -2147483648n;
const INT32_MAX = 2147483647n;
const UINT32_MAX = 4294967295n;
const INT64_MIN = -(2n ** 63n);
const INT64_MAX = 2n ** 63n - 1n;
const UINT64_MAX = 2n ** 64n - 1n;

const INTEGER_TEXT = /^-?\d+$/;

// ── Shared helpers ─────────────────────────────────────────────────

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireMessage(registry: ProtoRegistry, fullName: string): RegistryMessage {
  const message = registry.messages.get(fullName);
  if (message === undefined) throw new ProtoCodecError(`Unknown message type \`${fullName}\`.`);
  return message;
}

function wireTypeOfScalar(scalar: ProtoScalarType): ProtoWireType {
  switch (scalar) {
    case 'int32':
    case 'int64':
    case 'uint32':
    case 'uint64':
    case 'sint32':
    case 'sint64':
    case 'bool':
      return 0;
    case 'fixed64':
    case 'sfixed64':
    case 'double':
      return 1;
    case 'fixed32':
    case 'sfixed32':
    case 'float':
      return 5;
    case 'string':
    case 'bytes':
      return 2;
  }
}

/** Packed-eligible: every scalar except the length-delimited pair. */
function isPackable(field: RegistryField): boolean {
  if (field.type.kind === 'enum') return true;
  return field.type.kind === 'scalar' && wireTypeOfScalar(field.type.scalar) !== 2;
}

function floatToJson(value: number): ProtoJsonValue {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  return value;
}

function scalarDefaultJson(scalar: ProtoScalarType): ProtoJsonValue {
  switch (scalar) {
    case 'int64':
    case 'uint64':
    case 'sint64':
    case 'fixed64':
    case 'sfixed64':
      return '0';
    case 'bool':
      return false;
    case 'string':
    case 'bytes':
      return '';
    default:
      return 0;
  }
}

function enumDefaultJson(registry: ProtoRegistry, enumFullName: string): ProtoJsonValue {
  return registry.enums.get(enumFullName)?.numberToName.get(0) ?? 0;
}

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const joined = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    joined.set(chunk, at);
    at += chunk.length;
  }
  return joined;
}

function camelToSnake(value: string): string {
  let out = '';
  for (const ch of value) {
    out += ch >= 'A' && ch <= 'Z' ? `_${ch.toLowerCase()}` : ch;
  }
  return out;
}

/** Fractional-second suffix at 3/6/9 digits, per canonical JSON. */
function nanosSuffix(nanos: number): string {
  if (nanos === 0) return '';
  const digits = String(nanos).padStart(9, '0');
  if (nanos % 1_000_000 === 0) return `.${digits.slice(0, 3)}`;
  if (nanos % 1_000 === 0) return `.${digits.slice(0, 6)}`;
  return `.${digits}`;
}

// ── Decode: wire bytes → JSON value tree ───────────────────────────

/** Decode one message's wire bytes to its canonical-JSON value tree.
 *  Throws `ProtoCodecError` on malformed bytes or an unknown type. */
export function decodeMessage(registry: ProtoRegistry, messageFullName: string, bytes: Uint8Array): ProtoJsonValue {
  return decodeMessageValue(registry, messageFullName, bytes, 0);
}

function decodeMessageValue(
  registry: ProtoRegistry,
  fullName: string,
  bytes: Uint8Array,
  depth: number,
): ProtoJsonValue {
  if (depth > MAX_DEPTH) throw new ProtoCodecError('Message nesting exceeds the depth ceiling.');
  const message = requireMessage(registry, fullName);
  const generic = decodeGeneric(registry, message, bytes, depth);
  if (PROTO_WELL_KNOWN_JSON.has(fullName)) {
    // `null` is a legitimate transform result (an unset Value), so
    // membership gates the transform — not the returned value.
    return wellKnownToJson(registry, fullName, generic, depth) ?? null;
  }
  return generic;
}

/** An unknown or unresolved field's structural value by wire type. */
function readUnknownValue(reader: ProtoReader, wireType: number): ProtoJsonValue {
  switch (wireType) {
    case 0:
      return reader.varint().toString();
    case 1:
      return reader.fixed64().toString();
    case 5:
      return reader.fixed32();
    case 2:
      return encodeBase64Bytes(reader.lengthDelimited());
    default:
      throw new ProtoCodecError(`Unsupported wire type ${wireType}.`);
  }
}

function scalarFromWire(reader: ProtoReader, scalar: ProtoScalarType, wireType: number): ProtoJsonValue {
  if (wireType !== wireTypeOfScalar(scalar)) {
    throw new ProtoCodecError(`Wire type ${wireType} does not match a ${scalar} field.`);
  }
  switch (scalar) {
    case 'int32':
      return Number(BigInt.asIntN(32, reader.varint()));
    case 'uint32':
      return Number(BigInt.asUintN(32, reader.varint()));
    case 'sint32':
      return Number(zigzagDecode64(reader.varint()));
    case 'int64':
      return BigInt.asIntN(64, reader.varint()).toString();
    case 'uint64':
      return reader.varint().toString();
    case 'sint64':
      return zigzagDecode64(reader.varint()).toString();
    case 'bool':
      return reader.varint() !== 0n;
    case 'fixed32':
      return reader.fixed32();
    case 'sfixed32':
      return reader.sfixed32();
    case 'fixed64':
      return reader.fixed64().toString();
    case 'sfixed64':
      return reader.sfixed64().toString();
    case 'float':
      return floatToJson(reader.float());
    case 'double':
      return floatToJson(reader.double());
    case 'string': {
      const raw = reader.lengthDelimited();
      try {
        return UTF8_STRICT.decode(raw);
      } catch {
        throw new ProtoCodecError('Invalid UTF-8 in string field.');
      }
    }
    case 'bytes':
      return encodeBase64Bytes(reader.lengthDelimited());
  }
}

function enumFromWire(
  registry: ProtoRegistry,
  enumFullName: string,
  reader: ProtoReader,
  wireType: number,
): ProtoJsonValue {
  if (wireType !== 0) throw new ProtoCodecError(`Wire type ${wireType} does not match an enum field.`);
  const number = Number(BigInt.asIntN(64, reader.varint()));
  return registry.enums.get(enumFullName)?.numberToName.get(number) ?? number;
}

function mapKeyFromWire(reader: ProtoReader, keyType: ProtoMapKeyType, wireType: number): string {
  const value = scalarFromWire(reader, keyType, wireType);
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function decodeMapEntry(
  registry: ProtoRegistry,
  field: RegistryField,
  bytes: Uint8Array,
  depth: number,
): [string, ProtoJsonValue] {
  const keyType = field.mapKey;
  if (keyType === null) throw new ProtoCodecError('Not a map field.');
  const reader = new ProtoReader(bytes);
  let key: string | null = null;
  let scalarValue: ProtoJsonValue | null = null;
  let scalarSet = false;
  const valueChunks: Uint8Array[] = [];
  while (!reader.atEnd) {
    const tag = reader.varint();
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 7n);
    if (fieldNumber === 1) {
      key = mapKeyFromWire(reader, keyType, wireType);
    } else if (fieldNumber === 2) {
      if (field.type.kind === 'message') {
        if (wireType !== 2) throw new ProtoCodecError('Wire type of a message map value must be 2.');
        valueChunks.push(reader.lengthDelimited());
      } else if (field.type.kind === 'enum') {
        scalarValue = enumFromWire(registry, field.type.enum, reader, wireType);
        scalarSet = true;
      } else if (field.type.kind === 'scalar') {
        scalarValue = scalarFromWire(reader, field.type.scalar, wireType);
        scalarSet = true;
      }
    } else {
      readUnknownValue(reader, wireType);
    }
  }
  if (key === null) key = mapKeyFromWire(new ProtoReader(defaultKeyBytes(keyType)), keyType, wireTypeOfScalar(keyType));
  let value: ProtoJsonValue;
  if (field.type.kind === 'message') {
    value = decodeMessageValue(
      registry,
      field.type.message,
      concatChunks(valueChunks.length > 0 ? valueChunks : [new Uint8Array(0)]),
      depth + 1,
    );
  } else if (scalarSet && scalarValue !== null) {
    value = scalarValue;
  } else if (scalarSet) {
    value = null;
  } else if (field.type.kind === 'enum') {
    value = enumDefaultJson(registry, field.type.enum);
  } else if (field.type.kind === 'scalar') {
    value = scalarDefaultJson(field.type.scalar);
  } else {
    value = null;
  }
  return [key, value];
}

/** Wire bytes of a map key's default value (absent key field). */
function defaultKeyBytes(keyType: ProtoMapKeyType): Uint8Array {
  if (keyType === 'string') return Uint8Array.of(0);
  if (keyType === 'fixed64' || keyType === 'sfixed64') return new Uint8Array(8);
  if (keyType === 'fixed32' || keyType === 'sfixed32') return new Uint8Array(4);
  return Uint8Array.of(0);
}

function decodeGeneric(
  registry: ProtoRegistry,
  message: RegistryMessage,
  bytes: Uint8Array,
  depth: number,
): ProtoJsonObject {
  const reader = new ProtoReader(bytes);
  const arrays = new Map<number, ProtoJsonValue[]>();
  const maps = new Map<number, ProtoJsonObject>();
  const chunks = new Map<number, Uint8Array[]>();
  const scalars = new Map<number, ProtoJsonValue>();
  const unresolvedAcc = new Map<number, ProtoJsonValue[]>();
  const unknown = new Map<number, ProtoJsonValue[]>();
  const oneofArm = new Map<string, number>();

  const noteOneof = (field: RegistryField): void => {
    if (field.oneofName === null) return;
    const previous = oneofArm.get(field.oneofName);
    if (previous !== undefined && previous !== field.number) {
      scalars.delete(previous);
      chunks.delete(previous);
    }
    oneofArm.set(field.oneofName, field.number);
  };

  const pushInto = (store: Map<number, ProtoJsonValue[]>, key: number, value: ProtoJsonValue): void => {
    const existing = store.get(key);
    if (existing === undefined) store.set(key, [value]);
    else existing.push(value);
  };

  while (!reader.atEnd) {
    const tag = reader.varint();
    const fieldNumber = Number(tag >> 3n);
    const wireType = Number(tag & 7n);
    if (fieldNumber < 1) throw new ProtoCodecError('Invalid field number 0.');
    const field = message.fieldsByNumber.get(fieldNumber);
    if (field === undefined) {
      pushInto(unknown, fieldNumber, readUnknownValue(reader, wireType));
      continue;
    }
    if (field.type.kind === 'unresolved') {
      pushInto(unresolvedAcc, fieldNumber, readUnknownValue(reader, wireType));
      continue;
    }
    if (field.mapKey !== null) {
      if (wireType !== 2)
        throw new ProtoCodecError(`Wire type ${wireType} does not match map field \`${field.name}\`.`);
      const [key, value] = decodeMapEntry(registry, field, reader.lengthDelimited(), depth);
      const entries = maps.get(fieldNumber);
      if (entries === undefined) maps.set(fieldNumber, { [key]: value });
      else entries[key] = value;
      continue;
    }
    if (field.repeated) {
      if (field.type.kind === 'message') {
        if (wireType !== 2)
          throw new ProtoCodecError(`Wire type ${wireType} does not match message field \`${field.name}\`.`);
        pushInto(
          arrays,
          fieldNumber,
          decodeMessageValue(registry, field.type.message, reader.lengthDelimited(), depth + 1),
        );
        continue;
      }
      if (wireType === 2 && isPackable(field)) {
        const packed = new ProtoReader(reader.lengthDelimited());
        while (!packed.atEnd) {
          const element =
            field.type.kind === 'enum'
              ? enumFromWire(registry, field.type.enum, packed, 0)
              : scalarFromWire(packed, field.type.scalar, wireTypeOfScalar(field.type.scalar));
          pushInto(arrays, fieldNumber, element);
        }
        continue;
      }
      const element =
        field.type.kind === 'enum'
          ? enumFromWire(registry, field.type.enum, reader, wireType)
          : scalarFromWire(reader, field.type.scalar, wireType);
      pushInto(arrays, fieldNumber, element);
      continue;
    }
    noteOneof(field);
    if (field.type.kind === 'message') {
      if (wireType !== 2)
        throw new ProtoCodecError(`Wire type ${wireType} does not match message field \`${field.name}\`.`);
      // Singular message occurrences MERGE per proto semantics —
      // chunk bytes concatenate, then decode once at assembly.
      const list = chunks.get(fieldNumber);
      if (list === undefined) chunks.set(fieldNumber, [reader.lengthDelimited()]);
      else list.push(reader.lengthDelimited());
      continue;
    }
    const value =
      field.type.kind === 'enum'
        ? enumFromWire(registry, field.type.enum, reader, wireType)
        : scalarFromWire(reader, field.type.scalar, wireType);
    scalars.set(fieldNumber, value);
  }

  const out: ProtoJsonObject = {};
  for (const field of message.fields) {
    const n = field.number;
    const unresolvedValues = unresolvedAcc.get(n);
    if (unresolvedValues !== undefined) {
      out[field.jsonName] = unresolvedValues.length === 1 ? unresolvedValues[0] : unresolvedValues;
      continue;
    }
    const mapValue = maps.get(n);
    if (mapValue !== undefined) {
      out[field.jsonName] = mapValue;
      continue;
    }
    const arrayValue = arrays.get(n);
    if (arrayValue !== undefined) {
      out[field.jsonName] = arrayValue;
      continue;
    }
    const chunkValue = chunks.get(n);
    if (chunkValue !== undefined && field.type.kind === 'message') {
      out[field.jsonName] = decodeMessageValue(registry, field.type.message, concatChunks(chunkValue), depth + 1);
      continue;
    }
    const scalarValue = scalars.get(n);
    if (scalarValue !== undefined) out[field.jsonName] = scalarValue;
  }
  if (unknown.size > 0) {
    const retained: ProtoJsonObject = {};
    for (const n of [...unknown.keys()].sort((a, b) => a - b)) {
      const values = unknown.get(n);
      if (values !== undefined) retained[String(n)] = values.length === 1 ? values[0] : values;
    }
    out[PROTO_UNKNOWN_FIELDS_KEY] = retained;
  }
  return out;
}

// ── Well-known JSON forms (decode side) ────────────────────────────

function genericInt64(generic: ProtoJsonObject, key: string): bigint {
  const value = generic[key];
  return typeof value === 'string' && INTEGER_TEXT.test(value) ? BigInt(value) : 0n;
}

function genericInt32(generic: ProtoJsonObject, key: string): number {
  const value = generic[key];
  return typeof value === 'number' ? value : 0;
}

function timestampGenericToJson(generic: ProtoJsonObject): string {
  const seconds = genericInt64(generic, 'seconds');
  const nanos = genericInt32(generic, 'nanos');
  if (seconds < TIMESTAMP_MIN_SECONDS || seconds > TIMESTAMP_MAX_SECONDS) {
    throw new ProtoCodecError('Timestamp seconds out of range.');
  }
  if (nanos < 0 || nanos > 999_999_999) throw new ProtoCodecError('Timestamp nanos out of range.');
  const iso = new Date(Number(seconds) * 1000).toISOString();
  return `${iso.slice(0, 19)}${nanosSuffix(nanos)}Z`;
}

function durationGenericToJson(generic: ProtoJsonObject): string {
  const seconds = genericInt64(generic, 'seconds');
  const nanos = genericInt32(generic, 'nanos');
  if (seconds < -DURATION_MAX_SECONDS || seconds > DURATION_MAX_SECONDS) {
    throw new ProtoCodecError('Duration seconds out of range.');
  }
  if (Math.abs(nanos) > 999_999_999) throw new ProtoCodecError('Duration nanos out of range.');
  if ((seconds > 0n && nanos < 0) || (seconds < 0n && nanos > 0)) {
    throw new ProtoCodecError('Duration seconds and nanos disagree in sign.');
  }
  const negative = seconds < 0n || nanos < 0;
  const absSeconds = seconds < 0n ? -seconds : seconds;
  return `${negative ? '-' : ''}${absSeconds}${nanosSuffix(Math.abs(nanos))}s`;
}

function anyGenericToJson(registry: ProtoRegistry, generic: ProtoJsonObject, depth: number): ProtoJsonValue {
  const typeUrl = typeof generic.typeUrl === 'string' ? generic.typeUrl : '';
  const encoded = typeof generic.value === 'string' ? generic.value : '';
  if (typeUrl === '') return {};
  const typeName = typeUrl.slice(typeUrl.lastIndexOf('/') + 1);
  if (!registry.messages.has(typeName)) return { '@type': typeUrl, value: encoded };
  const bytes = decodeBase64Bytes(encoded) ?? new Uint8Array(0);
  const inner = decodeMessageValue(registry, typeName, bytes, depth + 1);
  if (PROTO_WELL_KNOWN_JSON.has(typeName)) return { '@type': typeUrl, value: inner };
  const out: ProtoJsonObject = { '@type': typeUrl };
  if (isJsonObject(inner)) {
    for (const [key, value] of Object.entries(inner)) out[key] = value;
  }
  return out;
}

function wellKnownToJson(
  registry: ProtoRegistry,
  fullName: string,
  generic: ProtoJsonObject,
  depth: number,
): ProtoJsonValue | undefined {
  const wrapperScalar = WRAPPER_SCALARS.get(fullName);
  if (wrapperScalar !== undefined) {
    return 'value' in generic ? generic.value : scalarDefaultJson(wrapperScalar);
  }
  switch (fullName) {
    case TIMESTAMP:
      return timestampGenericToJson(generic);
    case DURATION:
      return durationGenericToJson(generic);
    case STRUCT:
      return isJsonObject(generic.fields) ? generic.fields : {};
    case LIST_VALUE:
      return Array.isArray(generic.values) ? generic.values : [];
    case VALUE: {
      if ('nullValue' in generic) return null;
      if ('numberValue' in generic) return generic.numberValue;
      if ('stringValue' in generic) return generic.stringValue;
      if ('boolValue' in generic) return generic.boolValue;
      if ('structValue' in generic) return generic.structValue;
      if ('listValue' in generic) return generic.listValue;
      return null;
    }
    case FIELD_MASK: {
      const paths = Array.isArray(generic.paths) ? generic.paths : [];
      return paths.map((path) => (typeof path === 'string' ? jsonNameOf(path) : '')).join(',');
    }
    case ANY:
      return anyGenericToJson(registry, generic, depth);
    default:
      return undefined;
  }
}

// ── Encode: JSON value tree → wire bytes ───────────────────────────

/** Encode a canonical-JSON value tree to one message's wire bytes.
 *  Throws `ProtoCodecError` (with the JSON path) on any mismatch —
 *  unknown fields, type errors, double-set oneofs, range overflows. */
export function encodeMessage(registry: ProtoRegistry, messageFullName: string, value: unknown): Uint8Array {
  return encodeMessageInto(registry, messageFullName, value, '$', 0);
}

function integerFromJson(value: unknown, min: bigint, max: bigint, what: string, path: string): bigint {
  let big: bigint;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ProtoCodecError(`Expected a whole-number ${what}, got \`${value}\`.`, path);
    }
    big = BigInt(value);
  } else if (typeof value === 'string' && INTEGER_TEXT.test(value)) {
    big = BigInt(value);
  } else {
    throw new ProtoCodecError(`Expected ${what} as a number or decimal string.`, path);
  }
  if (big < min || big > max) throw new ProtoCodecError(`Value \`${big}\` out of range for ${what}.`, path);
  return big;
}

function floatFromJson(value: unknown, path: string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value === 'NaN') return Number.NaN;
    if (value === 'Infinity') return Number.POSITIVE_INFINITY;
    if (value === '-Infinity') return Number.NEGATIVE_INFINITY;
    const parsed = Number(value);
    if (value.trim() !== '' && !Number.isNaN(parsed)) return parsed;
  }
  throw new ProtoCodecError('Expected a number.', path);
}

/** Write one scalar VALUE (no tag) — length-delimited types include
 *  their length prefix. Shared by singular, packed, and map-key
 *  paths (map keys arrive as their JSON-object key strings). */
function scalarToWire(writer: ProtoWriter, scalar: ProtoScalarType, value: unknown, path: string): void {
  switch (scalar) {
    case 'int32': {
      writer.varint(BigInt.asUintN(64, integerFromJson(value, INT32_MIN, INT32_MAX, 'int32', path)));
      return;
    }
    case 'uint32': {
      writer.varint(integerFromJson(value, 0n, UINT32_MAX, 'uint32', path));
      return;
    }
    case 'sint32': {
      writer.varint(zigzagEncode64(integerFromJson(value, INT32_MIN, INT32_MAX, 'sint32', path)));
      return;
    }
    case 'int64': {
      writer.varint(BigInt.asUintN(64, integerFromJson(value, INT64_MIN, INT64_MAX, 'int64', path)));
      return;
    }
    case 'uint64': {
      writer.varint(integerFromJson(value, 0n, UINT64_MAX, 'uint64', path));
      return;
    }
    case 'sint64': {
      writer.varint(zigzagEncode64(integerFromJson(value, INT64_MIN, INT64_MAX, 'sint64', path)));
      return;
    }
    case 'fixed32': {
      writer.fixed32(Number(integerFromJson(value, 0n, UINT32_MAX, 'fixed32', path)));
      return;
    }
    case 'sfixed32': {
      writer.sfixed32(Number(integerFromJson(value, INT32_MIN, INT32_MAX, 'sfixed32', path)));
      return;
    }
    case 'fixed64': {
      writer.fixed64(integerFromJson(value, 0n, UINT64_MAX, 'fixed64', path));
      return;
    }
    case 'sfixed64': {
      writer.sfixed64(integerFromJson(value, INT64_MIN, INT64_MAX, 'sfixed64', path));
      return;
    }
    case 'bool': {
      if (typeof value !== 'boolean') throw new ProtoCodecError('Expected a boolean.', path);
      writer.varint(value ? 1n : 0n);
      return;
    }
    case 'float': {
      writer.float(Math.fround(floatFromJson(value, path)));
      return;
    }
    case 'double': {
      writer.double(floatFromJson(value, path));
      return;
    }
    case 'string': {
      if (typeof value !== 'string') throw new ProtoCodecError('Expected a string.', path);
      const encoded = UTF8_ENCODER.encode(value);
      writer.varintNumber(encoded.length);
      writer.raw(encoded);
      return;
    }
    case 'bytes': {
      if (typeof value !== 'string') throw new ProtoCodecError('Expected base64 bytes as a string.', path);
      const decoded = decodeBase64Bytes(value);
      if (decoded === null) throw new ProtoCodecError('Invalid base64 in bytes field.', path);
      writer.varintNumber(decoded.length);
      writer.raw(decoded);
      return;
    }
  }
}

function enumToNumber(registry: ProtoRegistry, enumFullName: string, value: unknown, path: string): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < Number(INT32_MIN) || value > Number(INT32_MAX)) {
      throw new ProtoCodecError(`Enum value \`${value}\` out of int32 range.`, path);
    }
    return value;
  }
  if (typeof value === 'string') {
    const number = registry.enums.get(enumFullName)?.nameToNumber.get(value);
    if (number === undefined) throw new ProtoCodecError(`Unknown enum value \`${value}\` for ${enumFullName}.`, path);
    return number;
  }
  throw new ProtoCodecError('Expected an enum value name or number.', path);
}

/** `null` is a VALUE only for `google.protobuf.Value`-typed slots;
 *  everywhere else it means absent. */
function allowsNull(field: RegistryField): boolean {
  return field.type.kind === 'message' && field.type.message === VALUE;
}

function mapKeyToWire(writer: ProtoWriter, keyType: ProtoMapKeyType, key: string, path: string): void {
  if (keyType === 'bool') {
    if (key !== 'true' && key !== 'false')
      throw new ProtoCodecError(`Expected \`true\`/\`false\` map key, got \`${key}\`.`, path);
    writer.varint(key === 'true' ? 1n : 0n);
    return;
  }
  scalarToWire(writer, keyType, key, path);
}

function encodeSingleInto(
  registry: ProtoRegistry,
  writer: ProtoWriter,
  field: RegistryField,
  value: unknown,
  path: string,
  depth: number,
): void {
  switch (field.type.kind) {
    case 'scalar': {
      writer.tag(field.number, wireTypeOfScalar(field.type.scalar));
      scalarToWire(writer, field.type.scalar, value, path);
      return;
    }
    case 'enum': {
      writer.tag(field.number, 0);
      writer.varint(BigInt.asUintN(64, BigInt(enumToNumber(registry, field.type.enum, value, path))));
      return;
    }
    case 'message': {
      const bytes = encodeMessageInto(registry, field.type.message, value, path, depth + 1);
      writer.tag(field.number, 2);
      writer.varintNumber(bytes.length);
      writer.raw(bytes);
      return;
    }
    case 'unresolved':
      throw new ProtoCodecError(`Field \`${field.name}\` has unresolved type \`${field.type.reference}\`.`, path);
  }
}

function encodeFieldInto(
  registry: ProtoRegistry,
  writer: ProtoWriter,
  field: RegistryField,
  value: unknown,
  path: string,
  depth: number,
): void {
  if (field.mapKey !== null) {
    if (!isJsonObject(value)) throw new ProtoCodecError(`Expected an object for map field \`${field.name}\`.`, path);
    for (const key of Object.keys(value)) {
      const entryPath = `${path}["${key}"]`;
      const entryValue = value[key];
      if (entryValue === null && !allowsNull(field)) {
        throw new ProtoCodecError('Map values cannot be null.', entryPath);
      }
      const entry = new ProtoWriter();
      entry.tag(1, wireTypeOfScalar(field.mapKey));
      mapKeyToWire(entry, field.mapKey, key, entryPath);
      const valueField: RegistryField = { ...field, number: 2, mapKey: null, repeated: false, oneofName: null };
      encodeSingleInto(registry, entry, valueField, entryValue, entryPath, depth);
      const bytes = entry.finish();
      writer.tag(field.number, 2);
      writer.varintNumber(bytes.length);
      writer.raw(bytes);
    }
    return;
  }
  if (field.repeated) {
    if (!Array.isArray(value))
      throw new ProtoCodecError(`Expected an array for repeated field \`${field.name}\`.`, path);
    if (value.length === 0) return;
    if (isPackable(field)) {
      const packed = new ProtoWriter();
      for (let i = 0; i < value.length; i++) {
        const elementPath = `${path}[${i}]`;
        if (field.type.kind === 'enum') {
          packed.varint(BigInt.asUintN(64, BigInt(enumToNumber(registry, field.type.enum, value[i], elementPath))));
        } else if (field.type.kind === 'scalar') {
          scalarToWire(packed, field.type.scalar, value[i], elementPath);
        }
      }
      const bytes = packed.finish();
      writer.tag(field.number, 2);
      writer.varintNumber(bytes.length);
      writer.raw(bytes);
      return;
    }
    for (let i = 0; i < value.length; i++) {
      const elementPath = `${path}[${i}]`;
      if (value[i] === null && !allowsNull(field)) {
        throw new ProtoCodecError('Repeated elements cannot be null.', elementPath);
      }
      encodeSingleInto(registry, writer, field, value[i], elementPath, depth);
    }
    return;
  }
  encodeSingleInto(registry, writer, field, value, path, depth);
}

function encodeGenericInto(
  registry: ProtoRegistry,
  message: RegistryMessage,
  value: unknown,
  path: string,
  depth: number,
): Uint8Array {
  if (!isJsonObject(value)) {
    throw new ProtoCodecError(`Expected an object for message ${message.fullName}.`, path);
  }
  const byKey = new Map<string, RegistryField>();
  for (const field of message.fields) {
    byKey.set(field.jsonName, field);
    byKey.set(field.name, field);
  }
  const present = new Map<number, { field: RegistryField; value: unknown }>();
  for (const key of Object.keys(value)) {
    const field = byKey.get(key);
    if (field === undefined) {
      throw new ProtoCodecError(`Unknown field \`${key}\` on ${message.fullName}.`, path);
    }
    if (present.has(field.number)) {
      throw new ProtoCodecError(`Field \`${field.name}\` specified more than once.`, path);
    }
    present.set(field.number, { field, value: value[key] });
  }
  const oneofSet = new Map<string, string>();
  for (const { field, value: fieldValue } of present.values()) {
    if (field.oneofName === null) continue;
    if (fieldValue === undefined || (fieldValue === null && !allowsNull(field))) continue;
    const previous = oneofSet.get(field.oneofName);
    if (previous !== undefined) {
      throw new ProtoCodecError(
        `Oneof \`${field.oneofName}\` has both \`${previous}\` and \`${field.name}\` set.`,
        path,
      );
    }
    oneofSet.set(field.oneofName, field.name);
  }
  const writer = new ProtoWriter();
  for (const field of message.fields) {
    const entry = present.get(field.number);
    if (entry === undefined) continue;
    if (entry.value === undefined) continue;
    if (entry.value === null && !allowsNull(field)) continue;
    encodeFieldInto(registry, writer, field, entry.value, `${path}.${field.jsonName}`, depth);
  }
  return writer.finish();
}

// ── Well-known JSON forms (encode side) ────────────────────────────

const TIMESTAMP_TEXT =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(?:[Zz]|([+-])(\d{2}):(\d{2}))$/;

function timestampJsonToGeneric(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'string') throw new ProtoCodecError('Expected an RFC 3339 timestamp string.', path);
  const match = TIMESTAMP_TEXT.exec(value);
  if (match === null) throw new ProtoCodecError(`Invalid RFC 3339 timestamp \`${value}\`.`, path);
  const [, y, mo, d, h, mi, s, frac, offSign, offH, offM] = match;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(s);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    throw new ProtoCodecError(`Invalid RFC 3339 timestamp \`${value}\`.`, path);
  }
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ProtoCodecError(`Invalid calendar date in timestamp \`${value}\`.`, path);
  }
  let seconds = BigInt(date.getTime()) / 1000n;
  if (offSign !== undefined) {
    const offset = BigInt((Number(offH) * 60 + Number(offM)) * 60);
    seconds = offSign === '+' ? seconds - offset : seconds + offset;
  }
  if (seconds < TIMESTAMP_MIN_SECONDS || seconds > TIMESTAMP_MAX_SECONDS) {
    throw new ProtoCodecError('Timestamp out of the representable range.', path);
  }
  const nanos = frac !== undefined ? Number(`${frac}000000000`.slice(0, 9)) : 0;
  return { seconds: seconds.toString(), nanos };
}

const DURATION_TEXT = /^(-)?(\d+)(?:\.(\d{1,9}))?s$/;

function durationJsonToGeneric(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'string') throw new ProtoCodecError('Expected a duration string like `1.5s`.', path);
  const match = DURATION_TEXT.exec(value);
  if (match === null) throw new ProtoCodecError(`Invalid duration \`${value}\`.`, path);
  const [, sign, whole, frac] = match;
  let seconds = BigInt(whole);
  let nanos = frac !== undefined ? Number(`${frac}000000000`.slice(0, 9)) : 0;
  if (seconds > DURATION_MAX_SECONDS) throw new ProtoCodecError('Duration out of the representable range.', path);
  if (sign !== undefined) {
    seconds = -seconds;
    nanos = -nanos;
  }
  return { seconds: seconds.toString(), nanos };
}

function fieldMaskJsonToGeneric(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'string') throw new ProtoCodecError('Expected a comma-joined field mask string.', path);
  const paths = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => camelToSnake(entry));
  return { paths };
}

function valueJsonToGeneric(value: unknown, path: string): Record<string, unknown> {
  if (value === null) return { nullValue: 0 };
  if (typeof value === 'number') return { numberValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { boolValue: value };
  if (Array.isArray(value)) return { listValue: value };
  if (isJsonObject(value)) return { structValue: value };
  throw new ProtoCodecError('Expected a JSON value.', path);
}

function anyJsonToGeneric(
  registry: ProtoRegistry,
  value: unknown,
  path: string,
  depth: number,
): Record<string, unknown> {
  if (!isJsonObject(value)) throw new ProtoCodecError('Expected an object for google.protobuf.Any.', path);
  const typeUrl = value['@type'];
  if (typeUrl === undefined) {
    const keys = Object.keys(value);
    if (keys.length > 0) throw new ProtoCodecError('google.protobuf.Any requires an `@type` field.', path);
    return {};
  }
  if (typeof typeUrl !== 'string' || typeUrl === '') {
    throw new ProtoCodecError('`@type` must be a non-empty type URL string.', path);
  }
  const typeName = typeUrl.slice(typeUrl.lastIndexOf('/') + 1);
  if (!registry.messages.has(typeName)) {
    const passthrough = value.value;
    if (typeof passthrough === 'string' && decodeBase64Bytes(passthrough) !== null) {
      return { typeUrl, value: passthrough };
    }
    throw new ProtoCodecError(`Unknown Any type \`${typeName}\` (provide base64 \`value\` to pass through).`, path);
  }
  let inner: unknown;
  if (PROTO_WELL_KNOWN_JSON.has(typeName)) {
    inner = value.value;
  } else {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value)) {
      if (key !== '@type') copy[key] = value[key];
    }
    inner = copy;
  }
  const bytes = encodeMessageInto(registry, typeName, inner, path, depth + 1);
  return { typeUrl, value: encodeBase64Bytes(bytes) };
}

function encodeMessageInto(
  registry: ProtoRegistry,
  fullName: string,
  value: unknown,
  path: string,
  depth: number,
): Uint8Array {
  if (depth > MAX_DEPTH) throw new ProtoCodecError('Message nesting exceeds the depth ceiling.', path);
  const message = requireMessage(registry, fullName);
  const wrapperScalar = WRAPPER_SCALARS.get(fullName);
  let generic: unknown = value;
  if (wrapperScalar !== undefined) generic = { value };
  else if (fullName === TIMESTAMP) generic = timestampJsonToGeneric(value, path);
  else if (fullName === DURATION) generic = durationJsonToGeneric(value, path);
  else if (fullName === FIELD_MASK) generic = fieldMaskJsonToGeneric(value, path);
  else if (fullName === VALUE) generic = valueJsonToGeneric(value, path);
  else if (fullName === LIST_VALUE) {
    if (!Array.isArray(value)) throw new ProtoCodecError('Expected an array for google.protobuf.ListValue.', path);
    generic = { values: value };
  } else if (fullName === STRUCT) {
    if (!isJsonObject(value)) throw new ProtoCodecError('Expected an object for google.protobuf.Struct.', path);
    generic = { fields: value };
  } else if (fullName === ANY) generic = anyJsonToGeneric(registry, value, path, depth);
  return encodeGenericInto(registry, message, generic, path, depth);
}
