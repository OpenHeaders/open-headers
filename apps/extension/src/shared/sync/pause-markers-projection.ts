/**
 * Pause-markers projection — `Record<path, marker> ⇄ MutationBatch /
 * MaterializedEntity`.
 *
 * Mirrors `vault-projection.ts` for the singleton entity. The on-disk
 * shape is the simplest in the catalogue: a flat record mapping path
 * strings to `'paused' | 'unpaused'`. The oracle stores entries as set
 * members at `markers` (set member identity = path).
 *
 * `seedPauseMarkers` mints one `create` for the empty shell + one
 * `addToSet` per entry; `projectPauseMarkers` is the inverse — it
 * reads `liveSetItems` so the projector can recover the original
 * record without iterating arrays in consumers.
 */

import {
  type MaterializedEntity,
  mintBatch,
  type MutationBatch,
  type MutationBody,
  type MutatorContext,
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerKind,
  type PauseMarkerSlot,
} from '@openheaders/core/sync';

export interface PauseMarkersSnapshot {
  /** Path → marker. Order is not significant for correctness; consumers
   *  that need deterministic order should derive from the projector's
   *  `paths: string[]` field. */
  markers: Record<string, PauseMarkerKind>;
}

export const EMPTY_PAUSE_MARKERS: PauseMarkersSnapshot = { markers: {} };

/**
 * Convert a persisted `Record<path, marker>` (or a Map) into a
 * `MutationBatch` of one `create` for the empty shell plus one
 * `addToSet` per entry. All-or-nothing under the oracle's per-entity
 * lock — boot-time replay through this is idempotent and byte-stable.
 */
export function seedPauseMarkers(
  source: ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>,
  ctx: MutatorContext,
): MutationBatch {
  const entries =
    source instanceof Map ? Array.from(source.entries()) : Object.entries(source);

  const bodies: MutationBody[] = [
    {
      kind: 'create',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      payload: {},
    },
  ];
  for (const [path, marker] of entries) {
    const item: PauseMarkerSlot = { path, marker };
    bodies.push({
      kind: 'addToSet',
      type: PAUSE_MARKERS_ENTITY_TYPE,
      id: PAUSE_MARKERS_ID,
      path: PAUSE_MARKERS_PATH,
      itemId: path,
      item,
    });
  }
  return mintBatch(ctx, bodies);
}

/**
 * Recover a `PauseMarkersSnapshot` from the oracle's materialized
 * singleton. The snapshot doesn't carry the marker map — items live
 * one layer down on `liveSetItems` — so the projector takes the live
 * items as the second argument. Returns `null` only if the entity
 * type doesn't match.
 */
export function projectPauseMarkers(
  materialized: MaterializedEntity,
  liveItems: ReadonlyArray<{ itemId: string; item: unknown }>,
): PauseMarkersSnapshot | null {
  if (materialized.type !== PAUSE_MARKERS_ENTITY_TYPE) return null;
  const markers: Record<string, PauseMarkerKind> = {};
  for (const entry of liveItems) {
    const slot = entry.item;
    if (!isPauseMarkerSlot(slot)) continue;
    markers[slot.path] = slot.marker;
  }
  return { markers };
}

const isPauseMarkerSlot = (v: unknown): v is PauseMarkerSlot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.path === 'string' && (r.marker === 'paused' || r.marker === 'unpaused');
};
