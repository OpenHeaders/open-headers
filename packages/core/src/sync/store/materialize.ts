/**
 * Materialize {@link EntityState} → externally-observable snapshot.
 *
 * Convergence rests on this being a pure function of the per-unit
 * max-HLC-wins records:
 *   - per-leaf field path: include the value iff its HLC exceeds any
 *     covering field tombstone HLC at the same path (§7.2 unsetField).
 *   - per-(setPath, itemId): include the item iff its add HLC exceeds
 *     the corresponding remove tombstone HLC.
 *   - whole entity: omit if any tombstone exists (delete-wins,
 *     permanent — §7.2).
 *
 * Set items are emitted under their setPath as an array sorted by
 * the parent-owned fractional-indexing key (with itemId as tie-break)
 * so two structurally-equal stores produce byte-identical canonical
 * JSON. Order computation lives in `liveOrderedItemsAt`.
 *
 * Schema-aware empty-set canonicalization: when an
 * {@link EntitySchema} is supplied, every declared set path is
 * guaranteed to surface — as `[]` if no live entries exist, or as the
 * ordered set otherwise. The function form of `setPaths` receives the
 * field-value-only partial data so conditional schemas (Rule's
 * `action.*` paths gated on `type: 'header'`) can branch on the
 * discriminant. Without a schema, untouched set paths stay absent
 * (legacy / catalog-blind tests). Convergence and HLC semantics are
 * unchanged either way.
 */

import type { EntityType } from '../envelope';
import { compareHlc } from '../hlc';
import { type Leaf, unflattenLeaves } from '../mutators';
import { liveOrderedItemsAt } from '../mutators/state';
import type { EntityState, FieldOrigin } from '../mutators/types';
import type { EntitySchema } from '../schema';

export interface MaterializedEntity {
  type: EntityType;
  id: string;
  data: unknown;
  /**
   * Per-leaf-path provenance for currently-live field writes. Mirrors
   * the keys present in {@link MaterializedEntity.data}'s leaves and
   * tracks whether the last write at each path came from a local user
   * gesture (`'local'`) or arrived inbound from a peer / hydration /
   * snapshot replay (`'inbound'`). Consumed by the Activity Feed
   * classifier to emit `supersede-local-edit` (F2.h) and by tests; set
   * members (paths whose value is an array) are omitted because set
   * provenance is per-item rather than per-path. Empty object when no
   * live leaf paths exist.
   */
  fieldOrigins: Record<string, FieldOrigin>;
}

export function materializeEntity(state: EntityState, schema?: EntitySchema): MaterializedEntity | null {
  if (state.tombstone) return null;
  // Unobservable until created: the store mints implicit state for any
  // mutation kind, so a non-create replayed ahead of its entity's
  // `create` (a peer's log interleaving) would otherwise materialize a
  // half-shaped entity into every projection. The state converges the
  // moment the create lands. Well-known singletons opt out — their
  // empty state exists a priori (see EntitySchema.observableWithoutCreate).
  if (!state.createHlc && !schema?.observableWithoutCreate) return null;

  const fieldLeaves: Leaf[] = [];
  const fieldOrigins: Record<string, FieldOrigin> = {};
  for (const [path, entry] of state.fieldValues) {
    const tombstoneHlc = state.fieldTombstones.get(path);
    if (tombstoneHlc && compareHlc(tombstoneHlc, entry.hlc) >= 0) continue;
    fieldLeaves.push({ path, value: entry.value });
    fieldOrigins[path] = entry.origin;
  }

  // Resolve schema-declared set paths. Function form gets the
  // field-value-only partial so conditional schemas can branch on a
  // discriminant. The double-unflatten cost is paid only when the
  // schema actually uses the function form.
  const declaredSetPaths: readonly string[] = (() => {
    if (!schema) return [];
    const resolver = schema.setPaths;
    if (typeof resolver === 'function') {
      const partial = unflattenLeaves(sortedLeaves(fieldLeaves));
      return resolver(partial);
    }
    return resolver;
  })();

  // Union of paths that need to surface as arrays: every path the
  // state knows about, plus every path the schema declared.
  const setPaths = new Set<string>(state.setItems.keys());
  for (const path of declaredSetPaths) setPaths.add(path);

  const leaves: Leaf[] = fieldLeaves.slice();
  for (const setPath of setPaths) {
    const live = liveOrderedItemsAt(state, setPath);
    leaves.push({ path: setPath, value: live.map((l) => l.item) });
  }

  return { type: state.type, id: state.id, data: unflattenLeaves(sortedLeaves(leaves)), fieldOrigins };
}

// Sort leaves by path so unflattenLeaves builds containers in a
// deterministic shape regardless of insertion order.
function sortedLeaves(leaves: Leaf[]): Leaf[] {
  return leaves.slice().sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
