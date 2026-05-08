/**
 * Entity-agnostic conflict tracker.
 *
 * Computes per-path conflicts between (a) the form's uncommitted local
 * value, (b) the value the form was last seeded with (baseline), and
 * (c) the value an external surface most recently committed (theirs).
 *
 * A path is "in conflict" when:
 *   - the user has edited it locally (local !== base), AND
 *   - another surface has committed a different value (theirs !== local), AND
 *   - the user has not dismissed the chip for that path.
 *
 * Two-tier life cycle:
 *   - Baseline is captured by `setBaseline(entity)` on every form
 *     (re-)seed. The seed sites are the init effect and the live-update
 *     effect (which only fires when the form is clean — that path also
 *     clears dismissed).
 *   - Take-Theirs accepts the external value at one path: caller writes
 *     the value into the form, then calls `acceptTheirs(path, value)`
 *     so the baseline catches up and the chip dismisses.
 *
 * Optional remote attribution is best-effort: when a peer surface
 * still has `fieldFocus` on the same path, the awareness mirror
 * provides the peer's surface label + recency. If the peer saved +
 * moved on, the chip shows "Saved value" without attribution.
 *
 * Per-entity code provides a `ConflictTrackingAdapter<E>` (read-side
 * projection); this hook composes the adapter with awareness +
 * baseline state. Identical API surface for every entity — see
 * `conflict-adapters.ts` for the contract.
 */

import type { AwarenessState } from '@openheaders/core/protocol';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalLocalInstanceId } from '@/shared/awareness';
import { getActiveAwarenessMirror } from '@/context/awareness-mirror';
import {
  decodeReorderConflictKey as _decodeReorder,
  decodeSetConflictKey as _decodeSet,
  isReorderConflictKey as _isReorder,
  isSetConflictKey as _isSet,
  reorderConflictKey as _reorderKey,
  setConflictKey as _setKey,
} from './conflict-keys';
import type {
  ConflictTrackingAdapter,
  PathMap,
  SetMember,
  SetMemberSnapshot,
} from './conflict-adapters';
import type { ConflictRemoteInfo, PathConflict } from './types';
// Note: this hook lives in `shared/conflicts/` next to the dialog
// component. To keep test setups that import from the conflicts barrel
// from transitively pulling in Monaco (via `EntityConflictDialog`),
// per-entity shims (`useRuleConflicts`, etc.) import this hook from
// the file path directly rather than via the barrel.

