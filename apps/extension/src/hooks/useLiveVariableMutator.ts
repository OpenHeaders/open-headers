/**
 * useLiveVariableMutator — write-only API for live-variable edits.
 *
 * Thin React adapter over `live-variable-write-client.ts`.
 */

import { useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyLiveVariableCreate,
  applyLiveVariableDelete,
  applyLiveVariableUpdate,
  type LiveVariableMutationResult,
  type LiveVariableSimpleResult,
  type LiveVariableUpdates,
} from '@/shared/sync/live-variable-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { LiveVariableMutationResult, LiveVariableSimpleResult, LiveVariableUpdates };

export interface UseLiveVariableMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseLiveVariableMutatorApi {
  updateLiveVariable(
    liveVariableUid: string,
    updates: LiveVariableUpdates,
  ): Promise<LiveVariableMutationResult>;
  createLiveVariable(liveVariable: V5.LiveVariable): Promise<LiveVariableSimpleResult>;
  deleteLiveVariable(liveVariableUid: string): Promise<LiveVariableSimpleResult>;
}

export function useLiveVariableMutator(
  opts: UseLiveVariableMutatorOptions,
): UseLiveVariableMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateLiveVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, uid: string, updates: LiveVariableUpdates) =>
      applyLiveVariableUpdate(uid, updates, writeOpts),
  );

  const createLiveVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, liveVariable: V5.LiveVariable) =>
      applyLiveVariableCreate(liveVariable, writeOpts),
  );

  const deleteLiveVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, uid: string) => applyLiveVariableDelete(uid, writeOpts),
  );

  return useMemo(
    () => ({ updateLiveVariable, createLiveVariable, deleteLiveVariable }),
    [updateLiveVariable, createLiveVariable, deleteLiveVariable],
  );
}
