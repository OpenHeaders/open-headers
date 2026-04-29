/**
 * useLiveWorkflows — renderer-side view of the SW-owned Live Workflow
 * store (see `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * One bridge call at mount for the initial snapshot + one
 * `liveWorkflowsChanged` subscription that keeps every surface in sync
 * afterwards.
 */

import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';

export type LiveWorkflowWriteResult = BridgeRpcResponse<'updateLiveWorkflow'>;

export interface UseLiveWorkflowsApi {
  workflows: V5.LiveWorkflow[];
  isReady: boolean;
  createWorkflow: (input: {
    name: string;
    description?: string;
    steps?: V5.WorkflowStep[];
    refresh?: V5.RefreshPolicy;
    enabled?: boolean;
  }) => Promise<V5.LiveWorkflow | null>;
  updateWorkflow: (
    uid: string,
    updates: Partial<Omit<V5.LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>,
  ) => Promise<LiveWorkflowWriteResult>;
  deleteWorkflow: (uid: string) => Promise<boolean>;
  refreshNow: (
    workflowUid: string,
    environmentId?: string | null,
  ) => Promise<BridgeRpcResponse<'refreshLiveWorkflowNow'>>;
}

export function useLiveWorkflows(): UseLiveWorkflowsApi {
  const [workflows, setWorkflows] = useState<V5.LiveWorkflow[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      const resp = await call('listLiveWorkflows').catch(() => null);
      if (cancelled) return;
      setWorkflows(resp?.workflows ?? []);
      setIsReady(true);
    };
    void loadInitial();

    const unsubChange = subscribe('liveWorkflowsChanged', (payload) => {
      setWorkflows(payload.workflows);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      void loadInitial();
    });

    return () => {
      cancelled = true;
      unsubChange();
      unsubWs();
    };
  }, []);

  const createWorkflow = useCallback<UseLiveWorkflowsApi['createWorkflow']>(async (input) => {
    const resp = await call('createLiveWorkflow', input).catch(() => null);
    return resp?.success ? (resp.workflow ?? null) : null;
  }, []);

  const updateWorkflow = useCallback<UseLiveWorkflowsApi['updateWorkflow']>(async (uid, updates) => {
    return call('updateLiveWorkflow', { uid, updates }).catch(
      (err: Error) =>
        ({ success: false, reason: 'other', error: err.message }) as unknown as LiveWorkflowWriteResult,
    );
  }, []);

  const deleteWorkflow = useCallback<UseLiveWorkflowsApi['deleteWorkflow']>(async (uid) => {
    const resp = await call('deleteLiveWorkflow', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const refreshNow = useCallback<UseLiveWorkflowsApi['refreshNow']>(async (workflowUid, environmentId) => {
    return call('refreshLiveWorkflowNow', { workflowUid, environmentId }).catch(
      (err: Error) => ({ success: false, error: err.message }) as BridgeRpcResponse<'refreshLiveWorkflowNow'>,
    );
  }, []);

  return { workflows, isReady, createWorkflow, updateWorkflow, deleteWorkflow, refreshNow };
}
