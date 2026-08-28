/**
 * usePauseMarkersMutator — write-only API for pause-marker toggles.
 *
 * Thin React adapter over `pause-markers-write-client.ts`. Singleton
 * entity — none of the helpers take an entity id.
 */

import type { PauseMarkerEntry } from '@openheaders/core/sync';
import {
  applyPauseMarkerClear,
  applyPauseMarkerSet,
  applyPauseMarkersReplacement,
  type PauseMarkersResult,
} from '@openheaders/ui/shared/sync/pause-markers-write-client';
import { useMemo } from 'react';
import { useGuardedMutation } from './use-guarded-mutation';

export type { PauseMarkersResult };

export interface UsePauseMarkersMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UsePauseMarkersMutatorApi {
  setMarker(entry: PauseMarkerEntry): Promise<PauseMarkersResult>;
  clearMarker(uid: string): Promise<PauseMarkersResult>;
  /** Replace the full pause-markers set — see `applyPauseMarkersReplacement`. */
  replaceMarkers(next: readonly PauseMarkerEntry[]): Promise<PauseMarkersResult>;
}

export function usePauseMarkersMutator(opts: UsePauseMarkersMutatorOptions): UsePauseMarkersMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const setMarker = useGuardedMutation(workspaceId, surfaceId, (writeOpts, entry: PauseMarkerEntry) =>
    applyPauseMarkerSet(entry, writeOpts),
  );

  const clearMarker = useGuardedMutation(workspaceId, surfaceId, (writeOpts, uid: string) =>
    applyPauseMarkerClear({ uid }, writeOpts),
  );

  const replaceMarkers = useGuardedMutation<[readonly PauseMarkerEntry[]], PauseMarkersResult>(
    workspaceId,
    surfaceId,
    (writeOpts, next) => applyPauseMarkersReplacement(next, writeOpts),
  );

  return useMemo(() => ({ setMarker, clearMarker, replaceMarkers }), [setMarker, clearMarker, replaceMarkers]);
}
