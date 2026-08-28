/**
 * PauseMarkersContext — pause-markers singleton-entity provider.
 *
 * Mirrors `VaultContext` (per MWPT-FULL § 8.3.9 — singleton-with-storage-key
 * baseline). Pause markers are keyed by CONTAINER UID (collection /
 * folder) and projected to `wsKeys(workspaceId).pauseMarkers` AND owned
 * as a sync-engine singleton entity exposed via
 * `oh.sync.snapshotPauseMarkers` + per-workspace `PauseMarkersSyncMirror`.
 *
 *   - Override branch: reads `wsKeys(workspaceId).pauseMarkers` via
 *     `hostStorage.subscribe`; writes route through
 *     `pause-markers-write-client` with the explicit workspaceId. Diverged
 *     tabs editing W2 see and write to W2's markers, regardless of
 *     runtime-Active.
 *   - Legacy branch: reads `wsKeys(useActiveWorkspaceId()).pauseMarkers`
 *     (re-binds on `workspaceChanged`); writes route through Phase B with
 *     the active workspace id.
 *
 * This provider owns the raw marker primitives (set / clear / prune).
 * Resolution against the tree — "is this node paused?", the smart
 * toggle, clearing a subtree — lives in `RuleContext`, which holds the
 * collection trees the parent chain is read from.
 *
 * A version-1 record at rest (path-keyed, no `entries`) reads as empty
 * here; the SW's projection rewrites the key in the current shape on
 * its first pass, which is what this subscription then sees.
 *
 * No § 4.1.c residual: pause markers have no active/default pointer concept
 * so the migration covers all writes.
 */

import { useActiveWorkspaceId } from '../shared/hooks/readers/useActiveWorkspaceId';
import type { PauseMarker, PauseMarkerEntry, PauseMarkerRef } from '@openheaders/core/utils';
import { pauseMarkersFromEntries } from '@openheaders/core/utils';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import { isPauseMarkersRecord } from '@openheaders/core/sync-builders/projections/pause-markers-projection';
import {
  applyPauseMarkerClear,
  applyPauseMarkerSet,
  applyPauseMarkersReplacement,
} from '../shared/sync/pause-markers-write-client';

const EMPTY_ENTRIES: readonly PauseMarkerEntry[] = [];
const EMPTY_MARKERS: ReadonlyMap<string, PauseMarker> = new Map();

/** The container a pause gesture targets: its ref plus its current path (the version-1 reader hint). */
export interface PauseTarget extends PauseMarkerRef {
  path: string;
}

export interface PauseMarkersContextValue {
  /** Container uid → marker. */
  pauseMarkers: ReadonlyMap<string, PauseMarker>;
  entries: readonly PauseMarkerEntry[];
  isReady: boolean;
  /** Put an explicit marker on a container. */
  setMarker: (target: PauseTarget, marker: PauseMarker) => void;
  /** Remove the explicit marker on a container so it inherits from its parent. */
  clearMarker: (uid: string) => void;
  /** Remove the explicit markers on every listed container in one batch. */
  clearMarkers: (uids: readonly string[]) => void;
  /** Drop every marker whose container is not in `keepUids` — the stale-marker pruning effect. */
  pruneMarkers: (keepUids: ReadonlySet<string>) => void;
}

const defaultContextValue: PauseMarkersContextValue = {
  pauseMarkers: EMPTY_MARKERS,
  entries: EMPTY_ENTRIES,
  isReady: false,
  setMarker: () => {},
  clearMarker: () => {},
  clearMarkers: () => {},
  pruneMarkers: () => {},
};

export const PauseMarkersContext = createContext<PauseMarkersContextValue>(defaultContextValue);

interface PauseMarkersProviderProps {
  children: React.ReactNode;
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop
   * (BC-MWPT-FULL-1-pausemarkers).
   */
  activeWorkspaceIdOverride?: string | null;
}

function entriesOf(record: unknown): PauseMarkerEntry[] {
  return isPauseMarkersRecord(record) ? record.entries : [];
}

