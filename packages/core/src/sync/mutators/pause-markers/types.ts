/**
 * Pause-markers mutator catalog — routing constants.
 *
 * Singleton entity per workspace. Pause markers are a flat map keyed
 * by collection / folder path; each entry is `'paused'` or
 * `'unpaused'`. Inheritance + override resolution is a renderer / DNR
 * concern (`@openheaders/core/utils/pause`); the engine treats the
 * map as a plain set keyed by path, with one item per marked path.
 *
 * Set member identity = path. Concurrent toggles on the same path
 * converge under per-(setPath, itemId) LWW; concurrent toggles on
 * different paths land independently. Unmarking a path is a
 * `removeFromSet` tombstone — distinct from "implicitly unpaused via
 * inheritance default", which has no marker at all.
 *
 * Pause-marker changes invalidate DNR (effective rule set shifts when
 * an ancestor pause flips), so the catalog emits a `RECOMPILE_DNR`
 * intent keyed by the singleton id. The shared dnr-intent runner
 * widens its entity-type filter to include this entity.
 *
 * Not sensitive — pause-markers are user-visible UX state, not
 * secrets. They sync freely across surfaces.
 */

/** Routing key carried on every pause-markers mutation envelope. */
export const PAUSE_MARKERS_ENTITY_TYPE = 'pause-markers';

/** Set path holding the per-path marker entries on the singleton. */
export const PAUSE_MARKERS_PATH = 'markers';

/** Fixed singleton id — every workspace has exactly one of these. */
export const PAUSE_MARKERS_ID = 'pause-markers';

/** Marker value carried in the set item. */
export type PauseMarkerKind = 'paused' | 'unpaused';

/**
 * Set-item shape carried inside the pause-markers entity. The `path`
 * is repeated alongside the `marker` so the projector can rebuild a
 * `Record<path, marker>` directly from `liveSetItems` without round-
 * tripping through the itemId.
 */
export interface PauseMarkerSlot {
  path: string;
  marker: PauseMarkerKind;
}
