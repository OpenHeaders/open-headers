/**
 * useEditingScopeViewState — per-tab view state with default-donor inheritance.
 *
 * See `docs/PER_TAB_VIEW_STATE_DESIGN.md` § 6 (protocol), § 7 (focus
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
import { clearDonorRecord, readDonorRecord, subscribeDonorRecord, writeDonorRecord } from './donor-record';
import { isFocusedAndVisible, subscribeFocus } from './focus-tracker';
import { clearPerTabState, mintTabUid, readPerTabState, writePerTabState } from './tab-uid';
import type { DonorRecord, EditingScopeViewStateApi, UseEditingScopeViewStateOptions } from './types';

const PUBLISH_DEBOUNCE_MS = 500;

export function useEditingScopeViewState<T>(opts: UseEditingScopeViewStateOptions<T>): EditingScopeViewStateApi<T> {
  const { surface, schemaVersion, factoryDefault, normalize, resolveSnapshot } = opts;

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
  // Single effect handles three load paths (sessionStorage hit / donor
  // record / factoryDefault) and pipes each through the optional async
  // resolver. The `cancelled` guard absorbs unmount during the await.
  useEffect(() => {
    let cancelled = false;

    async function loadAndResolve() {
      let raw: T;
      if (initialFromSession !== null) {
        raw = initialFromSession;
      } else {
        const rec = await readDonorRecord<T>(surface, schemaVersion);
        if (cancelled) return;
        if (rec) {
          raw = normalize ? normalize(rec.snapshot) : rec.snapshot;
        } else {
          raw = snapshotRef.current; // factoryDefault from useState init
        }
      }

      const resolved = resolveSnapshot ? await resolveSnapshot(raw) : raw;
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
  }, [initialFromSession, surface, schemaVersion, normalize, resolveSnapshot]);

  // ── Donor election: publish helper (BC-V1 guard) ────────────────
  const publishDonor = useCallback(
    async (snap: T) => {
      // BC-V1: Donor-claim guard — visibilityState === 'visible' && hasFocus()
      if (!isFocusedAndVisible()) return;
      const record: DonorRecord<T> = {
        donorTabUid: tabUidRef.current,
        schemaVersion,
        snapshot: snap,
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

  // ── Reactive isDonor — chrome.storage.onChanged subscription ────
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
