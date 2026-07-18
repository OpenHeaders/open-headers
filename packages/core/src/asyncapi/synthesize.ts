/**
 * Example-payload synthesis — a censused message's payload schema
 * rendered as a JSON example the composer can start from ("Use example
 * message"). Covers exactly the ratified JSON-Schema subset: objects /
 * arrays / scalars / `enum` / `const` / `default` / `examples` — NO
 * combinators (allOf/oneOf/anyOf/not); a node carrying one is
 * unsupported (omitted as a property, null result at the root).
 *
 * Deterministic, proto-example posture: authored `examples`/`const`/
 * `default`/`enum` values win over type-driven samples; strings echo
 * their property name, numbers are 1, booleans true; arrays carry one
 * sample item. Nested `$ref`s resolve against the census's component
 * schema bodies (the parser resolves payload-level refs one level and
 * keeps deeper ones verbatim precisely for this); reference cycles cut
 * to an empty object.
 */

import type { AsyncApiSchema } from './types';

const COMBINATORS = ['allOf', 'oneOf', 'anyOf', 'not'] as const;

/** Distinguishes "synthesized null" from "nothing to synthesize". */
export interface SynthesizedPayload {
  value: unknown;
}

function isRecord(node: unknown): node is Record<string, unknown> {
  return typeof node === 'object' && node !== null && !Array.isArray(node);
}

/** `#/components/schemas/<name>` → `<name>`; null for any other ref. */
function componentSchemaName(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const match = /^#\/components\/schemas\/([^/]+)$/.exec(ref);
  if (match === null) return null;
  return match[1].replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Synthesize an example value for one message payload schema. Returns
 * null when the schema is absent or outside the ratified subset at the
 * root (a combinator, a non-mapping schema, an unknown shape).
 */
export function synthesizeExamplePayload(
  payload: unknown,
  componentSchemas: readonly AsyncApiSchema[],
): SynthesizedPayload | null {
  const bodies = new Map(componentSchemas.map((schema) => [schema.name, schema.body]));
  return synthesizeNode(payload, 'payload', bodies, new Set());
}

function synthesizeNode(
  node: unknown,
  hint: string,
  bodies: ReadonlyMap<string, unknown>,
  stack: Set<string>,
): SynthesizedPayload | null {
  if (!isRecord(node)) return null;

  const refName = componentSchemaName(node.$ref);
  if (refName !== null) {
    const body = bodies.get(refName);
    if (body === undefined) return null;
    if (stack.has(refName)) return { value: {} };
    stack.add(refName);
    const resolved = synthesizeNode(body, refName, bodies, stack);
    stack.delete(refName);
    return resolved;
  }

  if (COMBINATORS.some((key) => key in node)) return null;

  // Authored values beat type-driven samples, most specific first.
  if (Array.isArray(node.examples) && node.examples.length > 0) return { value: node.examples[0] };
  if ('const' in node) return { value: node.const };
  if ('default' in node) return { value: node.default };
  if (Array.isArray(node.enum) && node.enum.length > 0) return { value: node.enum[0] };

  const type = typeof node.type === 'string' ? node.type : null;

  if (type === 'object' || (type === null && isRecord(node.properties))) {
    const out: Record<string, unknown> = {};
    if (isRecord(node.properties)) {
      for (const [key, propertySchema] of Object.entries(node.properties)) {
        const property = synthesizeNode(propertySchema, key, bodies, stack);
        if (property !== null) out[key] = property.value;
      }
    }
    return { value: out };
  }

  if (type === 'array' || (type === null && node.items !== undefined)) {
    const item = synthesizeNode(node.items, hint, bodies, stack);
    return { value: item !== null ? [item.value] : [] };
  }

  switch (type) {
    case 'string':
      return { value: hint };
    case 'number':
    case 'integer':
      return { value: 1 };
    case 'boolean':
      return { value: true };
    case 'null':
      return { value: null };
    default:
      return null;
  }
}
