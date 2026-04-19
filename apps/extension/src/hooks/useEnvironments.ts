/**
 * useEnvironments — single source of environment / workspace-vars /
 * vault state for UI surfaces.
 *
 * Same shape as `useWorkspaces`: one bridge call at mount for the
 * initial snapshot, one `environmentsChanged` subscription that keeps
 * every component in sync for the lifetime of the page. Mutations are
 * thin wrappers over the bridge RPCs; the SW fires the broadcast
 * synchronously from each handler, so `setState` happens on the next
 * microtask and components re-render automatically — no optimistic
 * updates needed.
 *
 * Null `activeEnvironmentId` is a valid state (Postman "No environment"
 * semantics). Components should render "No environment" without
 * treating it as an error.
 */

import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Phase 10 write-result shape for environment mutations — sourced
 * directly from the bridge contract so the hook can't drift from the
 * RPC. The contract defines the same shape twice (renameEnvironment /
 * updateEnvironmentVariables); they're identical so we name it once
 * here for the consumer-facing API.
 */
export type EnvironmentWriteResult = BridgeRpcResponse<'updateEnvironmentVariables'>;

export interface UseEnvironmentsApi {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  activeEnvironment: V5.Environment | null;
  /** Fallback-env uid — resolver walks `active → default → unresolved`. `null` = no fallback. */
  defaultEnvironmentId: string | null;
  defaultEnvironment: V5.Environment | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
  isReady: boolean;

  createEnvironment: (name: string, variables?: V5.Variable[]) => Promise<V5.Environment | null>;
  /**
   * Rename — returns the full Phase 10 write result. Callers that
   * don't track `expectedVersion` (sidebar, context menu) omit it
   * and get last-write-wins semantics. Editors pass the loaded
   * version so a cross-tab rename collision surfaces `stale-draft`.
   */
  renameEnvironment: (uid: string, name: string, expectedVersion?: number) => Promise<EnvironmentWriteResult>;
  updateEnvironmentVariables: (
    uid: string,
    variables: V5.Variable[],
    expectedVersion?: number,
  ) => Promise<EnvironmentWriteResult>;
  deleteEnvironment: (uid: string) => Promise<boolean>;
  /** Pass `null` to enter "No environment" mode. */
  setActiveEnvironment: (uid: string | null) => Promise<boolean>;
  /** Pass `null` to clear the default-env fallback. */
  setDefaultEnvironment: (uid: string | null) => Promise<boolean>;

  setWorkspaceVariables: (vars: V5.WorkspaceVariables) => Promise<boolean>;
  setVault: (vault: V5.Vault) => Promise<boolean>;

  updateCollectionVariables: (collectionUid: string, variables: V5.Variable[]) => Promise<boolean>;
}

