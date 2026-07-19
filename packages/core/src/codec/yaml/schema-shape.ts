/**
 * Valibot schema introspection shared by the unknown-field extractor
 * and the canonical emitter.
 *
 * The codec walks entity values ALONGSIDE their schema so that, at
 * every map, "known" is defined by the schema's entry set (and entry
 * ORDER — valibot preserves definition order, making the schema the
 * single canonical-order authority for nested objects; the top level
 * keeps its `*_FIELD_ORDER` constant, which doubles as the
 * serialization whitelist).
 *
 * Only the constructs the entity schemas actually use are resolved:
 * object / optional-family wrappers / array / tuple / record /
 * variant / union / lazy / pipe (which spreads its base schema, so no
 * special casing). Anything else is a leaf — the walkers emit or skip
 * it verbatim.
 */

import * as v from 'valibot';

/**
 * Structural view of a valibot schema. Valibot's concrete schema types
 * are not mutually assignable to one generic type parameterized on
 * unknown, so introspection reads them structurally; `asSchemaShape`
 * is the single conversion point.
 */
export interface SchemaShape {
  readonly type?: string;
  readonly entries?: Record<string, SchemaShape>;
  readonly wrapped?: SchemaShape;
  readonly item?: SchemaShape;
  readonly items?: readonly SchemaShape[];
  readonly key?: unknown;
  readonly value?: SchemaShape;
  readonly options?: readonly SchemaShape[];
  readonly literal?: unknown;
  readonly getter?: (input: unknown) => SchemaShape;
}

/** Single conversion point from a concrete valibot schema to the structural view. */
export function asSchemaShape(schema: unknown): SchemaShape {
  return schema as SchemaShape;
}

const MAX_RESOLVE_DEPTH = 32;

/**
 * Resolve a schema to the node that structurally describes `value`:
 * unwrap the optional family, expand `lazy`, and pick the matching
 * `variant` / `union` option. Returns undefined when no option matches
 * — the caller treats the value as an opaque leaf.
 */
export function resolveForValue(schema: SchemaShape, value: unknown): SchemaShape | undefined {
  let current: SchemaShape | undefined = schema;
  for (let depth = 0; current !== undefined && depth < MAX_RESOLVE_DEPTH; depth += 1) {
    if (current.wrapped !== undefined) {
      current = current.wrapped;
      continue;
    }
    if (current.type === 'lazy' && current.getter !== undefined) {
      current = current.getter(value);
      continue;
    }
    if (current.type === 'variant') {
      current = matchVariantOption(current, value);
      continue;
    }
    if (current.type === 'union') {
      current = matchUnionOption(current, value);
      continue;
    }
    return current;
  }
  return undefined;
}

/**
 * Match a variant option by its discriminator literal — cheap and
 * total for well-formed values (every entity variant discriminates on
 * a `v.literal`).
 */
function matchVariantOption(schema: SchemaShape, value: unknown): SchemaShape | undefined {
  const key = schema.key;
  if (typeof key !== 'string' || typeof value !== 'object' || value === null) return undefined;
  const discriminator = (value as Record<string, unknown>)[key];
  for (const option of schema.options ?? []) {
    const optionKeySchema = option.entries?.[key];
    if (optionKeySchema !== undefined && optionKeySchema.literal === discriminator) return option;
  }
  return undefined;
}

/** Match a plain union option by validation — first option that accepts the value. */
function matchUnionOption(schema: SchemaShape, value: unknown): SchemaShape | undefined {
  for (const option of schema.options ?? []) {
    const result = v.safeParse(option as unknown as v.GenericSchema, value);
    if (result.success) return option;
  }
  return undefined;
}

/** Whether a resolved schema node describes a fixed-entry map. */
export function isObjectShape(shape: SchemaShape): boolean {
  return shape.entries !== undefined && typeof shape.type === 'string' && shape.type.includes('object');
}

/** Whether a resolved schema node describes an open map (sorted-key emission). */
export function isRecordShape(shape: SchemaShape): boolean {
  return shape.type === 'record';
}

/** Whether a resolved schema node describes a homogeneous list. */
export function isArrayShape(shape: SchemaShape): boolean {
  return shape.type === 'array' && shape.item !== undefined;
}

/** Whether a resolved schema node describes a positional tuple. */
export function isTupleShape(shape: SchemaShape): boolean {
  return typeof shape.type === 'string' && shape.type.startsWith('tuple') && shape.items !== undefined;
}
