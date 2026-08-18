/**
 * Unknown-field capture — the serializable half of preserve-unknown
 * (invariant #4; the sync-engine design §13.2 pass-through reads).
 *
 * Parse walks the raw document JS against the entity schema and
 * captures every key the schema doesn't declare as
 * `{ path, value }` rows keyed by RFC 6901 JSON pointer, in document
 * order. The rows are plain data — they ride `ParsedDocument.raw`,
 * survive `structuredClone`, and can be persisted next to an engine
 * snapshot — so unknown fields written by a newer client survive the
 * full store → materialize round-trip, not just a load-edit-save hop.
 *
 * Knownness has two authorities, matching the emitter:
 *   - at the ROOT map, the entity's `*_FIELD_ORDER` constant (the
 *     serialization whitelist) — a schema-known key excluded from the
 *     field order (e.g. `Workspace.orgId`) is captured and re-emitted
 *     positionally, never dropped and never rewritten from the typed
 *     value;
 *   - at every nested map, the schema's entry set.
 *
 * Capture stops at the topmost unknown key: its whole subtree is one
 * row. Keys inside `v.record` maps are always known (the schema admits
 * them), as is everything below a `v.unknown()` leaf.
 */

import {
  asSchemaShape,
  isArrayShape,
  isObjectShape,
  isRecordShape,
  isTupleShape,
  resolveForValue,
  type SchemaShape,
} from './schema-shape';

/** One captured unknown field: RFC 6901 pointer + verbatim subtree. */
export interface UnknownField {
  readonly path: string;
  readonly value: unknown;
}

/** Escape one JSON-pointer segment per RFC 6901. */
export function escapePointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/** Inverse of {@link escapePointerSegment}. */
export function unescapePointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Read the captured unknown fields off a parsed / writeable document.
 * Fresh writes carry none.
 */
export function unknownFieldsOf(document: { readonly raw?: unknown }): readonly UnknownField[] {
  return (document.raw as readonly UnknownField[] | undefined) ?? [];
}

/**
 * Capture every key of `raw` (the parsed document as plain JS) that the
 * schema doesn't declare. `rootKnownKeys` is the entity's field-order
 * constant — the root map's knownness authority.
 */
export function extractUnknownFields(raw: unknown, schema: unknown, rootKnownKeys: readonly string[]): UnknownField[] {
  const out: UnknownField[] = [];
  if (!isPlainObject(raw)) return out;
  const rootShape = resolveForValue(asSchemaShape(schema), raw);
  const entries = rootShape?.entries ?? {};
  for (const key of Object.keys(raw)) {
    if (rootKnownKeys.includes(key)) {
      const childShape = entries[key];
      if (childShape !== undefined) walkKnown(raw[key], childShape, `/${escapePointerSegment(key)}`, out);
    } else {
      out.push({ path: `/${escapePointerSegment(key)}`, value: raw[key] });
    }
  }
  return out;
}

function walkKnown(value: unknown, schema: SchemaShape, pointer: string, out: UnknownField[]): void {
  if (value === null || typeof value !== 'object') return;
  const shape = resolveForValue(schema, value);
  if (shape === undefined) return;

  if (isObjectShape(shape) && isPlainObject(value)) {
    const entries = shape.entries ?? {};
    for (const key of Object.keys(value)) {
      const childPointer = `${pointer}/${escapePointerSegment(key)}`;
      const childShape = entries[key];
      if (childShape !== undefined) walkKnown(value[key], childShape, childPointer, out);
      else out.push({ path: childPointer, value: value[key] });
    }
    return;
  }

  if (isRecordShape(shape) && isPlainObject(value)) {
    const valueShape = shape.value;
    if (valueShape === undefined) return;
    for (const key of Object.keys(value)) {
      walkKnown(value[key], valueShape, `${pointer}/${escapePointerSegment(key)}`, out);
    }
    return;
  }

  if (isArrayShape(shape) && Array.isArray(value)) {
    const itemShape = shape.item;
    if (itemShape === undefined) return;
    for (let index = 0; index < value.length; index += 1) {
      walkKnown(value[index], itemShape, `${pointer}/${index}`, out);
    }
    return;
  }

  if (isTupleShape(shape) && Array.isArray(value)) {
    const itemShapes = shape.items ?? [];
    for (let index = 0; index < value.length && index < itemShapes.length; index += 1) {
      walkKnown(value[index], itemShapes[index], `${pointer}/${index}`, out);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
