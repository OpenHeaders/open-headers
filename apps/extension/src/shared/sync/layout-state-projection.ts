/**
 * Layout-state projection — `PersistedPanelLayout ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Mirrors `pause-markers-projection.ts` for the singleton layout-state
 * entity. The on-disk shape is the simplest in the catalogue: a single
 * opaque object the engine LWW's as a whole-blob scalar at the field
 * path `layout`.
 *
 * `seedLayoutState` mints one `create` for the empty shell + one
 * `setField` carrying the full layout object; `projectLayoutState` is
 * the inverse — it reads the materialized field at `layout` and re-emits
 * the opaque blob.
 */

import {
  LAYOUT_STATE_ENTITY_TYPE,
  LAYOUT_STATE_ID,
  LAYOUT_STATE_PATH,
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
} from '@openheaders/core/sync';

export interface LayoutStateSnapshot {
  /** Opaque layout blob — shape lives in the renderer hooks. `null`
   *  when the singleton hasn't been seeded yet. */
  layout: unknown;
}

export const EMPTY_LAYOUT_STATE: LayoutStateSnapshot = { layout: null };

/**
 * Convert a persisted opaque layout blob into a `MutationBatch` of one
 * `create` for the empty shell plus one `setField` carrying the layout.
 * All-or-nothing under the oracle's per-entity lock — boot-time replay
 * through this is idempotent and byte-stable.
 */
export function seedLayoutState(layout: unknown, ctx: MutatorContext): MutationBatch {
  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: LAYOUT_STATE_ENTITY_TYPE,
      id: LAYOUT_STATE_ID,
      payload: {},
    },
    {
      kind: 'setField',
      type: LAYOUT_STATE_ENTITY_TYPE,
      id: LAYOUT_STATE_ID,
      path: LAYOUT_STATE_PATH,
      value: layout,
    },
  ];
  return mintBatch(ctx, bodies);
}

/**
 * Recover the opaque layout blob from the oracle's materialized
 * singleton. Returns `null` if the entity type doesn't match. The
 * `layout` field is `null` when the singleton has been created but no
 * layout has been written yet (shouldn't happen in practice — `seed`
 * always pairs the create with the setField).
 */
export function projectLayoutState(materialized: MaterializedEntity): LayoutStateSnapshot | null {
  if (materialized.type !== LAYOUT_STATE_ENTITY_TYPE) return null;
  const data = materialized.data as Record<string, unknown> | null;
  const layout = data && LAYOUT_STATE_PATH in data ? data[LAYOUT_STATE_PATH] : null;
  return { layout: layout ?? null };
}
