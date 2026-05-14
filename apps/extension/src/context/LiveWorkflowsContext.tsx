/**
 * LiveWorkflowsContext — live-workflow list provider for popup,
 * sidepanel, panel, and workbench surfaces.
 *
 * Mirrors `LiveVariablesContext` (per MWPT-FULL § 4.1):
 *   - One state instance per surface; consumer hooks read from context.
 *   - `activeWorkspaceIdOverride` set ⇒ workbench (override) branch:
 *     reads `wsKeys(workspaceId).liveWorkflows` via storage subscribe;
 *     entity CRUD routes through `live-workflow-write-client` with the
 *     explicit workspaceId. Diverged tabs editing workspace W2 see and
 *     write to W2's data, regardless of the runtime-Active workspace.
 *   - `activeWorkspaceIdOverride` unset ⇒ legacy (system surface)
 *     branch: reads via `listLiveWorkflows` RPC + `liveWorkflowsChanged`
 *     broadcast on the SW's runtime-Active workspace; CRUD via the
 *     legacy `hostBridge.call('createLiveWorkflow'|...)` handlers. `refreshNow`
 *     stays on the legacy RPC in BOTH branches — the manual-refresh
 *     gesture targets the runtime-Active scheduler, not the editing
 *     scope.
 *
 * Closing this Provider lands the second half of the F-12 / I-5
 * prerequisite: the live-refresh scheduler's `getLiveWorkflows()` data
 * read becomes workspace-parameterizable end-to-end (paired with
 * Session 11's live-variable side).
 */

import type { LiveWorkflow, RefreshPolicy, WorkflowStep } from '@openheaders/core/types';
import { hostBridge, type BridgeRpcResponse } from '@openheaders/core/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import {
  applyLiveWorkflowCreate,
  applyLiveWorkflowDelete,
  applyLiveWorkflowUpdate,
} from '@/shared/sync/live-workflow-write-client';

export type LiveWorkflowWriteResult = BridgeRpcResponse<'updateLiveWorkflow'>;

export interface LiveWorkflowsContextValue {
  workflows: LiveWorkflow[];
  isReady: boolean;
  createWorkflow: (input: {
    name: string;
    description?: string;
    steps?: WorkflowStep[];
    refresh?: RefreshPolicy;
    enabled?: boolean;
  }) => Promise<LiveWorkflow | null>;
  updateWorkflow: (
    uid: string,
    updates: Partial<Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'>>,
  ) => Promise<LiveWorkflowWriteResult>;
  deleteWorkflow: (uid: string) => Promise<boolean>;
  refreshNow: (
    workflowUid: string,
    environmentId?: string | null,
  ) => Promise<BridgeRpcResponse<'refreshLiveWorkflowNow'>>;
}

const defaultContextValue: LiveWorkflowsContextValue = {
  workflows: [],
  isReady: false,
  createWorkflow: () => Promise.resolve(null),
  updateWorkflow: () => Promise.resolve({ success: false, reason: 'other', error: 'no provider' }),
  deleteWorkflow: () => Promise.resolve(false),
  refreshNow: () => Promise.resolve({ success: false, error: 'no provider' }),
};

export const LiveWorkflowsContext = createContext<LiveWorkflowsContextValue>(defaultContextValue);

