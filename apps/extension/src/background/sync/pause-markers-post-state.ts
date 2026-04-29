/**
 * Per-envelope pause-markers post-state projection (Phase B).
 *
 * Same shape as `vault-post-state.ts` for the singleton pause-markers
 * entity. Folds the live set at `markers` into a `Record<path, marker>`
 * so DNR + renderer consumers see post-commit state without iterating
 * arrays.
 *
 * Tombstoned (singleton deletion is a workspace-teardown gesture only)
 * and non-matching envelopes return `null`.
 *
 * Pause markers are user-visible UX state, not secrets — the projection
 * is identical for all surfaces.
 */

import type { SyncPauseMarkersPostState } from '@openheaders/core/protocol';
import type { MutationEnvelope } from '@openheaders/core/sync';
import {
  PAUSE_MARKERS_ENTITY_TYPE,
  PAUSE_MARKERS_ID,
  PAUSE_MARKERS_PATH,
  type PauseMarkerKind,
  type PauseMarkerSlot,
} from '@openheaders/core/sync';
import type { EntityOracle } from './oracle';

/**
 * Build the pause-markers post-state for `envelope` using `oracle`.
 * Returns `null` for non-matching envelopes, deletes (entity
 * tombstoned), and any envelope whose materialized record fails to
 * project.
 */
export function projectPauseMarkersPostState(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
  envelope: MutationEnvelope,
): SyncPauseMarkersPostState | null {
  if (envelope.body.type !== PAUSE_MARKERS_ENTITY_TYPE) return null;
  return projectPauseMarkersSingleton(oracle);
}

/**
 * Build the pause-markers post-state for the singleton entity. Used
 * by the snapshot RPC to seed freshly-mounted renderer mirrors before
 * the next live broadcast lands. Returns `null` when the singleton
 * hasn't been materialized yet (cold oracle prior to seed).
 */
export function projectPauseMarkersSingleton(
  oracle: Pick<EntityOracle, 'materializeOne' | 'liveSetItems'>,
): SyncPauseMarkersPostState | null {
  const materialized = oracle.materializeOne(PAUSE_MARKERS_ENTITY_TYPE, PAUSE_MARKERS_ID);
  if (!materialized) return null;

  const markers: Record<string, PauseMarkerKind> = {};
  for (const entry of oracle.liveSetItems(
    PAUSE_MARKERS_ENTITY_TYPE,
    PAUSE_MARKERS_ID,
    PAUSE_MARKERS_PATH,
  )) {
    if (!isPauseMarkerSlot(entry.item)) continue;
    markers[entry.itemId] = entry.item.marker;
  }
  const paths = Object.keys(markers).sort();

  return { markers, paths };
}

const isPauseMarkerSlot = (v: unknown): v is PauseMarkerSlot => {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.path === 'string' && (r.marker === 'paused' || r.marker === 'unpaused');
};
