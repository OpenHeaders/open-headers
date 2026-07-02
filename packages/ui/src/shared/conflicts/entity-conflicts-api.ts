/**
 * Contract for {@link useEntityConflicts} — the hook's public API
 * surface, its args, and the internal baseline snapshot shape. Kept
 * separate so per-entity shims and resolve adapters can type against
 * the API without pulling in the hook implementation.
 */

import type { ConflictTrackingAdapter, PathMap } from './conflict-adapters';
import type { PathConflict } from './types';

export interface BaselineState {
  /** Stable identity for the entity the baseline was captured from
   *  (typically `entity.uid`). */
  signature: string;
  paths: PathMap;
  /** Per-set ordered uid arrays at baseline-prime time. Used to detect
   *  "my order is untouched" so peer reorders auto-rebase silently
   *  instead of waiting on dialog resolution. Map insertion order on
   *  the snapshotSets adapter result preserves the entity's array
   *  order — ordering is implicit but consistent. */
  setOrders: ReadonlyMap<string, readonly string[]>;
}

export interface EntityConflictsApi<E> {
  /** Re-seed the baseline. Call from the editor's populateFromEntity
   *  on init / re-prime. */
  setBaseline: (entity: E) => void;
  /** Lookup conflict for a leaf path. Returns null when no conflict. */
  getConflict: (path: string, localValue: string) => PathConflict | null;
  /** All active conflicts on the entity, keyed by path. `form` is the
   *  same path-keyed projection the adapter's `extractBaseline`
   *  produces — caller computes it.
   *
   *  Optional `formSetOrders` supplies the form's ordered uid arrays
   *  per set-modeled path. Required for `'set-reorder'` detection
   *  (path keys are insertion-order sensitive in the live entity but
   *  order is lost when the form gets projected to a path map). */
  getAllConflicts: (form: PathMap, formSetOrders?: ReadonlyMap<string, readonly string[]>) => Map<string, PathConflict>;
  /** Per-row set conflict for a single (setPath, uid). Used by inline
   *  row chips to surface "saved version removed this row" without
   *  the caller having to project the whole form. */
  getSetConflict: (setPath: string, uid: string, formContainsUid: boolean) => PathConflict | null;
  /** Leaves where `form === baseline` (user didn't touch) AND `live`
   *  diverged from baseline (peer committed). Caller writes each
   *  `theirs` into the form and calls `acceptTheirs(path, theirs)`
   *  to advance baseline — same shape as the manual "Use saved"
   *  affordance, but applied automatically because there's no real
   *  conflict (only one side edited). Implements §6.2's killer-demo
   *  promise: different paths apply unconditionally. */
  getAutoMergeable: (form: PathMap) => Map<string, string>;
  /** Set-level reorder analogue of `getAutoMergeable`: returns the
   *  saved-side ordered uid array per setPath where my form's order
   *  matches baseline (untouched) AND live diverged. Caller reorders
   *  the form's array in place via uid — leaf edits on rows that
   *  moved carry their identity through the reorder. Returns empty
   *  for sets where my order also diverged (membership or order
   *  conflict — those keep going through the dialog).
   *
   *  For order-sensitive sets (DNR header rules, query-param actions),
   *  the rebase is suppressed when ANY leaf in that set is locally
   *  dirty: the user is reasoning by row position, and silent
   *  reordering under a pending edit would change semantic meaning.
   *  Those cases fall through to the dialog's set-reorder row.
   *  `form` is the path-keyed projection that lets the hook compare
   *  per-leaf form vs baseline under each set's prefix. */
  getAutoMergeableSetOrders: (
    form: PathMap,
    formSetOrders: ReadonlyMap<string, readonly string[]>,
  ) => Map<string, readonly string[]>;
  /** Accept the external value at path: align baseline + dismiss. */
  acceptTheirs: (path: string, theirs: string) => void;
  /** Advance the per-set baseline order to a new ordering — used by
   *  silent auto-rebase + manual "Use saved order" so subsequent peer
   *  reorders compare against the most-recently accepted state, not
   *  the stale at-prime order. Mirrors `acceptTheirs` for leaves. */
  acceptTheirsSetOrder: (setPath: string, savedOrder: readonly string[]) => void;
  /** Dismiss the chip without taking theirs. */
  dismiss: (path: string) => void;
  /** Clear all dismissed entries (e.g. on successful save). */
  clearDismissed: () => void;
  /** Project the live entity into the same path-keyed shape as the
   *  baseline. Useful for entity-level diff dialog rendering. */
  projectEntity: (entity: E) => PathMap;
}

export interface UseEntityConflictsArgs<E> {
  liveEntity: E | null | undefined;
  isDirty: boolean;
  /** When false, getConflict returns null unconditionally. */
  enabled: boolean;
  /** Entity-type string for the awareness mirror lookup. Same string
   *  the editor publishes via `<EntityScopeProvider entityType={…}>`. */
  entityType: string;
  /** Per-entity projection. Pure functions; the hook composes them
   *  with awareness + state. */
  adapter: ConflictTrackingAdapter<E>;
}
