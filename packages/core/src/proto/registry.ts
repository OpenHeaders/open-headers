/**
 * Proto schema registry — a spec's parsed file set resolved into a
 * navigable type system. Message and enum full names index the whole
 * set; every field's written type reference resolves through the
 * proto scoping rules (innermost nesting scope outward to the root,
 * leading-dot references absolute); services resolve their rpc
 * request/response types the same way. The well-known
 * `google.protobuf` types are built in, so imports of
 * `google/protobuf/*.proto` resolve without files in the set.
 *
 * Resolution problems are REPORTED, never thrown — the registry
 * always builds, carrying an issue list the validation strip can
 * surface; unresolved fields stay in the schema as `unresolved` so
 * the codec can refuse them honestly at encode time.
 */

import { parseProto } from './parse';
import type { ProtoCensus, ProtoEnum, ProtoEnumValue, ProtoField, ProtoMessage, ProtoStreamingShape } from './types';

/** The fifteen protobuf scalar field types. */
export type ProtoScalarType =
  | 'double'
  | 'float'
  | 'int32'
  | 'int64'
  | 'uint32'
  | 'uint64'
  | 'sint32'
  | 'sint64'
  | 'fixed32'
  | 'fixed64'
  | 'sfixed32'
  | 'sfixed64'
  | 'bool'
  | 'string'
  | 'bytes';

const SCALAR_TYPES: ReadonlySet<string> = new Set([
  'double',
  'float',
  'int32',
  'int64',
  'uint32',
  'uint64',
  'sint32',
  'sint64',
  'fixed32',
  'fixed64',
  'sfixed32',
  'sfixed64',
  'bool',
  'string',
  'bytes',
]);

export function isProtoScalarType(value: string): value is ProtoScalarType {
  return SCALAR_TYPES.has(value);
}

/** Legal `map<key, …>` key types — integral, string, bool. */
export type ProtoMapKeyType = Exclude<ProtoScalarType, 'double' | 'float' | 'bytes'>;

const MAP_KEY_TYPES: ReadonlySet<string> = new Set([
  'int32',
  'int64',
  'uint32',
  'uint64',
  'sint32',
  'sint64',
  'fixed32',
  'fixed64',
  'sfixed32',
  'sfixed64',
  'bool',
  'string',
]);

export function isProtoMapKeyType(value: string): value is ProtoMapKeyType {
  return MAP_KEY_TYPES.has(value);
}

/** A field's resolved type — scalar, a registered message or enum by
 *  full name, or `unresolved` when the written reference matched
 *  nothing (reported as an issue; the codec refuses it on encode). */
export type RegistryFieldType =
  | { readonly kind: 'scalar'; readonly scalar: ProtoScalarType }
  | { readonly kind: 'message'; readonly message: string }
  | { readonly kind: 'enum'; readonly enum: string }
  | { readonly kind: 'unresolved'; readonly reference: string };

export interface RegistryField {
  readonly name: string;
  /** Proto JSON name — underscores dropped, following letter upper. */
  readonly jsonName: string;
  readonly number: number;
  readonly repeated: boolean;
  /** Explicit `optional` label (proto3 presence tracking). */
  readonly optional: boolean;
  /** Resolved type; for map fields this is the VALUE type. */
  readonly type: RegistryFieldType;
  /** Non-null marks a map field and holds its key type. */
  readonly mapKey: ProtoMapKeyType | null;
  readonly oneofName: string | null;
}

export interface RegistryMessage {
  readonly fullName: string;
  readonly fields: readonly RegistryField[];
  readonly fieldsByNumber: ReadonlyMap<number, RegistryField>;
  readonly oneofs: readonly string[];
}

export interface RegistryEnum {
  readonly fullName: string;
  /** Declaration order — synthesis samples the first value. */
  readonly values: readonly ProtoEnumValue[];
  readonly nameToNumber: ReadonlyMap<string, number>;
  /** First declared name wins for aliased numbers. */
  readonly numberToName: ReadonlyMap<number, string>;
}

export interface RegistryRpc {
  readonly name: string;
  readonly streaming: ProtoStreamingShape;
  /** Resolved request message full name; null when unresolved. */
  readonly inputType: string | null;
  /** Resolved response message full name; null when unresolved. */
  readonly outputType: string | null;
}

