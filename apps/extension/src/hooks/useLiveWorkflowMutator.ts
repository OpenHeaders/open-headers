/**
 * useLiveWorkflowMutator — write-only API for live-workflow edits.
 *
 * Thin React adapter over `live-workflow-write-client.ts`.
 */

import { useCallback, useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyLiveWorkflowCreate,
  applyLiveWorkflowDelete,
  applyLiveWorkflowUpdate,
  type LiveWorkflowMutationResult,
  type LiveWorkflowSimpleResult,
  type LiveWorkflowUpdates,
} from '@/shared/sync/live-workflow-write-client';

export type { LiveWorkflowMutationResult, LiveWorkflowSimpleResult, LiveWorkflowUpdates };

export interface UseLiveWorkflowMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export interface UseLiveWorkflowMutatorApi {
  updateLiveWorkflow(
    workflowUid: string,
    updates: LiveWorkflowUpdates,
  ): Promise<LiveWorkflowMutationResult>;
  createLiveWorkflow(workflow: V5.LiveWorkflow): Promise<LiveWorkflowSimpleResult>;
  deleteLiveWorkflow(workflowUid: string): Promise<LiveWorkflowSimpleResult>;
}

const NO_WORKSPACE = { ok: false, reason: 'other', message: 'no active workspace' } as const;

export function useLiveWorkflowMutator(opts: UseLiveWorkflowMutatorOptions): UseLiveWorkflowMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateLiveWorkflow = useCallback<UseLiveWorkflowMutatorApi['updateLiveWorkflow']>(
    async (uid, updates) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLiveWorkflowUpdate(uid, updates, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const createLiveWorkflow = useCallback<UseLiveWorkflowMutatorApi['createLiveWorkflow']>(
    async (workflow) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLiveWorkflowCreate(workflow, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  const deleteLiveWorkflow = useCallback<UseLiveWorkflowMutatorApi['deleteLiveWorkflow']>(
    async (uid) => {
      if (!workspaceId) return NO_WORKSPACE;
      return applyLiveWorkflowDelete(uid, { workspaceId, surfaceId });
    },
    [workspaceId, surfaceId],
  );

  return useMemo(
    () => ({ updateLiveWorkflow, createLiveWorkflow, deleteLiveWorkflow }),
    [updateLiveWorkflow, createLiveWorkflow, deleteLiveWorkflow],
  );
}
