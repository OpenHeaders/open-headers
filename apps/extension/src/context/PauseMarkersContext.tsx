/**
 * PauseMarkersContext — pause-markers singleton-entity provider.
 *
 * Mirrors `VaultContext` (per MWPT-FULL § 8.3.9 — singleton-with-storage-key
 * baseline). Pause markers are a path → 'paused' | 'unpaused' map projected
 * to `wsKeys(workspaceId).pauseMarkers` AND owned as a sync-engine singleton
 * entity exposed via `oh.sync.snapshotPauseMarkers` + per-workspace
 * `PauseMarkersSyncMirror`.
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
 * No § 4.1.c residual: pause markers have no active/default pointer concept
 * so the migration covers all writes.
 */

import { useActiveWorkspaceId } from '@hooks/useActiveWorkspaceId';
import type { PauseMarker } from '@openheaders/core/utils';
import { resolvePauseState } from '@openheaders/core/utils';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import {
  applyPauseMarkerClear,
  applyPauseMarkerSet,
  applyPauseMarkersReplacement,
} from '@/shared/sync/pause-markers-write-client';

const EMPTY_MARKERS: ReadonlyMap<string, PauseMarker> = new Map();

export interface PauseMarkersContextValue {
  pauseMarkers: ReadonlyMap<string, PauseMarker>;
  isReady: boolean;
  /** Smart toggle — flips effective pause state by setting the opposite marker. */
  togglePause: (path: string) => void;
  /** Remove the explicit marker on `path` so it inherits from its parent. */
  clearPauseOverride: (path: string) => void;
  /** Remove every marker strictly below `path`. */
  clearNestedPauseOverrides: (path: string) => void;
  /** Replace the entire map — used by the stale-marker pruning effect. */
  replaceMarkers: (next: ReadonlyMap<string, PauseMarker>) => void;
}

const defaultContextValue: PauseMarkersContextValue = {
  pauseMarkers: EMPTY_MARKERS,
  isReady: false,
  togglePause: () => {},
  clearPauseOverride: () => {},
  clearNestedPauseOverrides: () => {},
  replaceMarkers: () => {},
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

export const PauseMarkersProvider: React.FC<PauseMarkersProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const activeWorkspaceId = useActiveWorkspaceId();
  const readWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : activeWorkspaceId;
  const writeWorkspaceId = readWorkspaceId;

  const [pauseMarkers, setPauseMarkers] = useState<Map<string, PauseMarker>>(() => new Map());
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
      setPauseMarkers(new Map());
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void hostStorage.get(wsKeys(wsId).pauseMarkers).then((record) => {
      if (readIdRef.current !== wsId) return;
      setPauseMarkers(record ? new Map(Object.entries(record)) : new Map());
      setIsReady(true);
    });
    return hostStorage.subscribe(wsKeys(wsId).pauseMarkers, (record) => {
      setPauseMarkers(record ? new Map(Object.entries(record)) : new Map());
    });
  }, [readWorkspaceId]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Optimistic local apply + Phase B fire-and-forget. The cache
  // broadcasts via `chrome.storage.local.onChanged`; the read-path
  // subscriber corrects any divergence.

  const togglePause = useCallback(
    (path: string) => {
      const wsId = writeWorkspaceId;
      setPauseMarkers((prev) => {
        const currentlyPaused = resolvePauseState(path, prev);
        const marker: PauseMarker = currentlyPaused ? 'unpaused' : 'paused';
        const next = new Map(prev);
        next.set(path, marker);
        if (wsId) {
          void applyPauseMarkerSet({ path, marker }, { workspaceId: wsId, surfaceId }).catch(() => undefined);
        }
        return next;
      });
    },
    [writeWorkspaceId, surfaceId],
  );

  const clearPauseOverride = useCallback(
    (path: string) => {
      const wsId = writeWorkspaceId;
      setPauseMarkers((prev) => {
        if (!prev.has(path)) return prev;
        const next = new Map(prev);
        next.delete(path);
        if (wsId) {
          void applyPauseMarkerClear({ path }, { workspaceId: wsId, surfaceId }).catch(() => undefined);
        }
        return next;
      });
    },
    [writeWorkspaceId, surfaceId],
  );

  const clearNestedPauseOverrides = useCallback(
    (path: string) => {
      const wsId = writeWorkspaceId;
      setPauseMarkers((prev) => {
        const prefix = `${path}/`;
        const next = new Map<string, PauseMarker>();
        for (const [key, value] of prev) {
          if (!key.startsWith(prefix)) next.set(key, value);
        }
        if (wsId && next.size !== prev.size) {
          void applyPauseMarkersReplacement(next, { workspaceId: wsId, surfaceId }).catch(() => undefined);
        }
        return next;
      });
    },
    [writeWorkspaceId, surfaceId],
  );

  const replaceMarkers = useCallback(
    (next: ReadonlyMap<string, PauseMarker>) => {
      const wsId = writeWorkspaceId;
      const nextMap = new Map(next);
      setPauseMarkers(nextMap);
      if (wsId) {
        void applyPauseMarkersReplacement(nextMap, { workspaceId: wsId, surfaceId }).catch(() => undefined);
      }
    },
    [writeWorkspaceId, surfaceId],
  );

  const value = useMemo<PauseMarkersContextValue>(
    () => ({ pauseMarkers, isReady, togglePause, clearPauseOverride, clearNestedPauseOverrides, replaceMarkers }),
    [pauseMarkers, isReady, togglePause, clearPauseOverride, clearNestedPauseOverrides, replaceMarkers],
  );

  return <PauseMarkersContext.Provider value={value}>{children}</PauseMarkersContext.Provider>;
};

export function usePauseMarkersContext(): PauseMarkersContextValue {
  return useContext(PauseMarkersContext);
}
