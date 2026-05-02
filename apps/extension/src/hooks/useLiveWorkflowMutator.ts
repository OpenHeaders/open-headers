/**
 * useLiveWorkflowMutator — write-only API for live-workflow edits.
 *
 * Thin React adapter over `live-workflow-write-client.ts`.
 */

import { useMemo } from 'react';
import type { V5 } from '@openheaders/core/types';
import {
  applyLiveWorkflowCreate,
  applyLiveWorkflowDelete,
  applyLiveWorkflowPublish,
  applyLiveWorkflowUpdate,
  type LiveWorkflowMutationResult,
  type LiveWorkflowSimpleResult,
  type LiveWorkflowUpdates,
} from '@/shared/sync/live-workflow-write-client';
import { useGuardedMutation } from './use-guarded-mutation';

export type { LiveWorkflowMutationResult, LiveWorkflowSimpleResult, LiveWorkflowUpdates };

export interface UseLiveWorkflowMutatorOptions {
  workspaceId: string | null;
  surfaceId: string;
}

export type LiveWorkflowSeed = Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>;

export interface UseLiveWorkflowMutatorApi {
  updateLiveWorkflow(
    workflowUid: string,
    updates: LiveWorkflowUpdates,
  ): Promise<LiveWorkflowMutationResult>;
  createLiveWorkflow(request: {
    workflow: LiveWorkflowSeed;
    parentPath: string;
  }): Promise<LiveWorkflowMutationResult>;
  publishLiveWorkflow(workflowUid: string): Promise<LiveWorkflowSimpleResult>;
  deleteLiveWorkflow(workflowUid: string): Promise<LiveWorkflowSimpleResult>;
}

export function useLiveWorkflowMutator(
  opts: UseLiveWorkflowMutatorOptions,
): UseLiveWorkflowMutatorApi {
  const { workspaceId, surfaceId } = opts;

  const updateLiveWorkflow = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, uid: string, updates: LiveWorkflowUpdates) =>
      applyLiveWorkflowUpdate(uid, updates, writeOpts),
  );

  const createLiveWorkflow = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, request: { workflow: LiveWorkflowSeed; parentPath: string }) =>
      applyLiveWorkflowCreate(request, writeOpts),
  );

  const publishLiveWorkflow = useGuardedMutation(
    workspaceId,
    surfaceId,
    (writeOpts, uid: string) => applyLiveWorkflowPublish(uid, writeOpts),
  );

  const deleteLiveWorkflow = useGuardedMutation(workspaceId, surfaceId, (writeOpts, uid: string) =>
    applyLiveWorkflowDelete(uid, writeOpts),
  );

  return useMemo(
    () => ({ updateLiveWorkflow, createLiveWorkflow, publishLiveWorkflow, deleteLiveWorkflow }),
    [updateLiveWorkflow, createLiveWorkflow, publishLiveWorkflow, deleteLiveWorkflow],
  );
}
