/**
 * Document-merge helpers.
 *
 * Phase 0 invariant #4 (preserve-unknown) + invariant #6 (metadata top,
 * payload nested) are realized here:
 *
 *   - `mergeKnownFields` edits a parsed AST in place, updating only the
 *     keys the caller names. Keys outside the known list are untouched,
 *     so unknown fields added by a newer client round-trip through an
 *     older client without loss.
 *   - `buildFreshDocument` composes a new AST from a typed value when
 *     there is no prior document (reset / import / create flows).
 *
 * Both paths emit the known fields in the canonical order supplied by
 * the caller; unknown fields retain their original position below.
 */

import * as YAML from 'yaml';

/**
 * Extract a JS value from a YAML key-node — `Scalar` wraps the actual
 * key, while some keys can also be plain strings in pathological cases.
 */
function keyOf(pair: YAML.Pair): unknown {
  const { key } = pair;
  if (YAML.isScalar(key)) return key.value;
  return key;
}

/**
 * Reorder a YAMLMap's entries so `known` keys come first in the exact
 * sequence given, followed by any unknown keys in their original order.
 */
function reorderKnownFirst(map: YAML.YAMLMap, known: readonly string[]): void {
  const knownPairs: YAML.Pair[] = [];
  const unknownPairs: YAML.Pair[] = [];
  for (const pair of map.items) {
    const k = keyOf(pair);
    if (typeof k === 'string' && known.includes(k)) knownPairs.push(pair);
    else unknownPairs.push(pair);
  }
  knownPairs.sort((a, b) => {
    const ka = keyOf(a) as string;
    const kb = keyOf(b) as string;
    return known.indexOf(ka) - known.indexOf(kb);
  });
  map.items = [...knownPairs, ...unknownPairs];
}

/**
 * Update a parsed YAML Document so every known field matches `value`.
 * Keys in `fieldOrder` with a defined value on `value` are written
 * (`doc.set`); keys with `undefined` are removed (`doc.delete`). Any
 * key not listed in `fieldOrder` is untouched — this is the preserve-
 * unknown contract that lets newer clients add fields without breaking
 * round-trip through older readers.
 *
 * The Document's contents are reordered so known fields appear first
 * in canonical order, preserving unknown-field positions below.
 */
export function mergeKnownFields<T extends Record<string, unknown>>(
  doc: YAML.Document,
  value: T,
  fieldOrder: readonly (keyof T & string)[],
): void {
  if (!YAML.isMap(doc.contents)) {
    // Empty / scalar document — replace contents with a fresh map.
    doc.contents = doc.createNode({}) as YAML.YAMLMap;
  }

  for (const key of fieldOrder) {
    const fieldValue = value[key];
    if (fieldValue === undefined) {
      doc.delete(key);
    } else {
      doc.set(key, fieldValue);
    }
  }

  reorderKnownFirst(doc.contents as YAML.YAMLMap, fieldOrder as readonly string[]);
}

/**
 * Build a brand-new YAML Document from a typed value, with known fields
 * in canonical order. Unknown / extra keys are dropped — use this only
 * for fresh writes (no prior parsed document to preserve).
 */
export function buildFreshDocument<T extends Record<string, unknown>>(
  value: T,
  fieldOrder: readonly (keyof T & string)[],
): YAML.Document {
  const ordered: Record<string, unknown> = {};
  for (const key of fieldOrder) {
    const v = value[key];
    if (v !== undefined) ordered[key] = v;
  }
  return new YAML.Document(ordered);
}
