/**
 * Per-envelope pause-markers post-state projection (Phase B).
 *
 * Thin adapter over `flat-entity-post-state.ts` (singleton variant).
 * Folds the live set at `markers` into a `Record<path, marker>` so DNR
 * + renderer consumers see post-commit state without iterating arrays.
 *
 * Pause markers are user-visible UX state, not secrets — the projection
 * is identical for all surfaces.
 */

import type { SyncPauseMarkersPostState } from '@openheaders/core/protocol';
import {
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerKind,
  type PauseMarkerSlot,
} from '@openheaders/core/sync';
import { makeSingletonEntityProjectors } from './flat-entity-post-state';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>;

const projectors = makeSingletonEntityProjectors<Reads, SyncPauseMarkersPostState>({
  entityType: PAUSE_MARKERS_ENTITY_TYPE,
  entityId: PAUSE_MARKERS_ID,
  compose: (_materialized, oracle) => {
    const markers: Record<string, PauseMarkerKind> = {};
    for (const entry of oracle.liveSetItems(PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID, PAUSE_MARKERS_PATH)) {
      if (!isPauseMarkerSlot(entry.item)) continue;
      markers[entry.itemId] = entry.item.marker;
    }
    const paths = Object.keys(markers).sort();
    return { markers, paths };
  },
});

export const projectPauseMarkersPostState = projectors.projectPostState;
export const projectPauseMarkersSingleton = projectors.projectSingleton;

const isPauseMarkerSlot = (v: unknown): v is PauseMarkerSlot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.path === 'string' && (r.marker === 'paused' || r.marker === 'unpaused');
};
