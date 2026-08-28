/**
 * Pause-markers mutator catalog — routing constants.
 *
 * Singleton entity per workspace. Pause markers are a flat set keyed
 * by CONTAINER IDENTITY — the collection / folder uid — each entry
 * `'paused'` or `'unpaused'`. Inheritance + override resolution walks
 * the tree's parent chain (`@openheaders/core/utils/pause`); the engine
 * treats the set as plain members with one item per marked container.
 *
 * Set member identity = container uid (catalog version 2). Version 1
 * keyed members by container PATH (`{ path, marker }`, itemId = path);
 * such members still arrive from 2026.8.4 clients and are migrated on
 * READ by the projector — resolved to a ref through the same path →
 * parent net the tree reconciler uses — never rewritten in the store.
 * The version-2 item carries the container's path at write time as a
 * hint for those old readers only.
 *
 * Concurrent toggles on the same container converge under
 * per-(setPath, itemId) LWW; across the two key shapes the higher
 * add-HLC wins. Unmarking is a `removeFromSet` tombstone — distinct
 * from "implicitly unpaused via inheritance default", which has no
 * marker at all.
 *
 * Pause-marker changes invalidate DNR (effective rule set shifts when
 * an ancestor pause flips), so the catalog emits a `RECOMPILE_DNR`
 * intent keyed by the singleton id.
 *
 * Not sensitive — pause-markers are user-visible UX state, not
 * secrets. They sync freely across surfaces.
 */

import type { PauseMarker, PauseMarkerContainerType, PauseMarkerEntry, PauseMarkerRef } from '../../../utils/pause';

/** Routing key carried on every pause-markers mutation envelope. */
export const PAUSE_MARKERS_ENTITY_TYPE = 'pause-markers';

/** Set path holding the per-container marker entries on the singleton. */
export const PAUSE_MARKERS_PATH = 'markers';

/** Fixed singleton id — every workspace has exactly one of these. */
export const PAUSE_MARKERS_ID = 'pause-markers';

/** Marker value carried in the set item. */
export type PauseMarkerKind = PauseMarker;

export type { PauseMarkerContainerType, PauseMarkerEntry, PauseMarkerRef };

/** Version-2 set item: the container ref, its marker, and the write-time path hint. */
export type PauseMarkerSlot = PauseMarkerEntry;

/** Version-1 set item, keyed by container path. Read-only compatibility shape. */
export interface LegacyPauseMarkerSlot {
  path: string;
  marker: PauseMarkerKind;
}

export function isPauseMarkerKind(v: unknown): v is PauseMarkerKind {
  return v === 'paused' || v === 'unpaused';
}

export function isPauseMarkerSlot(v: unknown): v is PauseMarkerSlot {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    (r.type === 'collection' || r.type === 'folder') &&
    typeof r.uid === 'string' &&
    isPauseMarkerKind(r.marker) &&
    (r.path === undefined || typeof r.path === 'string')
  );
}

export function isLegacyPauseMarkerSlot(v: unknown): v is LegacyPauseMarkerSlot {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.path === 'string' && typeof r.uid !== 'string' && isPauseMarkerKind(r.marker);
}