interface BaselineState {
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
  getAllConflicts: (
    form: PathMap,
    formSetOrders?: ReadonlyMap<string, readonly string[]>,
  ) => Map<string, PathConflict>;
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

/** Strip the `{"kind":"<name>"}` marker emitted by the walker at
 *  `union:<prefix>` baseline keys down to the discriminator name. The
 *  marker is JSON to keep stable-stringify roundtripping; the dialog
 *  only needs the user-visible kind. */
function parseDiscriminatorFromMarker(marker: string): string {
  if (!marker) return '';
  try {
    const parsed = JSON.parse(marker) as { kind?: unknown };
    if (parsed && typeof parsed.kind === 'string') return parsed.kind;
  } catch {
    // Non-JSON marker — fall through and return as-is.
  }
  return marker;
}

function describeRemote(presence: readonly AwarenessState[], now: number): ConflictRemoteInfo | undefined {
  if (presence.length === 0) return undefined;
  // Most-recent peer wins when several are in the candidate set.
  const sorted = [...presence].sort((a, b) => b.lastActivityHlc.physicalMs - a.lastActivityHlc.physicalMs);
  const top = sorted[0];
  const agoMs = Math.max(0, now - top.lastActivityHlc.physicalMs);
  return {
    surfaceKind: top.identity.surfaceKind,
    surfaceLabel: top.identity.label,
    instanceId: top.identity.instanceId,
    agoMs,
  };
}

/**
 * Cascade peer lookup so attribution survives the saving peer moving
 * on. Signal weakens as we broaden scope, but a best-guess
 * attribution beats going silent — the user always wants to see
 * "this came from somewhere", even when that somewhere is their own
 * other tab they forgot about.
 *
 *   1. Peer focused on this exact field — strongest signal.
 *   2. Peer focused on this entity (different field) — still likely
 *      the same author who just navigated within the editor.
 *   3. Any peer alive on this workspace, most-recently-active first —
 *      catches "saved + closed tab" and cross-surface rename cases.
 *
 * The local surface is excluded at every tier; same-user-different-tab
 * is NOT excluded — that's the most useful case to surface.
 */
function findRemoteAttribution(
  mirror: ReturnType<typeof getActiveAwarenessMirror>,
  entityType: string,
  entityId: string,
  path: string,
  localInstanceId: string | undefined,
  now: number,
): ConflictRemoteInfo | undefined {
  const opts = { excludeInstanceId: localInstanceId };
  const fieldPeers = mirror.getPresenceForField({ type: entityType, id: entityId, path }, opts);
  if (fieldPeers.length > 0) return describeRemote(fieldPeers, now);
  const entityPeers = mirror.getPresenceForEntity({ type: entityType, id: entityId }, opts);
  if (entityPeers.length > 0) return describeRemote(entityPeers, now);
  const all = mirror.getPresence().filter((p) => p.identity.instanceId !== localInstanceId);
  return describeRemote(all, now);
}

export function useEntityConflicts<E extends { uid: string }>(
  args: UseEntityConflictsArgs<E>,
): EntityConflictsApi<E> {
  const { liveEntity, isDirty, enabled, entityType, adapter } = args;
  const baselineRef = useRef<BaselineState | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [overrides, setOverrides] = useState<PathMap>({});
  const [setOrderOverrides, setSetOrderOverrides] = useState<ReadonlyMap<string, readonly string[]>>(
    () => new Map(),
  );
  const localInstanceId = useOptionalLocalInstanceId();

  // Awareness re-render trigger. Mirror is the source of truth for
  // remote attribution — consumers re-read on every notification
  // rather than caching state, so the lookup stays cheap.
  // Subscribe to ANY presence change (not just this entity's bucket)
  // so the cascade's third tier ("any peer alive on the workspace")
  // stays reactive.
  const [, bumpAwareness] = useState(0);
  useEffect(() => {
    if (!enabled || !liveEntity) return;
    const mirror = getActiveAwarenessMirror();
    return mirror.subscribe(() => {
      bumpAwareness((n) => n + 1);
    });
  }, [enabled, liveEntity?.uid]);

  const setBaseline = useCallback(
    (entity: E) => {
      const orders = new Map<string, readonly string[]>();
      for (const snap of adapter.snapshotSets(entity)) {
        // Map insertion order on `byUid` reflects the entity array's
        // order at baseline time — `buildSnapshots` populates by
        // iterating the array. Freeze a snapshot so subsequent live
        // changes don't mutate this baseline view.
        orders.set(snap.setPath, Array.from(snap.byUid.keys()));
      }
      baselineRef.current = {
        signature: adapter.signature(entity),
        paths: adapter.extractBaseline(entity),
        setOrders: orders,
      };
      setDismissed((prev) => (prev.size === 0 ? prev : new Set()));
      setOverrides((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      setSetOrderOverrides((prev) => (prev.size === 0 ? prev : new Map()));
    },
    [adapter],
  );

  const acceptTheirsSetOrder = useCallback((setPath: string, savedOrder: readonly string[]) => {
    setSetOrderOverrides((prev) => {
      const next = new Map(prev);
      next.set(setPath, savedOrder);
      return next;
    });
  }, []);

  const acceptTheirs = useCallback((path: string, theirs: string) => {
    setOverrides((prev) => ({ ...prev, [path]: theirs }));
    setDismissed((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const dismiss = useCallback((path: string) => {
    setDismissed((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const clearDismissed = useCallback(() => {
    setDismissed(new Set());
    setOverrides({});
  }, []);

  const projectEntity = useCallback((entity: E) => adapter.extractBaseline(entity), [adapter]);

  const getSetConflict = useCallback(
    (setPath: string, uid: string, formContainsUid: boolean): PathConflict | null => {
      if (!enabled || !isDirty || !liveEntity) return null;
      const baseline = baselineRef.current;
      if (!baseline) return null;
      const key = _setKey(setPath, uid);
      if (dismissed.has(key)) return null;

      const liveSets = adapter.snapshotSets(liveEntity);
      const liveSnap = liveSets.find((s) => s.setPath === setPath);
      const liveMember = liveSnap?.byUid.get(uid);

      const baselineSnap = adapter
        .snapshotSetsFromForm(baseline.paths, liveEntity)
        .find((s) => s.setPath === setPath);
      const baseMember = baselineSnap?.byUid.get(uid);

      // saved-removed: was in baseline + form, gone from live.
      if (!liveMember && baseMember && formContainsUid) {
        const mirror = getActiveAwarenessMirror();
        const remote = findRemoteAttribution(mirror, entityType, liveEntity.uid, key, localInstanceId, Date.now());
        const conflict: PathConflict = {
          kind: 'set-remove',
          base: baseMember.summary,
          theirs: '',
          rowPayload: baseMember.payload,
        };
        if (remote) conflict.remote = remote;
        return conflict;
      }
      // set-add can't surface inline (the row doesn't exist in form),
      // so we don't return one here — the entity-level dialog handles it.
      return null;
    },
    [enabled, isDirty, liveEntity, dismissed, localInstanceId, adapter, entityType],
  );

  const getAutoMergeable = useCallback(
    (form: PathMap): Map<string, string> => {
      const out = new Map<string, string>();
      if (!enabled || !liveEntity) return out;
      const baseline = baselineRef.current;
      if (!baseline) return out;
      // Walk every baseline path. For each leaf where the user's value
      // matches baseline (untouched) AND live diverged, surface the
      // (path, live) pair so the caller can silently catch up. Whole-form
      // dirty no longer blocks per-leaf rebase — only THIS leaf being
      // dirty does. §6.2 killer-demo conformance.
      for (const path of Object.keys(baseline.paths)) {
        const base = overrides[path] ?? baseline.paths[path];
        if (base === undefined) continue;
        const local = form[path];
        if (local === undefined) continue;
        if (local !== base) continue; // user edited — not auto-mergeable
        const theirs = adapter.readPath(liveEntity, path);
        if (theirs === null) continue;
        if (theirs === base) continue; // no peer change
        out.set(path, theirs);
      }
      return out;
    },
    [enabled, liveEntity, overrides, adapter],
  );

  const getAutoMergeableSetOrders = useCallback(
    (
      form: PathMap,
      formSetOrders: ReadonlyMap<string, readonly string[]>,
    ): Map<string, readonly string[]> => {
      const out = new Map<string, readonly string[]>();
      if (!enabled || !liveEntity) return out;
      const baseline = baselineRef.current;
      if (!baseline) return out;
      const sensitivity = adapter.setOrderSensitivity?.() ?? new Map<string, boolean>();
      const liveSets = adapter.snapshotSets(liveEntity);
      for (const liveSnap of liveSets) {
        const setPath = liveSnap.setPath;
        const baselineOrder = setOrderOverrides.get(setPath) ?? baseline.setOrders.get(setPath);
        if (!baselineOrder) continue;
        const formOrder = formSetOrders.get(setPath);
        if (!formOrder) continue;
        // Order-sensitive set: refuse silent rebase when the user has
        // any leaf edit pending in this set. Falls through to the
        // dialog's `set-reorder` row so the user resolves the
        // semantic shift themselves rather than getting silently
        // re-positioned mid-edit.
        if (sensitivity.get(setPath) === true) {
          const setPrefix = `${setPath}.`;
          let inSetEditDirty = false;
          for (const path of Object.keys(baseline.paths)) {
            if (!path.startsWith(setPrefix)) continue;
            const base = overrides[path] ?? baseline.paths[path];
            const local = form[path];
            if (local !== undefined && local !== base) {
              inSetEditDirty = true;
              break;
            }
          }
          if (inSetEditDirty) continue;
        }
        const liveOrder = Array.from(liveSnap.byUid.keys());
        // Auto-rebase requires:
        //   - my form-order == baseline-order (I didn't reorder)
        //   - membership matches between my form and live (no add/remove
        //     side-effect on this rebase — those go through the dialog)
        //   - live order != baseline order (peer actually moved something)
        if (formOrder.length !== baselineOrder.length) continue;
        if (liveOrder.length !== formOrder.length) continue;
        let formMatchesBaseline = true;
        for (let i = 0; i < formOrder.length; i++) {
          if (formOrder[i] !== baselineOrder[i]) {
            formMatchesBaseline = false;
            break;
          }
        }
        if (!formMatchesBaseline) continue;
        let membershipMatches = true;
        for (const uid of liveSnap.byUid.keys()) {
          if (!formOrder.includes(uid)) {
            membershipMatches = false;
            break;
          }
        }
        if (!membershipMatches) continue;
        let orderMatches = true;
        for (let i = 0; i < liveOrder.length; i++) {
          if (liveOrder[i] !== formOrder[i]) {
            orderMatches = false;
            break;
          }
        }
        if (orderMatches) continue;
        out.set(setPath, liveOrder);
      }
      return out;
    },
    [enabled, liveEntity, adapter, setOrderOverrides, overrides],
  );

  const getConflict = useCallback(
    (path: string, localValue: string): PathConflict | null => {
      if (!enabled || !isDirty || !liveEntity) return null;
      if (dismissed.has(path)) return null;
      const baseline = baselineRef.current;
      if (!baseline) return null;
      const base = overrides[path] ?? baseline.paths[path];
      if (base === undefined) return null;
      const theirs = adapter.readPath(liveEntity, path);
      if (theirs === null) return null;
      if (localValue === theirs) return null;
      if (localValue === base) return null;
      if (theirs === base) return null;
      const mirror = getActiveAwarenessMirror();
      const remote = findRemoteAttribution(mirror, entityType, liveEntity.uid, path, localInstanceId, Date.now());
      return remote ? { base, theirs, remote } : { base, theirs };
    },
    [enabled, isDirty, liveEntity, dismissed, overrides, localInstanceId, adapter, entityType],
  );

  const getAllConflicts = useCallback(
    (form: PathMap, formSetOrders?: ReadonlyMap<string, readonly string[]>): Map<string, PathConflict> => {
      const out = new Map<string, PathConflict>();
      const baseline = baselineRef.current;
      if (!baseline) return out;
      if (!liveEntity || !enabled || !isDirty) return out;

      // Set-level membership diffs. Only meaningful when peers diverge
      // structurally (added/removed entire rows) — handled separately
      // from leaf scalars so the dialog can render them with their own
      // affordances.
      const liveSets = adapter.snapshotSets(liveEntity);
      const formSets = adapter.snapshotSetsFromForm(form, liveEntity);
      const baselineSets = adapter.snapshotSetsFromForm(baseline.paths, liveEntity);
      const baselineByPath = new Map(baselineSets.map((s) => [s.setPath, s.byUid]));
      const formByPath = new Map(formSets.map((s) => [s.setPath, s.byUid]));
      const mirror = getActiveAwarenessMirror();
      const now = Date.now();

      for (const live of liveSets) {
        const liveBy = live.byUid;
        const baseBy = baselineByPath.get(live.setPath) ?? new Map<string, SetMember>();
        const formBy = formByPath.get(live.setPath) ?? new Map<string, SetMember>();
        const allUids = new Set<string>([...liveBy.keys(), ...baseBy.keys(), ...formBy.keys()]);

        // Reorder detection — only meaningful when membership matches
        // exactly between live and form (otherwise add/remove already
        // covers the divergence). Order matters when execution order is
        // semantic (DNR last-write-wins on same header name; workflow
        // step ordering; etc.).
        const formOrder = formSetOrders?.get(live.setPath);
        if (formOrder && liveBy.size > 1 && liveBy.size === formBy.size) {
          let sameMembership = true;
          for (const uid of liveBy.keys()) {
            if (!formBy.has(uid)) {
              sameMembership = false;
              break;
            }
          }
          if (sameMembership) {
            const liveOrder = Array.from(liveBy.keys());
            const orderMatches =
              liveOrder.length === formOrder.length && liveOrder.every((uid, idx) => uid === formOrder[idx]);
            if (!orderMatches) {
              const key = _reorderKey(live.setPath);
              if (!dismissed.has(key)) {
                const summarize = (uids: readonly string[]) =>
                  uids
                    .map((uid) => {
                      const member = liveBy.get(uid);
                      const summary = member?.summary ?? uid;
                      const labelOnly = summary.split(/[:=]/)[0]?.trim() || uid;
                      return labelOnly;
                    })
                    .join(' → ');
                const remote = findRemoteAttribution(mirror, entityType, liveEntity.uid, key, localInstanceId, now);
                const conflict: PathConflict = {
                  kind: 'set-reorder',
                  base: summarize(formOrder),
                  theirs: summarize(liveOrder),
                  rowPayload: { savedOrder: liveOrder },
                };
                if (remote) conflict.remote = remote;
                out.set(key, conflict);
              }
            }
          }
        }

        for (const uid of allUids) {
          const liveMember = liveBy.get(uid);
          const baseMember = baseBy.get(uid);
          const formMember = formBy.get(uid);
          // saved-added: present in live, absent from baseline, absent from form
          if (liveMember && !baseMember && !formMember) {
            const key = _setKey(live.setPath, uid);
            if (dismissed.has(key)) continue;
            const remote = findRemoteAttribution(mirror, entityType, liveEntity.uid, key, localInstanceId, now);
            const conflict: PathConflict = {
              kind: 'set-add',
              base: '',
              theirs: liveMember.summary,
              rowPayload: liveMember.payload,
            };
            if (remote) conflict.remote = remote;
            out.set(key, conflict);
            continue;
          }
          // saved-removed: absent from live, present in baseline, present in form
          if (!liveMember && baseMember && formMember) {
            const key = _setKey(live.setPath, uid);
            if (dismissed.has(key)) continue;
            const remote = findRemoteAttribution(mirror, entityType, liveEntity.uid, key, localInstanceId, now);
            const conflict: PathConflict = {
              kind: 'set-remove',
              base: baseMember.summary,
              theirs: '',
              rowPayload: formMember.payload,
            };
            if (remote) conflict.remote = remote;
            out.set(key, conflict);
            continue;
          }
        }
      }

      // Leaf scalars — walk the union of baseline + form keys so newly
      // introduced local rows still surface in the aggregator.
      const keys = new Set<string>([...Object.keys(baseline.paths), ...Object.keys(form)]);
      for (const key of keys) {
        const local = form[key] ?? baseline.paths[key] ?? '';
        const conflict = getConflict(key, local);
        if (conflict) out.set(key, conflict);
      }

      // Kind-transition divergence: `union:<prefix>` keys are structural
      // markers (the discriminator lives outside the form's editable
      // leaves), so they surface whenever baseline ≠ live regardless of
      // whether the form locally edited them. When divergent, suppress
      // per-leaf paths under the same prefix from the output — the user
      // resolves the kind transition via Use Saved on the structural
      // conflict (whole-branch payload), not per-leaf values that don't
      // apply to the new branch.
      const divergentPrefixes: string[] = [];
      for (const key of Object.keys(baseline.paths)) {
        if (!key.startsWith('union:')) continue;
        if (dismissed.has(key)) continue;
        const base = overrides[key] ?? baseline.paths[key];
        const theirs = adapter.readPath(liveEntity, key);
        if (theirs === null) continue;
        if (theirs === base) continue;
        const remote = findRemoteAttribution(mirror, entityType, liveEntity.uid, key, localInstanceId, now);
        // Stash the live branch payload alongside the structural marker
        // so resolvers can perform whole-branch swaps on "Use saved"
        // (replace `entity[prefix-tail]` + write the new discriminator).
        // base/theirs stay as raw markers (JSON-stringified `{kind}`) so
        // the post-accept comparison `theirs === base` against the
        // override stays consistent with what `readPath` returns; the
        // dialog parses them down to friendly discriminator labels at
        // render time via `'union-swap'` kind handling.
        const prefix = key.slice('union:'.length);
        const branchInfo = adapter.readUnionBranchInfo?.(liveEntity, prefix) ?? undefined;
        const conflict: PathConflict = remote
          ? { kind: 'union-swap', base, theirs, remote }
          : { kind: 'union-swap', base, theirs };
        if (branchInfo) conflict.rowPayload = branchInfo;
        out.set(key, conflict);
        divergentPrefixes.push(prefix);
      }
      if (divergentPrefixes.length > 0) {
        for (const key of [...out.keys()]) {
          if (key.startsWith('union:')) continue;
          if (key.startsWith('reorder:')) continue;
          if (key.startsWith('set:')) continue;
          for (const prefix of divergentPrefixes) {
            if (key === prefix || key.startsWith(`${prefix}.`)) {
              out.delete(key);
              break;
            }
          }
        }
      }

      return out;
    },
    [getConflict, liveEntity, enabled, isDirty, dismissed, localInstanceId, adapter, entityType],
  );

  return useMemo(
    () => ({
      setBaseline,
      getConflict,
      getAllConflicts,
      getSetConflict,
      getAutoMergeable,
      getAutoMergeableSetOrders,
      acceptTheirs,
      acceptTheirsSetOrder,
      dismiss,
      clearDismissed,
      projectEntity,
    }),
    [
      setBaseline,
      getConflict,
      getAllConflicts,
      getSetConflict,
      getAutoMergeable,
      getAutoMergeableSetOrders,
      acceptTheirs,
      acceptTheirsSetOrder,
      dismiss,
      clearDismissed,
      projectEntity,
    ],
  );
}

// Re-export key codec helpers so per-entity resolve adapters consume
// them from one place.
export const isSetConflictKey = _isSet;
export const isReorderConflictKey = _isReorder;
export const decodeSetConflictKey = _decodeSet;
export const decodeReorderConflictKey = _decodeReorder;
