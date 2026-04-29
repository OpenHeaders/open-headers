/**
 * usePauseMarkersMutator — write-only API for pause-marker toggles.
 *
 * Thin React adapter over the imperative helpers in
 * `pause-markers-write-client.ts`. Mirrors `useVaultMutator`. Every
 * memoised callback closes over the `(workspaceId, surfaceId)` pair so
 * a workspace switch produces fresh function references and any
 * in-flight envelope carries the workspace id it was minted under.
 *
 * Singleton entity — none of the helpers take an entity id.
 */

import type { PauseMarkerKind } from '@openheaders/core/sync';
import { useCallback, useMemo } from 'react';
import {
  applyPauseMarkerClear,
  applyPauseMarkerSet,
  applyPauseMarkersReplacement,
  type PauseMarkersResult,
} from '@/shared/sync/pause-markers-write-client';

export type { PauseMarkersResult };

export interface UsePauseMarkersMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UsePauseMarkersMutatorApi {
  setMarker(path: string, marker: PauseMarkerKind): Promise<PauseMarkersResult>;
  clearMarker(path: string): Promise<PauseMarkersResult>;
  /** Replace the full pause-markers map — see `applyPauseMarkersReplacement`. */
  replaceMarkers(
    next: ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>,
  ): Promise<PauseMarkersResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function usePauseMarkersMutator(
  opts: UsePauseMarkersMutatorOptions,
): UsePauseMarkersMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setMarker = useCallback<UsePauseMarkersMutatorApi['setMarker']>(
    async (path, marker) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyPauseMarkerSet({ path, marker }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const clearMarker = useCallback<UsePauseMarkersMutatorApi['clearMarker']>(
    async (path) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyPauseMarkerClear({ path }, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const replaceMarkers = useCallback<UsePauseMarkersMutatorApi['replaceMarkers']>(
    async (next) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyPauseMarkersReplacement(next, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ setMarker, clearMarker, replaceMarkers }),
    [setMarker, clearMarker, replaceMarkers],
  );
}
