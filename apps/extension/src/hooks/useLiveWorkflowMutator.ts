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

export interface UseLiveWorkflowMutatorApi {
  updateLiveWorkflow(
    workflowUid: string,
    updates: LiveWorkflowUpdates,
  ): Promise<LiveWorkflowMutationResult>;
  createLiveWorkflow(workflow: V5.LiveWorkflow): Promise<LiveWorkflowSimpleResult>;
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
    (writeOpts, workflow: V5.LiveWorkflow) => applyLiveWorkflowCreate(workflow, writeOpts),
  );

  const deleteLiveWorkflow = useGuardedMutation(workspaceId, surfaceId, (writeOpts, uid: string) =>
    applyLiveWorkflowDelete(uid, writeOpts),
  );

  return useMemo(
    () => ({ updateLiveWorkflow, createLiveWorkflow, deleteLiveWorkflow }),
    [updateLiveWorkflow, createLiveWorkflow, deleteLiveWorkflow],
  );
}
