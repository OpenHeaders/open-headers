/**
 * WorkspaceVariablesContext — workspace-vars singleton-entity provider.
 *
 * Mirrors `EnvironmentContext` (per MWPT-FULL § 4.1.b — three sibling
 * providers stack). One state instance per surface; consumer hooks read
 * from context; `activeWorkspaceIdOverride` selects override (workbench)
 * vs legacy (system surface) branch.
 *
 *   - Override branch: reads `wsKeys(workspaceId).workspaceVars` via
 *     storage subscribe; writes route through
 *     `workspace-variables-write-client` with the explicit workspaceId.
 *     Diverged tabs editing W2 see and write to W2's workspace variables,
 *     regardless of runtime-Active.
 *   - Legacy branch: reads via `getWorkspaceVariables` RPC +
 *     `environmentsChanged` broadcast (the SW broadcasts ws-vars on the
 *     same channel as env pointers). Writes still route through the
 *     Phase B write-client, but with `useActiveWorkspaceId()` as the
 *     implicit workspaceId (system surfaces follow Active).
 *
 * No § 4.1.c residual: workspace variables have no active/default
 * pointer concept, so the migration covers all writes.
 */

import type { Variable, WorkspaceVariables } from '@openheaders/core/types';
import { useActiveWorkspaceId } from '../shared/hooks/useActiveWorkspaceId';
import { hostBridge } from '@openheaders/core/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import {
  applyWorkspaceVariablesReplacement,
  applyWorkspaceVarRemove,
  applyWorkspaceVarSet,
  type WorkspaceVariablesSimpleResult,
} from '../shared/sync/workspace-variables-write-client';

const EMPTY_WS_VARS: WorkspaceVariables = { schemaVersion: 5, variables: [] };

export interface WorkspaceVariablesContextValue {
  workspaceVariables: WorkspaceVariables;
  isReady: boolean;
  setWorkspaceVariable: (variable: Variable) => Promise<WorkspaceVariablesSimpleResult>;
  removeWorkspaceVariable: (uid: string) => Promise<WorkspaceVariablesSimpleResult>;
  replaceWorkspaceVariables: (
    newVars: readonly Variable[],
    oldVars: readonly Variable[],
  ) => Promise<WorkspaceVariablesSimpleResult>;
}

const NO_WORKSPACE: WorkspaceVariablesSimpleResult = { ok: false, reason: 'other', message: 'no workspace' };

const defaultContextValue: WorkspaceVariablesContextValue = {
  workspaceVariables: EMPTY_WS_VARS,
  isReady: false,
  setWorkspaceVariable: () => Promise.resolve(NO_WORKSPACE),
  removeWorkspaceVariable: () => Promise.resolve(NO_WORKSPACE),
  replaceWorkspaceVariables: () => Promise.resolve(NO_WORKSPACE),
};

export const WorkspaceVariablesContext = createContext<WorkspaceVariablesContextValue>(defaultContextValue);

interface WorkspaceVariablesProviderProps {
  children: React.ReactNode;
  /** Surface attribution carried on every emitted ws-vars envelope. */
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See `EnvironmentProvider` / `RuleProvider` for the full discipline
   * contract; same shape here for the workspace-vars singleton slice
   * (BC-MWPT-FULL-1-wsvars / BC-MWPT-FULL-2-wsvars).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const WorkspaceVariablesProvider: React.FC<WorkspaceVariablesProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const activeWorkspaceId = useActiveWorkspaceId();
  const writeWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : activeWorkspaceId;

