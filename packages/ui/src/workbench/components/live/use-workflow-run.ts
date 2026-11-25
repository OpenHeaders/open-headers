/**
 * The page's kept run of one workflow in the editing scope's workspace —
 * `null` until a run of it was seen on this page.
 */

import { useSyncExternalStore } from 'react';
import { getKeptWorkflowRun, type KeptWorkflowRun, subscribeWorkflowRuns } from '../../data/workflow-run-store';
import { useWorkbenchEditingScopeWorkspaceId } from '../../hooks/EditingScopeWorkspaceContext';

export function useWorkflowRun(workflowUid: string): KeptWorkflowRun | null {
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();
  return useSyncExternalStore(subscribeWorkflowRuns, () =>
    workspaceId === null ? null : getKeptWorkflowRun(workspaceId, workflowUid),
  );
}
