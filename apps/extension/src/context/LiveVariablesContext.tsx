/**
 * LiveVariablesContext — live-variable list provider for popup,
 * sidepanel, panel, and workbench surfaces.
 *
 * Mirrors `EnvironmentContext` (per MWPT-FULL § 4.1):
 *   - One state instance per surface; consumer hooks read from context.
 *   - `activeWorkspaceIdOverride` set ⇒ workbench (override) branch:
 *     reads `wsKeys(workspaceId).liveVariables` via storage subscribe;
 *     entity CRUD + manual override route through
 *     `live-variable-write-client` with the explicit workspaceId.
 *     Diverged tabs editing workspace W2 see and write to W2's data,
 *     regardless of the runtime-Active workspace.
 *   - `activeWorkspaceIdOverride` unset ⇒ legacy (system surface)
 *     branch: reads via `listLiveVariables` RPC + `liveVariablesChanged`
 *     broadcast on the SW's runtime-Active workspace; CRUD + override
 *     via the legacy `call('createLiveVariable'|...)` handlers.
 *
 * No § 4.1.c residual: live variables have no active/default pointer
 * concept. The per-LV `manualOverride` field is a regular setField
 * write through Phase B (same shape as the SW's setLiveVariableOverride
 * shim — `updateLiveVariable(uid, { manualOverride })`).
 */

import type { LiveVariable, LiveVariableOverride } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  applyLiveVariableCreate,
  applyLiveVariableDelete,
  applyLiveVariableUpdate,
} from '@/shared/sync/live-variable-write-client';

export type LiveVariableWriteResult = BridgeRpcResponse<'updateLiveVariable'>;
export type LiveVariableOverrideResult = BridgeRpcResponse<'setLiveVariableOverride'>;

export interface LiveVariablesContextValue {
  variables: LiveVariable[];
  isReady: boolean;
  createVariable: (input: {
    name: string;
    workflowUid: string;
    stepId: string;
    captureName: string;
    description?: string;
    requireFreshOnRuleBuild?: boolean;
    enabled?: boolean;
  }) => Promise<LiveVariable | null>;
  updateVariable: (
    uid: string,
    updates: Partial<Omit<LiveVariable, 'uid' | 'path' | 'schemaVersion'>>,
  ) => Promise<LiveVariableWriteResult>;
  deleteVariable: (uid: string) => Promise<boolean>;
  setOverride: (uid: string, override: LiveVariableOverride | null) => Promise<LiveVariableOverrideResult>;
}

const defaultContextValue: LiveVariablesContextValue = {
  variables: [],
  isReady: false,
  createVariable: () => Promise.resolve(null),
  updateVariable: () => Promise.resolve({ success: false, reason: 'other', error: 'no provider' }),
  deleteVariable: () => Promise.resolve(false),
  setOverride: () => Promise.resolve({ success: false, reason: 'other', error: 'no provider' }),
};

export const LiveVariablesContext = createContext<LiveVariablesContextValue>(defaultContextValue);

