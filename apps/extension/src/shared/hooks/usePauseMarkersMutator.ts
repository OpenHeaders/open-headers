/**
 * usePauseMarkersMutator — write-only API for pause-marker toggles.
 *
 * Thin React adapter over `pause-markers-write-client.ts`. Singleton
 * entity — none of the helpers take an entity id.
 */

import type { PauseMarkerKind } from '@openheaders/core/sync';
import { useMemo } from 'react';
import {
  applyPauseMarkerClear,
  applyPauseMarkerSet,
  applyPauseMarkersReplacement,
  type PauseMarkersResult,
} from '@/shared/sync/pause-markers-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

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

export function usePauseMarkersMutator(
  opts: UsePauseMarkersMutatorOptions,
): UsePauseMarkersMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setMarker = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, path: string, marker: PauseMarkerKind) =>
      applyPauseMarkerSet({ path, marker }, writeOpts),
  );

  const clearMarker = useGuardedMutation(workspaceId, surfaceId, (writeOpts, path: string) =>
    applyPauseMarkerClear({ path }, writeOpts),
  );

  const replaceMarkers = useGuardedMutation<
    [ReadonlyMap<string, PauseMarkerKind> | Readonly<Record<string, PauseMarkerKind>>],
    PauseMarkersResult
  >(workspaceId, surfaceId, (writeOpts, next) =>
    applyPauseMarkersReplacement(next, writeOpts),
  );

  return useMemo(
    () => ({ setMarker, clearMarker, replaceMarkers }),
    [setMarker, clearMarker, replaceMarkers],
  );
}
