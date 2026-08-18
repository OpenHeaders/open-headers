/**
 * Canonical YAML emission — byte-identical output for identical state
 * (the sync-engine design §23.3), independent of parse history or key
 * insertion order.
 *
 * The emitter builds the document tree explicitly, never from plain JS
 * object iteration (numeric-like string keys would reorder), with one
 * canonical layout at every depth:
 *
 *   - ROOT map: known keys in the entity's `*_FIELD_ORDER` sequence —
 *     the field order doubles as the serialization whitelist (runtime-
 *     only fields like `path` simply aren't listed).
 *   - Nested fixed-entry maps: keys in the schema's entry-definition
 *     order (valibot preserves it — the schema is the single nested-
 *     order authority; no hand-maintained nested order tables).
 *   - `v.record` maps: keys sorted by UTF-16 code unit.
 *   - Arrays / tuples: element order as given (arrays are ordered
 *     lists in the entity model; cross-file sibling order lives on the
 *     parent's `order:` array per §23.5).
 *   - After the known block of each map: that map's captured unknown
 *     fields, in captured (document) order — the §13.2 re-emission.
 *
 * Undefined values are omitted; `null` is emitted (callers that treat
 * null as absent normalize before emitting). Scalar styles come from
 * `CANONICAL_STRINGIFY_OPTIONS` alone, so any two hosts holding the
 * same state emit the same bytes.
 */

import * as YAML from 'yaml';
import { CANONICAL_STRINGIFY_OPTIONS } from './canonical';
import {
  asSchemaShape,
  isArrayShape,
  isObjectShape,
  isRecordShape,
  isTupleShape,
  resolveForValue,
  type SchemaShape,
} from './schema-shape';
import { escapePointerSegment, type UnknownField, unescapePointerSegment } from './unknown-fields';

interface UnknownEntry {
  readonly key: string;
  readonly value: unknown;
}

type UnknownsByParent = ReadonlyMap<string, readonly UnknownEntry[]>;

/**
 * Serialize an entity value to canonical YAML, re-emitting captured
 * unknown fields beneath the known block of their original parent map.
 */
export function emitCanonicalYaml<T extends object>(
  value: T,
  schema: unknown,
  fieldOrder: readonly string[],
  unknownFields: readonly UnknownField[],
): string {
  const doc = new YAML.Document(null);
  const byParent = groupByParent(unknownFields);
  const rootShape = resolveForValue(asSchemaShape(schema), value);
  const entries = rootShape?.entries ?? {};
  const record = value as Record<string, unknown>;

  const map = new YAML.YAMLMap();
  for (const key of fieldOrder) {
    const fieldValue = record[key];
    if (fieldValue === undefined) continue;
    const node = buildNode(doc, fieldValue, entries[key], `/${escapePointerSegment(key)}`, byParent);
    map.items.push(doc.createPair(key, node));
  }
  appendUnknowns(doc, map, '', byParent);
  doc.contents = map;
  return doc.toString(CANONICAL_STRINGIFY_OPTIONS);
}

function buildNode(
  doc: YAML.Document,
  value: unknown,
  schema: SchemaShape | undefined,
  pointer: string,
  byParent: UnknownsByParent,
): unknown {
  if (value === null || typeof value !== 'object' || schema === undefined) {
    return doc.createNode(value);
  }
  const shape = resolveForValue(schema, value);
  if (shape === undefined) return doc.createNode(value);

  if (isObjectShape(shape) && isPlainObject(value)) {
    const entries = shape.entries ?? {};
    const map = new YAML.YAMLMap();
    for (const key of Object.keys(entries)) {
      const fieldValue = value[key];
      if (fieldValue === undefined) continue;
      const childPointer = `${pointer}/${escapePointerSegment(key)}`;
      map.items.push(doc.createPair(key, buildNode(doc, fieldValue, entries[key], childPointer, byParent)));
    }
    appendUnknowns(doc, map, pointer, byParent);
    return map;
  }

  if (isRecordShape(shape) && isPlainObject(value)) {
    const map = new YAML.YAMLMap();
    for (const key of Object.keys(value).sort()) {
      const fieldValue = value[key];
      if (fieldValue === undefined) continue;
      const childPointer = `${pointer}/${escapePointerSegment(key)}`;
      map.items.push(doc.createPair(key, buildNode(doc, fieldValue, shape.value, childPointer, byParent)));
    }
    return map;
  }

  if (isArrayShape(shape) && Array.isArray(value)) {
    const seq = new YAML.YAMLSeq();
    for (let index = 0; index < value.length; index += 1) {
      seq.items.push(buildNode(doc, value[index], shape.item, `${pointer}/${index}`, byParent));
    }
    return seq;
  }

  if (isTupleShape(shape) && Array.isArray(value)) {
    const itemShapes = shape.items ?? [];
    const seq = new YAML.YAMLSeq();
    for (let index = 0; index < value.length; index += 1) {
      seq.items.push(buildNode(doc, value[index], itemShapes[index], `${pointer}/${index}`, byParent));
    }
    return seq;
  }

  return doc.createNode(value);
}

function appendUnknowns(doc: YAML.Document, map: YAML.YAMLMap, pointer: string, byParent: UnknownsByParent): void {
  for (const entry of byParent.get(pointer) ?? []) {
    map.items.push(doc.createPair(entry.key, doc.createNode(entry.value)));
  }
}

function groupByParent(unknownFields: readonly UnknownField[]): UnknownsByParent {
  const grouped = new Map<string, UnknownEntry[]>();
  for (const field of unknownFields) {
    const splitAt = field.path.lastIndexOf('/');
    if (splitAt < 0) continue;
    const parent = field.path.slice(0, splitAt);
    const key = unescapePointerSegment(field.path.slice(splitAt + 1));
    const bucket = grouped.get(parent);
    if (bucket === undefined) grouped.set(parent, [{ key, value: field.value }]);
    else bucket.push({ key, value: field.value });
  }
  return grouped;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
