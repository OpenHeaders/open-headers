/**
 * useLiveVariableMutator — write-only API for live-variable edits.
 *
 * Thin React adapter over `live-variable-write-client.ts`. Mirrors
 * `useTemplateMutator` shape — every memoised callback closes over
 * `(workspaceId, surfaceId)` so a workspace switch produces a fresh
 * function reference.
 */

import { useCallback, useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyLiveVariableCreate,
  applyLiveVariableDelete,
  applyLiveVariableUpdate,
  type LiveVariableMutationResult,
  type LiveVariableSimpleResult,
  type LiveVariableUpdates,
} from '@/shared/sync/live-variable-write-client';

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

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useLiveVariableMutator(opts: UseLiveVariableMutatorOptions): UseLiveVariableMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateLiveVariable = useCallback<UseLiveVariableMutatorApi['updateLiveVariable']>(
    async (uid, updates) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLiveVariableUpdate(uid, updates, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createLiveVariable = useCallback<UseLiveVariableMutatorApi['createLiveVariable']>(
    async (liveVariable) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLiveVariableCreate(liveVariable, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteLiveVariable = useCallback<UseLiveVariableMutatorApi['deleteLiveVariable']>(
    async (uid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLiveVariableDelete(uid, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ updateLiveVariable, createLiveVariable, deleteLiveVariable }),
    [updateLiveVariable, createLiveVariable, deleteLiveVariable],
  );
}