export function useEnvironments(): UseEnvironmentsApi {
  const [environments, setEnvironments] = useState<V5.Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(null);
  const [defaultEnvironmentId, setDefaultEnvironmentIdState] = useState<string | null>(null);
  const [workspaceVariables, setWorkspaceVariablesState] = useState<V5.WorkspaceVariables>({
    schemaVersion: 5,
    variables: [],
  });
  const [vault, setVaultState] = useState<V5.Vault>({ schemaVersion: 5, secrets: [] });
  const [isReady, setIsReady] = useState(false);

  // Initial snapshot + subscription. Three parallel reads at mount
  // keep the first paint coherent; afterwards, one broadcast channel
  // covers every subsequent mutation.
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      call('listEnvironments').catch(() => null),
      call('getWorkspaceVariables').catch(() => null),
      call('getVault').catch(() => null),
    ]).then(([envResp, varsResp, vaultResp]) => {
      if (cancelled) return;
      if (envResp) {
        setEnvironments(envResp.environments);
        setActiveEnvironmentId(envResp.activeEnvironmentId);
        setDefaultEnvironmentIdState(envResp.defaultEnvironmentId);
      }
      if (varsResp) setWorkspaceVariablesState(varsResp.workspaceVariables);
      if (vaultResp) setVaultState(vaultResp.vault);
      setIsReady(true);
    });

    const unsub = subscribe('environmentsChanged', (payload) => {
      setEnvironments(payload.environments);
      setActiveEnvironmentId(payload.activeEnvironmentId);
      setDefaultEnvironmentIdState(payload.defaultEnvironmentId);
      setWorkspaceVariablesState(payload.workspaceVariables);
      setVaultState(payload.vault);
    });

    // Workspace switches don't fire environmentsChanged on their own —
    // the orchestrator swaps env-store state without going through a
    // setter. Re-read from scratch when the workspace changes.
    const unsubWs = subscribe('workspaceChanged', () => {
      void (async () => {
        const [envResp, varsResp, vaultResp] = await Promise.all([
          call('listEnvironments').catch(() => null),
          call('getWorkspaceVariables').catch(() => null),
          call('getVault').catch(() => null),
        ]);
        if (cancelled) return;
        if (envResp) {
          setEnvironments(envResp.environments);
          setActiveEnvironmentId(envResp.activeEnvironmentId);
          setDefaultEnvironmentIdState(envResp.defaultEnvironmentId);
        }
        if (varsResp) setWorkspaceVariablesState(varsResp.workspaceVariables);
        if (vaultResp) setVaultState(vaultResp.vault);
      })();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, []);

  const createEnvironment = useCallback<UseEnvironmentsApi['createEnvironment']>(async (name, variables) => {
    const resp = await call('createEnvironment', { name, variables }).catch(() => null);
    return resp?.success ? (resp.environment ?? null) : null;
  }, []);

  const renameEnvironment = useCallback<UseEnvironmentsApi['renameEnvironment']>(async (uid, name, expectedVersion) => {
    const payload = expectedVersion !== undefined ? { uid, name, expectedVersion } : { uid, name };
    return call('renameEnvironment', payload).catch(
      (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
    );
  }, []);

  const updateEnvironmentVariables = useCallback<UseEnvironmentsApi['updateEnvironmentVariables']>(
    async (uid, variables, expectedVersion) => {
      const payload = expectedVersion !== undefined ? { uid, variables, expectedVersion } : { uid, variables };
      return call('updateEnvironmentVariables', payload).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      );
    },
    [],
  );

  const deleteEnvironment = useCallback(async (uid: string) => {
    const resp = await call('deleteEnvironment', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setActiveEnvironment = useCallback(async (uid: string | null) => {
    const resp = await call('setActiveEnvironment', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setDefaultEnvironment = useCallback(async (uid: string | null) => {
    const resp = await call('setDefaultEnvironment', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setWorkspaceVariables = useCallback(async (vars: V5.WorkspaceVariables) => {
    const resp = await call('setWorkspaceVariables', { workspaceVariables: vars }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setVault = useCallback(async (next: V5.Vault) => {
    const resp = await call('setVault', { vault: next }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const updateCollectionVariables = useCallback(async (collectionUid: string, variables: V5.Variable[]) => {
    const resp = await call('updateCollectionVariables', { collectionUid, variables }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const activeEnvironment = useMemo(
    () => (activeEnvironmentId ? (environments.find((e) => e.uid === activeEnvironmentId) ?? null) : null),
    [environments, activeEnvironmentId],
  );

  const defaultEnvironment = useMemo(
    () => (defaultEnvironmentId ? (environments.find((e) => e.uid === defaultEnvironmentId) ?? null) : null),
    [environments, defaultEnvironmentId],
  );

  return {
    environments,
    activeEnvironmentId,
    activeEnvironment,
    defaultEnvironmentId,
    defaultEnvironment,
    workspaceVariables,
    vault,
    isReady,
    createEnvironment,
    renameEnvironment,
    updateEnvironmentVariables,
    deleteEnvironment,
    setActiveEnvironment,
    setDefaultEnvironment,
    setWorkspaceVariables,
    setVault,
    updateCollectionVariables,
  };
}