interface LiveWorkflowsProviderProps {
  children: React.ReactNode;
  /** Surface attribution carried on every emitted live-workflow envelope. */
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See `EnvironmentProvider` / `LiveVariablesProvider` for the full
   * discipline contract; same shape here for the live-workflow list
   * slice (BC-MWPT-FULL-1-liveworkflows / BC-MWPT-FULL-2-liveworkflows).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const LiveWorkflowsProvider: React.FC<LiveWorkflowsProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const [workflows, setWorkflows] = useState<LiveWorkflow[]>([]);
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Legacy branch: `listLiveWorkflows` RPC + `liveWorkflowsChanged`
  // broadcast — global-default-scoped data for system surfaces.
  //
  // Override branch: `wsKeys(workspaceId).liveWorkflows` direct storage
  // subscribe — workspace-scoped data for diverged workbench tabs.

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (isOverridden) return;
      const resp = await hostBridge.call('listLiveWorkflows').catch(() => null);
      if (cancelled) return;
      setWorkflows(resp?.workflows ?? []);
      setIsReady(true);
    };
    void initialLoad();

    const unsubChange = hostBridge.subscribe('liveWorkflowsChanged', (payload) => {
      // Override branch ignores the global broadcast — workspace-scoped
      // storage subscribe owns it.
      if (!isOverridden) setWorkflows(payload.workflows);
    });
    const unsubWs = hostBridge.subscribe('workspaceChanged', () => {
      if (isOverridden) return;
      void initialLoad();
    });

    return () => {
      cancelled = true;
      unsubChange();
      unsubWs();
    };
  }, [isOverridden]);

  // Override-mode storage subscription — rebinds when the editing-scope
  // workspaceId changes. Diverged workbench tab editing W2 reads W2's
  // workflow array directly; chrome.storage's onChanged fires regardless
  // of which oracle the SW is currently running.
  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setWorkflows([]);
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void hostStorage.get(wsKeys(wsId).liveWorkflows).then((record) => {
      if (overrideIdRef.current !== wsId) return;
      setWorkflows(record ?? []);
      setIsReady(true);
    });
    return hostStorage.subscribe(wsKeys(wsId).liveWorkflows, (record) => {
      setWorkflows(record ?? []);
    });
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Override branch: CRUD routes through `live-workflow-write-client`
  // with an explicit `workspaceId`.
  // Legacy branch: `call(...)` against the SW's runtime-Active workspace.
  // refreshNow stays on the legacy RPC in BOTH branches — the manual-
  // refresh gesture is a runtime-scope action, not an editing-scope one.

  const createWorkflow = useCallback<LiveWorkflowsContextValue['createWorkflow']>(
    async (input) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        const seed: Omit<LiveWorkflow, 'uid' | 'path' | 'schemaVersion'> = {
          name: input.name,
          enabled: input.enabled ?? true,
          steps: input.steps ?? [],
          refresh: input.refresh ?? { kind: 'manual' },
          ...(input.description ? { description: input.description } : {}),
        };
        const result = await applyLiveWorkflowCreate(
          { workflow: seed, parentPath: 'live-workflows' },
          { workspaceId: wsId, surfaceId },
        );
        return result.ok ? result.workflow : null;
      }
      const resp = await hostBridge.call('createLiveWorkflow', input).catch(() => null);
      return resp?.success ? (resp.workflow ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const updateWorkflow = useCallback<LiveWorkflowsContextValue['updateWorkflow']>(
    async (uid, updates) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) {
          return { success: false, reason: 'other', error: 'no workspace' };
        }
        const result = await applyLiveWorkflowUpdate(uid, updates, { workspaceId: wsId, surfaceId });
        if (result.ok) return { success: true, workflow: result.workflow };
        if (result.reason === 'not-found') return { success: false, reason: 'not-found' };
        return { success: false, reason: 'other', error: result.message ?? '' };
      }
      return hostBridge.call('updateLiveWorkflow', { uid, updates }).catch(
        (err: Error) => ({ success: false, reason: 'other', error: err.message }) as LiveWorkflowWriteResult,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteWorkflow = useCallback<LiveWorkflowsContextValue['deleteWorkflow']>(
    async (uid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyLiveWorkflowDelete(uid, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await hostBridge.call('deleteLiveWorkflow', { uid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  // Workbench/diverged-tab gestures thread the editing-scope workspace
  // so the SW resolves the workflow against the tab's projection
  // (MWPT-FULL session #11). System surfaces leave it undefined and the
  // SW falls back to runtime-Active.
  const refreshNow = useCallback<LiveWorkflowsContextValue['refreshNow']>(
    async (workflowUid, environmentId) => {
      const wsId = isOverridden ? (activeWorkspaceIdOverride ?? undefined) : undefined;
      return hostBridge.call('refreshLiveWorkflowNow', { workflowUid, environmentId, workspaceId: wsId }).catch(
        (err: Error) => ({ success: false, error: err.message }) as BridgeRpcResponse<'refreshLiveWorkflowNow'>,
      );
    },
    [isOverridden, activeWorkspaceIdOverride],
  );

  const value = useMemo<LiveWorkflowsContextValue>(
    () => ({ workflows, isReady, createWorkflow, updateWorkflow, deleteWorkflow, refreshNow }),
    [workflows, isReady, createWorkflow, updateWorkflow, deleteWorkflow, refreshNow],
  );

  return <LiveWorkflowsContext.Provider value={value}>{children}</LiveWorkflowsContext.Provider>;
};

export function useLiveWorkflowsContext(): LiveWorkflowsContextValue {
  return useContext(LiveWorkflowsContext);
}
