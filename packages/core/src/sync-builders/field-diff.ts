/**
 * Per-leaf field-replacement diff synthesizer.
 *
 * A `create` payload is deep-flattened to per-leaf `setField` writes
 * (`flattenToLeaves`): `auth: { type: 'inherit' }` becomes one leaf at
 * `auth.type`. An edit that wrote the whole sub-object back as a single
 * `setField` at `auth` would leave the create-time `auth.type` leaf in
 * place; at materialize time `unflattenLeaves` applies the whole-object
 * `auth` leaf first, then lets the stale `auth.type` leaf clobber the
 * discriminant back to its create value. The variant's `type` freezes at
 * create time and the editor's derived-dirty check never converges.
 *
 * The fix is to mirror create's granularity on edits too. Given the
 * current materialized value at `basePath` and the editor's new value,
 * emit the **minimum** envelope sequence that converges the leaf set:
 *
 *   - new / content-changed leaf → `setField(basePath.leaf, value)`
 *   - leaf present in old but absent in new → `unsetField(basePath.leaf)`
 *   - unchanged leaf → emit nothing
 *
 * Because create and edits now share one flattened representation,
 * variant-`type` changes persist via per-leaf max-HLC-wins, fields that
 * vanish on a variant switch are tombstoned, and leaves the current
 * version doesn't know about stay untouched (we only ever name leaves we
 * observed in `old` or `new`) — opaque fidelity holds (§3, §13.2).
 *
 * `undefined` leaf values never travel: `flattenToLeaves` emits the
 * `undefined` sentinel for absent optional fields, and the wire format
 * never carries it. An `undefined` new leaf is treated as absent — so a
 * field that goes from a real value to `undefined` is a vanish and
 * tombstones, not a `setField(undefined)`.
 */

import { type EntityType, flattenToLeaves, type MutationBody } from '@openheaders/core/sync';

export interface FieldDiffArgs {
  type: EntityType;
  id: string;
  /** Top-level field path the sub-object lives at (e.g. `'auth'`, `'body'`). */
  basePath: string;
  /** Current materialized value at `basePath` — the diff baseline. */
  oldValue: unknown;
  /** Editor's new value at `basePath`. */
  newValue: unknown;
}

export function synthesizeFieldDiff(args: FieldDiffArgs): MutationBody[] {
  const { type, id, basePath, oldValue, newValue } = args;
  const bodies: MutationBody[] = [];

  const oldLeaves = leafMap(basePath, oldValue);
  const newLeaves = leafMap(basePath, newValue);

  for (const [path, value] of newLeaves) {
    if (oldLeaves.has(path) && leafEqual(oldLeaves.get(path), value)) continue;
    bodies.push({ kind: 'setField', type, id, path, value });
  }
  for (const path of oldLeaves.keys()) {
    if (!newLeaves.has(path)) {
      bodies.push({ kind: 'unsetField', type, id, path });
    }
  }

  return bodies;
}

// Flatten `value` to a path → leaf-value map, prefixing every leaf with
// `basePath` and dropping `undefined` leaves (absent optionals).
function leafMap(basePath: string, value: unknown): Map<string, unknown> {
  const map = new Map<string, unknown>();
  if (value === undefined) return map;
  for (const leaf of flattenToLeaves(value)) {
    if (leaf.value === undefined) continue;
    map.set(leaf.path ? `${basePath}.${leaf.path}` : basePath, leaf.value);
  }
  return map;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Leaf values are scalars or empty containers (`flattenToLeaves` recurses
// non-empty ones). Empty `[]` / `{}` compare equal to their own kind; a
// kind mismatch is a change.
function leafEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === 0 && b.length === 0;
  if (isPlainObject(a) && isPlainObject(b)) return Object.keys(a).length === 0 && Object.keys(b).length === 0;
  return false;
}
