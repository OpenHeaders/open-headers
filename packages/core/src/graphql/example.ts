/**
 * Example-variables synthesis — an operation's variable definitions
 * rendered as a JSON object the Variables pane can start from
 * ("Generate variables"). Deterministic, the proto / AsyncAPI posture:
 * an authored default wins; scalars take name-aware samples on the
 * `openheaders.io` flavor (an `email` is `john.doe@openheaders.io`, a
 * `url` is `https://openheaders.io`, an `id` is `"1"`); enums take
 * their first value; lists carry one item; input objects fill every
 * field; reference cycles cut to an empty object. Nullable variables
 * are filled too — an example should be useful, not minimal.
 */

import type { GraphqlInputValue, GraphqlNamedType, GraphqlSchema, GraphqlTypeRef } from './schema';
import { namedTypeOf, typeRefOf } from './schema';
import type { ConstValueNode, OperationDefinitionNode, ValueNode } from './types';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/** A GraphQL literal → JSON (enum values become their name strings;
 *  variables inside a literal become null). */
export function valueToJson(node: ValueNode | ConstValueNode): JsonValue {
  switch (node.kind) {
    case 'IntValue':
      return Number.parseInt(node.value, 10);
    case 'FloatValue':
      return Number.parseFloat(node.value);
    case 'StringValue':
    case 'EnumValue':
      return node.value;
    case 'BooleanValue':
      return node.value;
    case 'NullValue':
    case 'Variable':
      return null;
    case 'ListValue':
      return node.values.map(valueToJson);
    case 'ObjectValue': {
      const out: { [key: string]: JsonValue } = {};
      for (const field of node.fields) out[field.name.value] = valueToJson(field.value);
      return out;
    }
  }
}

const STRING_HINTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/e-?mail/i, 'john.doe@openheaders.io'],
  [/url|uri|link|href|website/i, 'https://openheaders.io'],
  [/host|domain/i, 'openheaders.io'],
  [/first.?name/i, 'John'],
  [/last.?name|surname/i, 'Doe'],
  [/name|title/i, 'John Doe'],
  [/phone|tel/i, '+1 555 0100'],
  [/date|time|at$/i, '2026-01-01T00:00:00Z'],
  [/cursor|token|after|before/i, 'Y3Vyc29y'],
  [/pass|secret/i, 'change-me'],
  [/slug|handle|user/i, 'john.doe'],
];

const SCALAR_SAMPLES: ReadonlyMap<string, JsonValue> = new Map<string, JsonValue>([
  ['Int', 1],
  ['Float', 1.5],
  ['Boolean', true],
  ['ID', '1'],
  ['DateTime', '2026-01-01T00:00:00Z'],
  ['Date', '2026-01-01'],
  ['Time', '00:00:00Z'],
  ['Timestamp', '2026-01-01T00:00:00Z'],
  ['JSON', {}],
  ['JSONObject', {}],
  ['URL', 'https://openheaders.io'],
  ['URI', 'https://openheaders.io'],
  ['EmailAddress', 'john.doe@openheaders.io'],
  ['UUID', '00000000-0000-4000-8000-000000000001'],
  ['Long', 1],
  ['BigInt', 1],
  ['Decimal', '1.5'],
  ['Upload', null],
]);

function stringSample(hint: string): string {
  for (const [pattern, sample] of STRING_HINTS) if (pattern.test(hint)) return sample;
  return hint;
}

function scalarSample(name: string, hint: string): JsonValue {
  if (name === 'String') return stringSample(hint);
  const known = SCALAR_SAMPLES.get(name);
  return known === undefined ? hint : known;
}

function sampleForNamed(
  type: GraphqlNamedType | undefined,
  name: string,
  hint: string,
  schema: GraphqlSchema,
  stack: Set<string>,
): JsonValue {
  if (type === undefined) return scalarSample(name, hint);
  switch (type.kind) {
    case 'SCALAR':
      return scalarSample(type.name, hint);
    case 'ENUM':
      return type.values.length > 0 ? type.values[0].name : null;
    case 'INPUT_OBJECT': {
      if (stack.has(type.name)) return {};
      stack.add(type.name);
      const out: { [key: string]: JsonValue } = {};
      const fields = type.oneOf ? type.inputFields.slice(0, 1) : type.inputFields;
      for (const field of fields) out[field.name] = sampleForInputValue(field, schema, stack);
      stack.delete(type.name);
      return out;
    }
    default:
      return null;
  }
}

/** A sample for any input type reference — the hint names the
 *  variable / field it fills. */
export function exampleForType(type: GraphqlTypeRef, hint: string, schema: GraphqlSchema): JsonValue {
  return sampleForRef(type, hint, schema, new Set());
}

function sampleForRef(type: GraphqlTypeRef, hint: string, schema: GraphqlSchema, stack: Set<string>): JsonValue {
  switch (type.kind) {
    case 'NON_NULL':
      return sampleForRef(type.ofType, hint, schema, stack);
    case 'LIST':
      return [sampleForRef(type.ofType, hint, schema, stack)];
    case 'NAMED':
      return sampleForNamed(schema.types.get(type.name), type.name, hint, schema, stack);
  }
}

function sampleForInputValue(value: GraphqlInputValue, schema: GraphqlSchema, stack: Set<string>): JsonValue {
  if (value.defaultValue !== null) {
    const parsed = literalToJson(value.defaultValue);
    if (parsed !== undefined) return parsed;
  }
  return sampleForRef(value.type, value.name, schema, stack);
}

/** Introspection carries defaults as GraphQL literal text. */
function literalToJson(text: string): JsonValue | undefined {
  const trimmed = text.trim();
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) return Number.parseFloat(trimmed);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) return trimmed;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isJsonValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  switch (typeof value) {
    case 'string':
    case 'number':
    case 'boolean':
      return true;
    case 'object':
      return Array.isArray(value) ? value.every(isJsonValue) : Object.values(value).every(isJsonValue);
    default:
      return false;
  }
}

/**
 * Example variables for one operation: every declared variable filled,
 * declared defaults winning over synthesized samples. With no schema
 * the built-in scalars still sample by name; custom types fall back to
 * their name as a string.
 */
export function exampleVariables(
  operation: OperationDefinitionNode,
  schema: GraphqlSchema | null,
): { [key: string]: JsonValue } {
  const out: { [key: string]: JsonValue } = {};
  const stack = new Set<string>();
  for (const definition of operation.variableDefinitions) {
    const name = definition.variable.name.value;
    if (definition.defaultValue !== null) {
      out[name] = valueToJson(definition.defaultValue);
      continue;
    }
    if (schema === null) {
      let sample = scalarSample(namedTypeOf(typeRefOf(definition.type)), name);
      let wrapper = definition.type;
      while (wrapper.kind !== 'NamedType') {
        if (wrapper.kind === 'ListType') sample = [sample];
        wrapper = wrapper.type;
      }
      out[name] = sample;
      continue;
    }
    out[name] = sampleForRef(typeRefOf(definition.type), name, schema, stack);
  }
  return out;
}