export interface RegistryService {
  readonly name: string;
  readonly fullName: string;
  readonly rpcs: readonly RegistryRpc[];
}

export type ProtoRegistryIssueKind = 'unresolved-type' | 'missing-import' | 'duplicate-name' | 'invalid-map-key';

export interface ProtoRegistryIssue {
  readonly kind: ProtoRegistryIssueKind;
  /** What went wrong with — a type reference as written, an import
   *  path, or a colliding full name. */
  readonly reference: string;
  /** Where — the declaring message/service full name, or the file
   *  path for import issues. */
  readonly scope: string;
}

/** One file of a spec's set — the path is what sibling `import`
 *  statements are matched against. */
export interface ProtoSourceFile {
  readonly path: string;
  readonly census: ProtoCensus;
}

export interface ProtoRegistry {
  readonly messages: ReadonlyMap<string, RegistryMessage>;
  readonly enums: ReadonlyMap<string, RegistryEnum>;
  readonly services: readonly RegistryService[];
  readonly issues: readonly ProtoRegistryIssue[];
}

/** Proto JSON name of a field: underscores removed, the letter after
 *  each underscore uppercased. The parser skips field options, so a
 *  `json_name` override is not visible — the derived name is used. */
export function jsonNameOf(name: string): string {
  let out = '';
  let upper = false;
  for (const ch of name) {
    if (ch === '_') {
      upper = true;
      continue;
    }
    out += upper ? ch.toUpperCase() : ch;
    upper = false;
  }
  return out;
}

/** The built-in well-known types — parsed once so imports of
 *  `google/protobuf/*.proto` resolve without files in the set. */
const WELL_KNOWN_SOURCE = `syntax = "proto3";
package google.protobuf;

message Timestamp { int64 seconds = 1; int32 nanos = 2; }
message Duration { int64 seconds = 1; int32 nanos = 2; }
message Empty {}
message FieldMask { repeated string paths = 1; }
message Struct { map<string, Value> fields = 1; }
message Value {
  oneof kind {
    NullValue null_value = 1;
    double number_value = 2;
    string string_value = 3;
    bool bool_value = 4;
    Struct struct_value = 5;
    ListValue list_value = 6;
  }
}
message ListValue { repeated Value values = 1; }
enum NullValue { NULL_VALUE = 0; }
message Any { string type_url = 1; bytes value = 2; }
message DoubleValue { double value = 1; }
message FloatValue { float value = 1; }
message Int64Value { int64 value = 1; }
message UInt64Value { uint64 value = 1; }
message Int32Value { int32 value = 1; }
message UInt32Value { uint32 value = 1; }
message BoolValue { bool value = 1; }
message StringValue { string value = 1; }
message BytesValue { bytes value = 1; }
`;

const WELL_KNOWN_CENSUS = parseProto(WELL_KNOWN_SOURCE);

const WELL_KNOWN_IMPORT_PREFIX = 'google/protobuf/';

/** Build a registry from a spec's parsed file set (plus the built-in
 *  well-known types). Never throws — problems land on `issues`. */
