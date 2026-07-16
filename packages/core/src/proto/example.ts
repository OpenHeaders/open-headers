/**
 * Example-message synthesis — a message type rendered as a
 * canonical-JSON example the composer can start from ("Use Example
 * Message"). Deterministic and always encodable: scalars take their
 * zero-ish values (64-bit integers as strings per the F3 exact
 * lane), repeated fields and maps carry one sample entry, each oneof
 * picks its first arm, enums take their first declared value, and
 * the well-known types show their canonical JSON forms. Recursive
 * message cycles cut to an empty object; unresolved fields are
 * omitted.
 */

import type { ProtoJsonValue } from './codec';
import type { ProtoMapKeyType, ProtoRegistry, ProtoScalarType, RegistryField } from './registry';
import { ProtoCodecError } from './wire';

const WELL_KNOWN_EXAMPLES: ReadonlyMap<string, ProtoJsonValue> = new Map<string, ProtoJsonValue>([
  ['google.protobuf.Timestamp', '2026-01-01T00:00:00Z'],
  ['google.protobuf.Duration', '1s'],
  ['google.protobuf.Struct', {}],
  ['google.protobuf.Value', null],
  ['google.protobuf.ListValue', []],
  ['google.protobuf.Empty', {}],
  ['google.protobuf.FieldMask', ''],
  ['google.protobuf.Any', {}],
  ['google.protobuf.DoubleValue', 0],
  ['google.protobuf.FloatValue', 0],
  ['google.protobuf.Int64Value', '0'],
  ['google.protobuf.UInt64Value', '0'],
  ['google.protobuf.Int32Value', 0],
  ['google.protobuf.UInt32Value', 0],
  ['google.protobuf.BoolValue', false],
  ['google.protobuf.StringValue', ''],
  ['google.protobuf.BytesValue', ''],
]);

function scalarSample(scalar: ProtoScalarType): ProtoJsonValue {
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

function mapKeySample(keyType: ProtoMapKeyType): string {
  if (keyType === 'string') return 'key';
  if (keyType === 'bool') return 'false';
  return '0';
}

/** Synthesize a canonical-JSON example for a message type. Throws
 *  `ProtoCodecError` when the type is not in the registry. */
export function synthesizeExampleMessage(registry: ProtoRegistry, messageFullName: string): ProtoJsonValue {
  return exampleForMessage(registry, messageFullName, new Set());
}

function exampleForMessage(registry: ProtoRegistry, fullName: string, stack: Set<string>): ProtoJsonValue {
  if (WELL_KNOWN_EXAMPLES.has(fullName)) return WELL_KNOWN_EXAMPLES.get(fullName) ?? null;
  const message = registry.messages.get(fullName);
  if (message === undefined) throw new ProtoCodecError(`Unknown message type \`${fullName}\`.`);
  if (stack.has(fullName)) return {};
  stack.add(fullName);
  const out: { [key: string]: ProtoJsonValue } = {};
  const seenOneofs = new Set<string>();
  for (const field of message.fields) {
    if (field.type.kind === 'unresolved') continue;
    if (field.oneofName !== null) {
      if (seenOneofs.has(field.oneofName)) continue;
      seenOneofs.add(field.oneofName);
    }
    const sample = fieldSample(registry, field, stack);
    if (field.mapKey !== null) {
      out[field.jsonName] = { [mapKeySample(field.mapKey)]: sample };
    } else if (field.repeated) {
      out[field.jsonName] = [sample];
    } else {
      out[field.jsonName] = sample;
    }
  }
  stack.delete(fullName);
  return out;
}

function fieldSample(registry: ProtoRegistry, field: RegistryField, stack: Set<string>): ProtoJsonValue {
  switch (field.type.kind) {
    case 'scalar':
      return scalarSample(field.type.scalar);
    case 'enum': {
      const entry = registry.enums.get(field.type.enum);
      return entry !== undefined && entry.values.length > 0 ? entry.values[0].name : 0;
    }
    case 'message':
      return exampleForMessage(registry, field.type.message, stack);
    case 'unresolved':
      return null;
  }
}
