/**
 * Deterministic schema → placeholder-value synthesizer for request
 * bodies that declare only a schema (no concrete example). Bounded on
 * every axis — depth, per-level width, total nodes — so a pathological
 * schema can't stall the import; the caps trade completeness for a
 * scaffold the user edits anyway. Clock-free and random-free: the same
 * schema always synthesizes the same value.
 */

import { isRecord } from '../data-scan/json';
import type { RefResolver } from './ref';

const MAX_DEPTH = 6;
const MAX_KEYS_PER_LEVEL = 32;
const MAX_NODES = 256;

const STRING_FORMAT_PLACEHOLDERS: Record<string, string> = {
  'date-time': '2026-01-01T00:00:00Z',
  date: '2026-01-01',
  time: '00:00:00Z',
  email: 'user@openheaders.com',
  uuid: '00000000-0000-0000-0000-000000000000',
  uri: 'https://openheaders.com',
  url: 'https://openheaders.com',
  hostname: 'openheaders.com',
  ipv4: '127.0.0.1',
  ipv6: '::1',
};

/**
 * Synthesize a placeholder value for a schema node. Concrete authored
 * values win at every level (`example` / `default` / `const` / first
 * `enum` entry); otherwise the declared type drives a fixed
 * placeholder. Unresolvable nodes (external/missing/circular refs,
 * exceeded caps) synthesize `null` — the scaffold stays valid JSON.
 */
export function synthesizeSchemaScaffold(schema: unknown, resolver: RefResolver): unknown {
  const budget = { nodes: 0 };
  return synthesize(schema, resolver, 0, budget);
}

function synthesize(rawSchema: unknown, resolver: RefResolver, depth: number, budget: { nodes: number }): unknown {
  if (depth > MAX_DEPTH || budget.nodes >= MAX_NODES) return null;
  budget.nodes++;
  const resolved = resolver.resolve(rawSchema);
  if (!resolved.ok || !isRecord(resolved.value)) return null;
  const schema = resolved.value;

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

  // Composition: first branch of a oneOf/anyOf choice; allOf merges
  // object results shallowly (later branches win per key).
  if (Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
    return synthesize(schema.oneOf[0], resolver, depth + 1, budget);
  }
  if (Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    return synthesize(schema.anyOf[0], resolver, depth + 1, budget);
  }
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const branch of schema.allOf) {
      const value = synthesize(branch, resolver, depth + 1, budget);
      if (isRecord(value)) Object.assign(merged, value);
    }
    return merged;
  }

  const type = declaredType(schema);
  switch (type) {
    case 'object': {
      const out: Record<string, unknown> = {};
      const properties = isRecord(schema.properties) ? schema.properties : {};
      for (const [key, propSchema] of Object.entries(properties).slice(0, MAX_KEYS_PER_LEVEL)) {
        out[key] = synthesize(propSchema, resolver, depth + 1, budget);
      }
      return out;
    }
    case 'array':
      return [synthesize(schema.items, resolver, depth + 1, budget)];
    case 'string': {
      const format = typeof schema.format === 'string' ? schema.format : '';
      return STRING_FORMAT_PLACEHOLDERS[format] ?? 'string';
    }
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'null':
      return null;
    default:
      // No declared type — infer object/array from structure keywords.
      if (isRecord(schema.properties)) return synthesize({ ...schema, type: 'object' }, resolver, depth, budget);
      if (schema.items !== undefined) return synthesize({ ...schema, type: 'array' }, resolver, depth, budget);
      return null;
  }
}

/** The declared type, taking the first non-null entry of a 3.1 type array. */
function declaredType(schema: Record<string, unknown>): string {
  if (typeof schema.type === 'string') return schema.type;
  if (Array.isArray(schema.type)) {
    const first = schema.type.find((t) => typeof t === 'string' && t !== 'null');
    if (typeof first === 'string') return first;
  }
  return '';
}
