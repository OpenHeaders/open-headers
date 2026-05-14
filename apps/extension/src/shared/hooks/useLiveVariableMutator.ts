/**
 * useLiveVariableMutator — write-only API for live-variable edits.
 *
 * Thin React adapter over `live-variable-write-client.ts`.
 */

import { useMemo } from 'react';
import type { LiveVariable } from '@openheaders/core/types';
import {
  applyLiveVariableCreate,
  applyLiveVariableDelete,
  applyLiveVariablePublish,
  applyLiveVariableUpdate,
  type LiveVariableMutationResult,
  type LiveVariableSimpleResult,
  type LiveVariableUpdates,
} from '@openheaders/ui/shared/sync/live-variable-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { LiveVariableMutationResult, LiveVariableSimpleResult, LiveVariableUpdates };

export interface UseLiveVariableMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export type LiveVariableSeed = Omit<LiveVariable, 'uid' | 'path' | 'schemaVersion'>;

export interface UseLiveVariableMutatorApi {
  updateLiveVariable(
    liveVariableUid: string,
    updates: LiveVariableUpdates,
  ): Promise<LiveVariableMutationResult>;
  createLiveVariable(request: {
    liveVariable: LiveVariableSeed;
    parentPath: string;
  }): Promise<LiveVariableMutationResult>;
  publishLiveVariable(liveVariableUid: string): Promise<LiveVariableSimpleResult>;
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
    (writeOpts, request: { liveVariable: LiveVariableSeed; parentPath: string }) =>
      applyLiveVariableCreate(request, writeOpts),
  );

  const publishLiveVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, uid: string) => applyLiveVariablePublish(uid, writeOpts),
  );

  const deleteLiveVariable = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, uid: string) => applyLiveVariableDelete(uid, writeOpts),
  );

  return useMemo(
    () => ({ updateLiveVariable, createLiveVariable, publishLiveVariable, deleteLiveVariable }),
    [updateLiveVariable, createLiveVariable, publishLiveVariable, deleteLiveVariable],
  );
}
