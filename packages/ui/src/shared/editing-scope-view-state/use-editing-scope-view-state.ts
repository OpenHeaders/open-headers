/**
 * useEditingScopeViewState — per-tab view state with default-donor inheritance.
 *
 * See `docs/PER_WINDOW_OR_TAB_VIEW_STATE_DESIGN.md` § 6 (protocol), § 7 (focus
 * tracking + claim predicate), § 9 (hook contract). This is the only
 * load + write surface for view-state in the extension; `useToolLayout`
 * and `usePanelToolLayout` consume it via the surface wrappers.
 *
 * Lifecycle:
 *   - Synchronous mount: read sessionStorage. Hit → use it; ready.
 *   - Async mount: read donor record. Hit (post-version-check) →
 *     hydrate state, write through to sessionStorage so reload
 *     survives. Miss → factoryDefault. Either way: ready.
 *   - First focus while donor record is empty (bootstrap path) →
 *     publish own snapshot.
 *   - State mutation while focused + visible → debounce-publish.
 *   - Donor record onChanged → flip `isDonor` reactively.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearDonorRecord, readDonorRecord, subscribeDonorRecord, writeDonorRecord } from '@openheaders/core/editing-scope';
import { isFocusedAndVisible, subscribeFocus } from './focus-tracker';
import { clearPerTabState, mintTabUid, readPerTabState, writePerTabState } from './tab-uid';
import type { DonorRecord, EditingScopeViewStateApi, UseEditingScopeViewStateOptions } from './types';

const PUBLISH_DEBOUNCE_MS = 500;

export function useEditingScopeViewState<T>(opts: UseEditingScopeViewStateOptions<T>): EditingScopeViewStateApi<T> {
  const { surface, schemaVersion, factoryDefault, normalize, resolveSnapshot, projectForDonor } = opts;

  // Snapshot of the synchronous sessionStorage read. Captured once on
  // first render so the initial `useState` and the donor-record async
  // load see the same answer (avoids a race where sessionStorage is
  // written between the two reads).
  const sessionSnap = useMemo(() => readPerTabState<T>(surface, schemaVersion), [surface, schemaVersion]);

  // Tab uid: reuse from sessionStorage when present (so reload keeps
  // the same identity), otherwise mint a new one.
  const tabUidRef = useRef<string>(sessionSnap?.tabUid ?? mintTabUid());

  const initialFromSession = useMemo<T | null>(() => {
    if (!sessionSnap) return null;
    return normalize ? normalize(sessionSnap.snapshot) : sessionSnap.snapshot;
  }, [sessionSnap, normalize]);

  // When a workspace-aware `resolveSnapshot` is provided, every load
  // path is async (resolver hits storage to read the active workspace
  // id), so the ready gate stays closed until the resolver returns —
  // even when sessionStorage hits. Without the resolver, the sync
  // sessionStorage path keeps its v1 fast-init behaviour.
  const hasResolver = resolveSnapshot !== undefined;

  const [snapshot, setSnapshot] = useState<T>(initialFromSession ?? factoryDefault);
  const [ready, setReady] = useState<boolean>(!hasResolver && initialFromSession !== null);
  const [isDonor, setIsDonor] = useState<boolean>(false);

  // Live ref so `onPersist` always sees the freshest snapshot — the
  // setter form of onPersist composes against this (not stale closure).
  const snapshotRef = useRef<T>(snapshot);
  snapshotRef.current = snapshot;

  // ── Async load + workspace-aware resolution ─────────────────────
  // ONE-SHOT mount-time effect. Three load paths (sessionStorage hit /
  // donor record / factoryDefault) piped through the optional async
  // resolver. After this resolves, `onPersist` is the single writer to
  // `snapshot` — re-running the resolver on later renders would
  // re-read the frozen mount-time sessionStorage snapshot and overwrite
  // any post-mount onPersist updates (visible in MWPT per-window-or-tab
  // mode as a "flash then revert" when the user switches the slice).
  // We capture the surface inputs in refs and gate the effect on a
  // single-fire ref so re-renders never re-load.
  const didResolveRef = useRef(false);
  const initialFromSessionRef = useRef(initialFromSession);
  const normalizeRef = useRef(normalize);
  const resolveSnapshotRef = useRef(resolveSnapshot);
  // Captured once so `publishDonor` stays stable; the projection is a pure
  // function of the snapshot, so the first value is the canonical one.
  const projectForDonorRef = useRef(projectForDonor);
  useEffect(() => {
    if (didResolveRef.current) return;
    didResolveRef.current = true;
    let cancelled = false;

    async function loadAndResolve() {
      let raw: T;
      const initial = initialFromSessionRef.current;
      const normalizeFn = normalizeRef.current;
      const resolveFn = resolveSnapshotRef.current;
      if (initial !== null) {
        raw = initial;
      } else {
        const rec = await readDonorRecord<T>(surface, schemaVersion);
        if (cancelled) return;
        if (rec) {
          raw = normalizeFn ? normalizeFn(rec.snapshot) : rec.snapshot;
        } else {
          raw = snapshotRef.current; // factoryDefault from useState init
        }
      }

      const resolved = resolveFn ? await resolveFn(raw) : raw;
      if (cancelled) return;

      snapshotRef.current = resolved;
      setSnapshot(resolved);
      writePerTabState(surface, schemaVersion, tabUidRef.current, resolved);
      setReady(true);
    }

    void loadAndResolve();
    return () => {
      cancelled = true;
    };
  }, [surface, schemaVersion]);

  // ── Donor election: publish helper (BC-V1 guard) ────────────────
  const publishDonor = useCallback(
    async (snap: T) => {
      // BC-V1: Donor-claim guard — visibilityState === 'visible' && hasFocus()
      if (!isFocusedAndVisible()) return;
      // Project out session-local fields so a fresh tab inherits only the
      // shareable slice (e.g. layout), never this tab's ephemeral content.
      const project = projectForDonorRef.current;
      const record: DonorRecord<T> = {
        donorTabUid: tabUidRef.current,
        schemaVersion,
        snapshot: project ? project(snap) : snap,
        publishedAt: Date.now(),
      };
      await writeDonorRecord(surface, record);
    },
    [surface, schemaVersion],
  );

  // ── Donor election: bootstrap path ──────────────────────────────
  // On first focus after ready, if no donor record exists, claim it.
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let bootstrapAttempted = false;

    async function maybeBootstrap() {
      if (bootstrapAttempted) return;
      if (!isFocusedAndVisible()) return;
      bootstrapAttempted = true;
      const existing = await readDonorRecord(surface, schemaVersion);
      if (cancelled) return;
      if (!existing) {
        // BC-V1 guard composes here: bootstrap || mutation.
        await publishDonor(snapshotRef.current);
      } else {
        setIsDonor(existing.donorTabUid === tabUidRef.current);
      }
    }

    void maybeBootstrap();
    const unsub = subscribeFocus(() => {
      void maybeBootstrap();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [ready, surface, schemaVersion, publishDonor]);

  // ── Reactive isDonor — donor-record subscription ────────────────
  useEffect(() => {
    return subscribeDonorRecord<T>(surface, schemaVersion, (rec) => {
      setIsDonor(rec ? rec.donorTabUid === tabUidRef.current : false);
    });
  }, [surface, schemaVersion]);

  // ── Debounced publish on mutation-while-focused ─────────────────
  const publishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
    };
  }, []);

  const schedulePublish = useCallback(
    (snap: T) => {
      if (publishTimerRef.current) clearTimeout(publishTimerRef.current);
      publishTimerRef.current = setTimeout(() => {
        // BC-V1: re-check the predicate at fire time so a tab that
        // backgrounded during the debounce window doesn't publish.
        void publishDonor(snap);
      }, PUBLISH_DEBOUNCE_MS);
    },
    [publishDonor],
  );

  // ── onPersist (setter form) ─────────────────────────────────────
  const onPersist = useCallback(
    (updater: (prev: T) => T) => {
      const next = updater(snapshotRef.current);
      snapshotRef.current = next;
      setSnapshot(next);
      writePerTabState(surface, schemaVersion, tabUidRef.current, next);
      // BC-V1 guard: schedule publish only on mutation-while-focused.
      // The fire-time check inside `publishDonor` is the second half.
      if (isFocusedAndVisible()) schedulePublish(next);
    },
    [surface, schemaVersion, schedulePublish],
  );

  const claimDonor = useCallback(() => {
    void publishDonor(snapshotRef.current);
  }, [publishDonor]);

  const resetToDefaults = useCallback(() => {
    // Reset is a global op (design § 11.2): wipe the donor record so
    // every tab's next mutation re-publishes. Local sessionStorage is
    // wiped + reload re-initializes downstream hooks (design § 11.1).
    clearPerTabState(surface);
    void clearDonorRecord(surface);
    if (typeof window !== 'undefined') window.location.reload();
  }, [surface]);

  return {
    initial: snapshot,
    onPersist,
    ready,
    isDonor,
    claimDonor,
    resetToDefaults,
  };
}