export const PauseMarkersProvider: React.FC<PauseMarkersProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const activeWorkspaceId = useActiveWorkspaceId();
  const readWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : activeWorkspaceId;
  const writeWorkspaceId = readWorkspaceId;

  const [entries, setEntries] = useState<PauseMarkerEntry[]>([]);
  const [isReady, setIsReady] = useState(false);
  const readIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Both branches subscribe to `wsKeys(readWorkspaceId).pauseMarkers`.
  // The override branch's id comes from the prop; the legacy branch's
  // id comes from `useActiveWorkspaceId()`, which re-binds on
  // `workspaceChanged` broadcasts. The mirror-driven cache layer
  // writes the storage key on every oracle broadcast; this listener
  // is the read path.

  useEffect(() => {
    const wsId = readWorkspaceId;
    readIdRef.current = wsId;
    if (!wsId) {
      setEntries([]);
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void hostStorage.get(wsKeys(wsId).pauseMarkers).then((record) => {
      if (readIdRef.current !== wsId) return;
      setEntries(entriesOf(record));
      setIsReady(true);
    });
    return hostStorage.subscribe(wsKeys(wsId).pauseMarkers, (record) => {
      setEntries(entriesOf(record));
    });
  }, [readWorkspaceId]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Optimistic local apply + Phase B fire-and-forget. The cache
  // broadcasts via the host storage layer's change events; the read-path
  // subscriber corrects any divergence.

  const setMarker = useCallback(
    (target: PauseTarget, marker: PauseMarker) => {
      const wsId = writeWorkspaceId;
      const entry: PauseMarkerEntry = { type: target.type, uid: target.uid, marker, path: target.path };
      setEntries((prev) => [...prev.filter((e) => e.uid !== target.uid), entry]);
      if (wsId) {
        void applyPauseMarkerSet(entry, { workspaceId: wsId, surfaceId }).catch(() => undefined);
      }
    },
    [writeWorkspaceId, surfaceId],
  );

  const clearMarker = useCallback(
    (uid: string) => {
      const wsId = writeWorkspaceId;
      setEntries((prev) => {
        if (!prev.some((e) => e.uid === uid)) return prev;
        return prev.filter((e) => e.uid !== uid);
      });
      if (wsId) {
        void applyPauseMarkerClear({ uid }, { workspaceId: wsId, surfaceId }).catch(() => undefined);
      }
    },
    [writeWorkspaceId, surfaceId],
  );

  const replaceWith = useCallback(
    (keep: (entry: PauseMarkerEntry) => boolean) => {
      const wsId = writeWorkspaceId;
      setEntries((prev) => {
        const next = prev.filter(keep);
        if (next.length === prev.length) return prev;
        if (wsId) {
          void applyPauseMarkersReplacement(next, { workspaceId: wsId, surfaceId }).catch(() => undefined);
        }
        return next;
      });
    },
    [writeWorkspaceId, surfaceId],
  );

  const clearMarkers = useCallback(
    (uids: readonly string[]) => {
      const drop = new Set(uids);
      replaceWith((entry) => !drop.has(entry.uid));
    },
    [replaceWith],
  );

  const pruneMarkers = useCallback(
    (keepUids: ReadonlySet<string>) => {
      replaceWith((entry) => keepUids.has(entry.uid));
    },
    [replaceWith],
  );

  const pauseMarkers = useMemo(() => pauseMarkersFromEntries(entries), [entries]);

  const value = useMemo<PauseMarkersContextValue>(
    () => ({ pauseMarkers, entries, isReady, setMarker, clearMarker, clearMarkers, pruneMarkers }),
    [pauseMarkers, entries, isReady, setMarker, clearMarker, clearMarkers, pruneMarkers],
  );

  return <PauseMarkersContext.Provider value={value}>{children}</PauseMarkersContext.Provider>;
};

export function usePauseMarkersContext(): PauseMarkersContextValue {
  return useContext(PauseMarkersContext);
}