interface LiveVariablesProviderProps {
  children: React.ReactNode;
  /** Surface attribution carried on every emitted live-variable envelope. */
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See `EnvironmentProvider` / `RuleProvider` for the discipline contract;
   * same shape here for the live-variable list slice
   * (BC-MWPT-FULL-1-livevars / BC-MWPT-FULL-2-livevars).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const LiveVariablesProvider: React.FC<LiveVariablesProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const [variables, setVariables] = useState<LiveVariable[]>([]);
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Legacy branch: `listLiveVariables` RPC + `liveVariablesChanged`
  // broadcast — global-default-scoped data for system surfaces.
  //
  // Override branch: `wsKeys(workspaceId).liveVariables` direct storage
  // subscribe — workspace-scoped data for diverged workbench tabs.

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (isOverridden) {
        // Override branch reads from storage; the storage-subscribe
        // effect below seeds state and flips isReady.
        return;
      }
      const resp = await call('listLiveVariables').catch(() => null);
      if (cancelled) return;
      setVariables(resp?.variables ?? []);
      setIsReady(true);
    };
    void initialLoad();

    const unsubChange = subscribe('liveVariablesChanged', (payload) => {
      // Legacy branch consumes the bridge broadcast directly. Override
      // branch ignores it (workspace-scoped storage subscribe owns it).
      if (!isOverridden) setVariables(payload.variables);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
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
  // workspaceId changes. Diverged workbench tab editing workspace W2
  // reads W2's live-variable array directly; chrome.storage's onChanged
  // fires regardless of which oracle the SW is currently running.
  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setVariables([]);
      setIsReady(true);
      return;
    }
    setIsReady(false);
    void extensionStorage.get(wsKeys(wsId).liveVariables).then((record) => {
      if (overrideIdRef.current !== wsId) return;
      setVariables(record ?? []);
      setIsReady(true);
    });
    return extensionStorage.subscribe(wsKeys(wsId).liveVariables, (record) => {
      setVariables(record ?? []);
    });
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Override branch: CRUD + manualOverride route through
  // `live-variable-write-client` with an explicit `workspaceId`.
  // Legacy branch: `call(...)` against the SW's runtime-Active workspace.

  const createVariable = useCallback<LiveVariablesContextValue['createVariable']>(
    async (input) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        const seed: Omit<LiveVariable, 'uid' | 'path' | 'schemaVersion'> = {
          name: input.name,
          workflowUid: input.workflowUid,
          stepId: input.stepId,
          captureName: input.captureName,
          enabled: input.enabled ?? true,
          ...(input.description ? { description: input.description } : {}),
          ...(input.requireFreshOnRuleBuild ? { requireFreshOnRuleBuild: true } : {}),
        };
        const result = await applyLiveVariableCreate(
          { liveVariable: seed, parentPath: 'live-variables' },
          { workspaceId: wsId, surfaceId },
        );
        return result.ok ? result.liveVariable : null;
      }
      const resp = await call('createLiveVariable', input).catch(() => null);
      return resp?.success ? (resp.variable ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const updateVariable = useCallback<LiveVariablesContextValue['updateVariable']>(
    async (uid, updates) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) {
          return { success: false, reason: 'other', error: 'no workspace' };
        }
        const result = await applyLiveVariableUpdate(uid, updates, { workspaceId: wsId, surfaceId });
        if (result.ok) return { success: true, variable: result.liveVariable };
        if (result.reason === 'not-found') return { success: false, reason: 'not-found' };
        return { success: false, reason: 'other', error: result.message ?? '' };
      }
      return call('updateLiveVariable', { uid, updates }).catch(
        (err: Error) => ({ success: false, reason: 'other', error: err.message }) as LiveVariableWriteResult,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const deleteVariable = useCallback<LiveVariablesContextValue['deleteVariable']>(
    async (uid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyLiveVariableDelete(uid, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('deleteLiveVariable', { uid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  // setOverride mirrors the SW's setLiveVariableOverride shim shape:
  // a single setField on `manualOverride`. Wrapped through
  // applyLiveVariableUpdate so the override branch never falls back to
  // the legacy call() — closes the editor seam for
  // useVariableMutator.setLiveOverride (which reads setOverride from
  // useLiveVariables(), now backed by this Provider).
  const setOverride = useCallback<LiveVariablesContextValue['setOverride']>(
    async (uid, override) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) {
          return { success: false, reason: 'other', error: 'no workspace' };
        }
        const result = await applyLiveVariableUpdate(
          uid,
          { manualOverride: override ?? undefined },
          { workspaceId: wsId, surfaceId },
        );
        if (result.ok) return { success: true, variable: result.liveVariable };
        if (result.reason === 'not-found') return { success: false, reason: 'not-found' };
        return { success: false, reason: 'other', error: result.message ?? '' };
      }
      return call('setLiveVariableOverride', { uid, override }).catch(
        (err: Error) => ({ success: false, reason: 'other', error: err.message }) as LiveVariableOverrideResult,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const value = useMemo<LiveVariablesContextValue>(
    () => ({ variables, isReady, createVariable, updateVariable, deleteVariable, setOverride }),
    [variables, isReady, createVariable, updateVariable, deleteVariable, setOverride],
  );

  return <LiveVariablesContext.Provider value={value}>{children}</LiveVariablesContext.Provider>;
};

export function useLiveVariablesContext(): LiveVariablesContextValue {
  return useContext(LiveVariablesContext);
}