  const [workspaceVariables, setWorkspaceVariables] = useState<WorkspaceVariables>(EMPTY_WS_VARS);
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Legacy branch: `getWorkspaceVariables` RPC + `environmentsChanged`
  // broadcast — the SW publishes ws-vars on the env channel.
  //
  // Override branch: `wsKeys(workspaceId).workspaceVars` direct storage
  // subscribe — workspace-scoped data for diverged workbench tabs. The
  // legacy broadcast is ignored for ws-vars when override is set.

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (isOverridden) {
        // Override branch reads ws-vars from storage; mark ready once
        // the storage-subscribe effect below seeds state.
        return;
      }
      const resp = await hostBridge.call('getWorkspaceVariables').catch(() => null);
      if (cancelled) return;
      if (resp) setWorkspaceVariables(resp.workspaceVariables);
      setIsReady(true);
    };
    void initialLoad();

    const unsub = hostBridge.subscribe('environmentsChanged', (payload) => {
      // Legacy branch consumes the bridge broadcast directly. Override
      // branch ignores ws-vars from this broadcast (workspace-scoped
      // storage subscribe owns it).
      if (!isOverridden) setWorkspaceVariables(payload.workspaceVariables);
    });
    const unsubWs = hostBridge.subscribe('workspaceChanged', () => {
      if (isOverridden) return;
      void hostBridge.call('getWorkspaceVariables')
        .then((resp) => {
          setWorkspaceVariables(resp.workspaceVariables);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [isOverridden]);

  // Override-mode storage subscription — rebinds when the editing-scope
  // workspaceId changes. Diverged workbench tab editing W2 reads W2's
  // ws-vars directly; the host storage layer's change events fire regardless of
  // which oracle the SW is currently running.
  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setWorkspaceVariables(EMPTY_WS_VARS);
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void hostStorage.get(wsKeys(wsId).workspaceVars).then((record) => {
      if (overrideIdRef.current !== wsId) return;
      setWorkspaceVariables(record ?? EMPTY_WS_VARS);
      setIsReady(true);
    });
    return hostStorage.subscribe(wsKeys(wsId).workspaceVars, (record) => {
      setWorkspaceVariables(record ?? EMPTY_WS_VARS);
    });
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Both branches route through Phase B (`workspace-variables-write-client`)
  // with explicit workspaceId. Override branch threads the editing-scope
  // id; legacy branch threads runtime-Active. No legacy SW
  // `setWorkspaceVariables` RPC exists — Phase B is the only write path
  // for this entity family.

  const setWorkspaceVariable = useCallback<WorkspaceVariablesContextValue['setWorkspaceVariable']>(
    async (variable) => {
      if (!writeWorkspaceId) return NO_WORKSPACE;
      return applyWorkspaceVarSet({ variable }, { workspaceId: writeWorkspaceId, surfaceId });
    },
    [writeWorkspaceId, surfaceId],
  );

  const removeWorkspaceVariable = useCallback<WorkspaceVariablesContextValue['removeWorkspaceVariable']>(
    async (uid) => {
      if (!writeWorkspaceId) return NO_WORKSPACE;
      return applyWorkspaceVarRemove({ uid }, { workspaceId: writeWorkspaceId, surfaceId });
    },
    [writeWorkspaceId, surfaceId],
  );

  const replaceWorkspaceVariables = useCallback<WorkspaceVariablesContextValue['replaceWorkspaceVariables']>(
    async (newVars, oldVars) => {
      if (!writeWorkspaceId) return NO_WORKSPACE;
      return applyWorkspaceVariablesReplacement(newVars, oldVars, { workspaceId: writeWorkspaceId, surfaceId });
    },
    [writeWorkspaceId, surfaceId],
  );

  const value = useMemo<WorkspaceVariablesContextValue>(
    () => ({
      workspaceVariables,
      isReady,
      setWorkspaceVariable,
      removeWorkspaceVariable,
      replaceWorkspaceVariables,
    }),
    [workspaceVariables, isReady, setWorkspaceVariable, removeWorkspaceVariable, replaceWorkspaceVariables],
  );

  return <WorkspaceVariablesContext.Provider value={value}>{children}</WorkspaceVariablesContext.Provider>;
};

export function useWorkspaceVariablesContext(): WorkspaceVariablesContextValue {
  return useContext(WorkspaceVariablesContext);
}
