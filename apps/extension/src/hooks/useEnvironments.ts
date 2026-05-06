/**
 * useEnvironments — env-list-slice hook (legacy global-default path).
 *
 * Reads environments + active/default/manual env pointers + collection-env
 * overrides via the legacy `listEnvironments` RPC + `environmentsChanged`
 * broadcast. Mutations route through the legacy SW handlers
 * (`createEnvironment`, `renameEnvironment`, `updateEnvironmentVariables`,
 * `deleteEnvironment`, `setActiveEnvironment`, etc.).
 *
 * **Foundation gap (MWPT-FULL v1.2 § 4.0).** This hook today follows the
 * SW's runtime-active workspace by construction — the SW oracle is
 * singleton-per-active-workspace. Cross-workspace correctness in
 * per-window-or-tab mode requires the foundation refactor (per-workspace
 * SW services + per-workspace renderer mirrors). After foundation, this
 * hook is replaced by `EnvironmentProvider` mirroring `RuleProvider`,
 * with an `activeWorkspaceIdOverride` prop on the workbench surface.
 *
 * Cross-cutting consumers that need workspace variables / vault read
 * those slices via `useWorkspaceVariables()` / `useVault()`, or the
 * aggregator `useEnvVarVault()` for "I need everything" cases.
 */

import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import { useCallback, useEffect, useMemo, useState } from 'react';

export type EnvironmentWriteResult = BridgeRpcResponse<'updateEnvironmentVariables'>;

export interface UseEnvironmentsApi {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  activeEnvironment: V5.Environment | null;
  defaultEnvironmentId: string | null;
  defaultEnvironment: V5.Environment | null;
  isReady: boolean;
  collectionEnvOverrides: Record<string, string | null>;
  manualEnvId: string | null;

  createEnvironment: (name: string, variables?: V5.Variable[]) => Promise<V5.Environment | null>;
  renameEnvironment: (uid: string, name: string) => Promise<EnvironmentWriteResult>;
  updateEnvironmentVariables: (uid: string, variables: V5.Variable[]) => Promise<EnvironmentWriteResult>;
  deleteEnvironment: (uid: string) => Promise<boolean>;
  setActiveEnvironment: (uid: string | null) => Promise<boolean>;
  setDefaultEnvironment: (uid: string | null) => Promise<boolean>;
  setManualEnv: (uid: string | null) => Promise<boolean>;
  setCollectionEnvOverride: (collectionId: string, envId: string | null | undefined) => Promise<void>;
  setCollectionPinnedEnvs: (
    collectionUid: string,
    pinnedIds: string[],
    defaultId: string | null,
  ) => Promise<boolean>;
}

export function useEnvironments(): UseEnvironmentsApi {
  const [environments, setEnvironments] = useState<V5.Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentIdState] = useState<string | null>(null);
  const [defaultEnvironmentId, setDefaultEnvironmentIdState] = useState<string | null>(null);
  const [manualEnvId, setManualEnvIdState] = useState<string | null>(null);
  const [collectionEnvOverrides, setCollectionEnvOverrides] = useState<Record<string, string | null>>({});
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const reload = () =>
      call('listEnvironments')
        .then((resp) => {
          if (cancelled) return;
          setEnvironments(resp.environments ?? []);
          setActiveEnvironmentIdState(resp.activeEnvironmentId ?? null);
          setDefaultEnvironmentIdState(resp.defaultEnvironmentId ?? null);
          setCollectionEnvOverrides(resp.collectionEnvOverrides ?? {});
          setManualEnvIdState(resp.manualEnvId ?? null);
          setIsReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          setIsReady(true);
        });

    void reload();

    const unsub = subscribe('environmentsChanged', (payload) => {
      setEnvironments(payload.environments);
      setActiveEnvironmentIdState(payload.activeEnvironmentId);
      setDefaultEnvironmentIdState(payload.defaultEnvironmentId);
      setCollectionEnvOverrides(payload.collectionEnvOverrides);
      setManualEnvIdState(payload.manualEnvId);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      void reload();
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

  const renameEnvironment = useCallback<UseEnvironmentsApi['renameEnvironment']>(
    async (uid, name) =>
      call('renameEnvironment', { uid, name }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      ),
    [],
  );

  const updateEnvironmentVariables = useCallback<UseEnvironmentsApi['updateEnvironmentVariables']>(
    async (uid, variables) =>
      call('updateEnvironmentVariables', { uid, variables }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      ),
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

  const setManualEnv = useCallback(async (uid: string | null) => {
    const resp = await call('setManualEnv', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setCollectionEnvOverride = useCallback(
    async (collectionId: string, envId: string | null | undefined) => {
      await call('setCollectionEnvOverride', { collectionId, envId }).catch(() => null);
    },
    [],
  );

  const setCollectionPinnedEnvs = useCallback(
    async (collectionUid: string, pinnedIds: string[], defaultId: string | null) => {
      const resp = await call('setCollectionPinnedEnvs', {
        collectionUid,
        pinnedEnvironmentIds: pinnedIds,
        defaultEnvironmentId: defaultId,
      }).catch(() => null);
      return Boolean(resp?.success);
    },
    [],
  );

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
    isReady,
    collectionEnvOverrides,
    manualEnvId,
    createEnvironment,
    renameEnvironment,
    updateEnvironmentVariables,
    deleteEnvironment,
    setActiveEnvironment,
    setDefaultEnvironment,
    setManualEnv,
    setCollectionEnvOverride,
    setCollectionPinnedEnvs,
  };
}