export function buildRegistry(files: readonly ProtoSourceFile[]): ProtoRegistry {
  const issues: ProtoRegistryIssue[] = [];
  const rawMessages = new Map<string, ProtoMessage>();
  const rawEnums = new Map<string, ProtoEnum>();

  const indexEnum = (entry: ProtoEnum, builtin: boolean): void => {
    if (rawMessages.has(entry.fullName) || rawEnums.has(entry.fullName)) {
      if (!builtin) issues.push({ kind: 'duplicate-name', reference: entry.fullName, scope: '' });
      return;
    }
    rawEnums.set(entry.fullName, entry);
  };

  const indexMessage = (message: ProtoMessage, builtin: boolean): void => {
    if (rawMessages.has(message.fullName) || rawEnums.has(message.fullName)) {
      if (!builtin) issues.push({ kind: 'duplicate-name', reference: message.fullName, scope: '' });
      return;
    }
    rawMessages.set(message.fullName, message);
    for (const nested of message.messages) indexMessage(nested, builtin);
    for (const nested of message.enums) indexEnum(nested, builtin);
  };

  for (const message of WELL_KNOWN_CENSUS.messages) indexMessage(message, true);
  for (const entry of WELL_KNOWN_CENSUS.enums) indexEnum(entry, true);
  for (const file of files) {
    for (const message of file.census.messages) indexMessage(message, false);
    for (const entry of file.census.enums) indexEnum(entry, false);
  }

  const paths = new Set(files.map((file) => file.path));
  for (const file of files) {
    for (const entry of file.census.imports) {
      if (!paths.has(entry.path) && !entry.path.startsWith(WELL_KNOWN_IMPORT_PREFIX)) {
        issues.push({ kind: 'missing-import', reference: entry.path, scope: file.path });
      }
    }
  }

  /** Written reference → registered full name, walking the nesting
   *  scopes innermost-out; a leading dot is absolute. */
  const resolveName = (reference: string, scope: string): string | null => {
    if (reference.startsWith('.')) {
      const absolute = reference.slice(1);
      return rawMessages.has(absolute) || rawEnums.has(absolute) ? absolute : null;
    }
    let prefix = scope;
    while (true) {
      const candidate = prefix === '' ? reference : `${prefix}.${reference}`;
      if (rawMessages.has(candidate) || rawEnums.has(candidate)) return candidate;
      if (prefix === '') return null;
      const dot = prefix.lastIndexOf('.');
      prefix = dot === -1 ? '' : prefix.slice(0, dot);
    }
  };

  const resolveFieldType = (reference: string, scope: string): RegistryFieldType => {
    if (isProtoScalarType(reference)) return { kind: 'scalar', scalar: reference };
    const resolved = resolveName(reference, scope);
    if (resolved === null) {
      issues.push({ kind: 'unresolved-type', reference, scope });
      return { kind: 'unresolved', reference };
    }
    if (rawEnums.has(resolved)) return { kind: 'enum', enum: resolved };
    return { kind: 'message', message: resolved };
  };

  const buildField = (field: ProtoField, scope: string): RegistryField => {
    let type: RegistryFieldType;
    let mapKey: ProtoMapKeyType | null = null;
    if (field.mapKeyType !== null && !isProtoMapKeyType(field.mapKeyType)) {
      issues.push({ kind: 'invalid-map-key', reference: `map<${field.mapKeyType}, ${field.type}>`, scope });
      type = { kind: 'unresolved', reference: `map<${field.mapKeyType}, ${field.type}>` };
    } else {
      type = resolveFieldType(field.type, scope);
      mapKey = field.mapKeyType !== null && isProtoMapKeyType(field.mapKeyType) ? field.mapKeyType : null;
    }
    return {
      name: field.name,
      jsonName: jsonNameOf(field.name),
      number: field.number,
      repeated: field.label === 'repeated',
      optional: field.label === 'optional',
      type,
      mapKey,
      oneofName: field.oneofName,
    };
  };

  const messages = new Map<string, RegistryMessage>();
  const enums = new Map<string, RegistryEnum>();

  for (const [fullName, raw] of rawMessages) {
    const fields = raw.fields.map((field) => buildField(field, fullName));
    const fieldsByNumber = new Map(fields.map((field) => [field.number, field]));
    messages.set(fullName, {
      fullName,
      fields,
      fieldsByNumber,
      oneofs: raw.oneofs.map((oneof) => oneof.name),
    });
  }

  for (const [fullName, raw] of rawEnums) {
    const nameToNumber = new Map(raw.values.map((value) => [value.name, value.number]));
    const numberToName = new Map<number, string>();
    for (const value of raw.values) {
      if (!numberToName.has(value.number)) numberToName.set(value.number, value.name);
    }
    enums.set(fullName, { fullName, values: raw.values, nameToNumber, numberToName });
  }

  const services: RegistryService[] = [];
  for (const file of files) {
    const packageScope = file.census.packageName ?? '';
    for (const service of file.census.services) {
      const rpcs = service.rpcs.map((rpc): RegistryRpc => {
        const resolveRpcType = (reference: string): string | null => {
          const resolved = resolveName(reference, packageScope);
          if (resolved === null || !rawMessages.has(resolved)) {
            issues.push({ kind: 'unresolved-type', reference, scope: service.fullName });
            return null;
          }
          return resolved;
        };
        return {
          name: rpc.name,
          streaming: rpc.streaming,
          inputType: resolveRpcType(rpc.inputType),
          outputType: resolveRpcType(rpc.outputType),
        };
      });
      services.push({ name: service.name, fullName: service.fullName, rpcs });
    }
  }

  return { messages, enums, services, issues };
}
