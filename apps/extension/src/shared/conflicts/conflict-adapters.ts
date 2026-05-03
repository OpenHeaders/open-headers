/**
 * Entity adapter interfaces for the generic conflict-tracker hook +
 * UI helpers.
 *
 * The conflict-resolution stack splits cleanly along the editor /
 * entity axis:
 *
 *   - **Editor / UI surfaces** are entity-agnostic — chips, banner,
 *     dialog, key encoding, presence-mirror lookups all consume the
 *     same `(path, conflict)` shape regardless of entity type.
 *
 *   - **Entity projection** is per-entity — extracting baseline path
 *     values, looking up the current "theirs" value at a path,
 *     enumerating set memberships, decoding paths for resolution
 *     writes, pretty-printing labels — these all depend on entity
 *     schema.
 *
 * Per-entity code provides two adapters:
 *
 *   - `ConflictTrackingAdapter<E>` — read side (used by
 *     `useEntityConflicts`).
 *   - `ConflictResolveAdapter<E>` — write side (used by the diff
 *     dialog's per-row Apply + the inline "Use saved" affordance).
 *
 * Both are pure data adapters — no React, no hooks, no awareness
 * coupling. The generic `useEntityConflicts<E>` hook composes them
 * with the awareness mirror + dirty/baseline state into a
 * `EntityConflictsApi<E>` (typed identically for every entity).
 */

import type { FormInstance } from 'antd';
import type { PathConflict } from './types';

export type PathMap = Record<string, string>;

/** One entry in a set-modeled path's snapshot — keyed by row uid. */
export interface SetMember {
  uid: string;
  /** Compact human summary used in the diff dialog table. */
  summary: string;
  /** Full row object — the resolver re-inserts this into the form. */
  payload: unknown;
}

/** A `(setPath, byUid)` pair captured at one point in time. */
export interface SetMemberSnapshot {
  setPath: string;
  byUid: Map<string, SetMember>;
}

/**
 * Read-side adapter — projects an entity into the path-keyed view the
 * conflict tracker compares. Pure functions; no React, no hooks.
 */
export interface ConflictTrackingAdapter<E> {
  /** Stable identity used to detect "baseline matches the current
   *  entity". Typically the entity's persisted uid (`rule.uid`,
   *  `request.uid`, etc.). */
  signature(entity: E): string;
  /** Project entity → path-keyed value map. Used as the baseline at
   *  re-prime time AND as the "theirs" projection at lookup time
   *  (the same shape both sides agree on by construction). */
  extractBaseline(entity: E): PathMap;
  /** Lookup current value at a path; returns null when the path
   *  doesn't apply to this entity (wrong rule type, missing row,
   *  unrecognized leaf). The tracker treats null as "no theirs to
   *  surface" and skips. */
  readPath(entity: E, path: string): string | null;
  /** Project entity's set-modeled fields (header mods / params /
   *  conditions / future entity-specific sets). Used for set-add /
   *  set-remove / set-reorder detection. */
  snapshotSets(entity: E): readonly SetMemberSnapshot[];
  /** Project a path-keyed form (the same shape `extractBaseline`
   *  emits) into pseudo-set-members. Used to detect membership
   *  divergence between the form's local state and the live entity.
   *  `entity` provides type discrimination (some entities have
   *  type-conditional sets — header rules have request/response
   *  header sets; query-param rules have a params set). */
  snapshotSetsFromForm(form: PathMap, entity: E): readonly SetMemberSnapshot[];
}

/**
 * Write-side adapter — encodes the entity-specific knowledge of "how
 * to apply a saved-side value to the form / a transient entity
 * projection". Used by the diff dialog (writes to a local `E` clone
 * for the right-pane preview) and the inline `Use saved` affordance
 * (writes to the antd Form).
 *
 * Each method returns true when the write landed; false signals a
 * non-fatal "this path isn't applicable to the form / this entity
 * type" — the caller still records the resolution so the chip
 * dismisses.
 */
export interface ConflictResolveAdapter<E> {
  applyResolutionToForm(form: FormInstance, entity: E, path: string, conflict: PathConflict): boolean;
  applyResolutionToEntity(entity: E, path: string, conflict: PathConflict): boolean;
  /** Pretty-print a path → human label for one entity. Called by the
   *  banner + dialog row labels. Falls back to the raw path string
   *  when the structure isn't recognized. */
  prettyPath(entity: E, path: string): string;
}

/**
 * Compute pretty labels for a batch of paths. Entity-agnostic helper
 * around the per-entity `prettyPath` adapter method.
 */
export function prettyPathMap<E>(
  adapter: Pick<ConflictResolveAdapter<E>, 'prettyPath'>,
  entity: E,
  paths: Iterable<string>,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of paths) out.set(p, adapter.prettyPath(entity, p));
  return out;
}
