/**
 * useLiveVariables — renderer-side view of the SW-owned Live Variable
 * store (see `docs/LIVE_VARIABLES_PLAN.md`).
 *
 * One bridge call at mount for the initial snapshot + one
 * `liveVariablesChanged` subscription. CRUD + `setOverride` are thin
 * wrappers over the typed RPCs.
 */

import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useState } from 'react';

export type LiveVariableWriteResult = BridgeRpcResponse<'updateLiveVariable'>;
export type LiveVariableOverrideResult = BridgeRpcResponse<'setLiveVariableOverride'>;

export interface UseLiveVariablesApi {
  variables: V5.LiveVariable[];
  isReady: boolean;
  createVariable: (input: {
    name: string;
    workflowUid: string;
    stepId: string;
    captureName: string;
    description?: string;
    requireFreshOnRuleBuild?: boolean;
    enabled?: boolean;
  }) => Promise<V5.LiveVariable | null>;
  updateVariable: (
    uid: string,
    updates: Partial<Omit<V5.LiveVariable, 'uid' | 'path' | 'schemaVersion'>>,
  ) => Promise<LiveVariableWriteResult>;
  deleteVariable: (uid: string) => Promise<boolean>;
  setOverride: (
    uid: string,
    override: V5.LiveVariableOverride | null,
  ) => Promise<LiveVariableOverrideResult>;
}

export function useLiveVariables(): UseLiveVariablesApi {
  const [variables, setVariables] = useState<V5.LiveVariable[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      const resp = await call('listLiveVariables').catch(() => null);
      if (cancelled) return;
      setVariables(resp?.variables ?? []);
      setIsReady(true);
    };
    void loadInitial();

    const unsubChange = subscribe('liveVariablesChanged', (payload) => {
      setVariables(payload.variables);
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

  const createVariable = useCallback<UseLiveVariablesApi['createVariable']>(async (input) => {
    const resp = await call('createLiveVariable', input).catch(() => null);
    return resp?.success ? (resp.variable ?? null) : null;
  }, []);

  const updateVariable = useCallback<UseLiveVariablesApi['updateVariable']>(async (uid, updates) => {
    return call('updateLiveVariable', { uid, updates }).catch(
      (err: Error) =>
        ({ success: false, reason: 'other', error: err.message }) as unknown as LiveVariableWriteResult,
    );
  }, []);

  const deleteVariable = useCallback<UseLiveVariablesApi['deleteVariable']>(async (uid) => {
    const resp = await call('deleteLiveVariable', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setOverride = useCallback<UseLiveVariablesApi['setOverride']>(async (uid, override) => {
    return call('setLiveVariableOverride', { uid, override }).catch(
      (err: Error) =>
        ({ success: false, reason: 'other', error: err.message }) as unknown as LiveVariableOverrideResult,
    );
  }, []);

  return { variables, isReady, createVariable, updateVariable, deleteVariable, setOverride };
}
