/**
 * EnvironmentContext — env-list slice provider for popup, sidepanel,
 * panel, and workbench surfaces.
 *
 * Mirrors `RuleContext` exactly (per MWPT-FULL § 4.1):
 *   - One state instance per surface; consumer hooks read from context.
 *   - `activeWorkspaceIdOverride` set ⇒ workbench (override) branch:
 *     reads `wsKeys(workspaceId).environments` via storage subscribe;
 *     entity CRUD routes through `env-write-client` with the explicit
 *     workspaceId. Diverged tabs editing workspace W2 see and write to
 *     W2's data, regardless of the runtime-Active workspace.
 *   - `activeWorkspaceIdOverride` unset ⇒ legacy (system surface)
 *     branch: reads via `listEnvironments` RPC + `environmentsChanged`
 *     broadcast on the SW's runtime-Active workspace; CRUD via the
 *     legacy `call('createEnvironment'|...)` handlers.
 *   - Pointer ops (active/default/manual env, collection-env-overrides,
 *     collection-pinned-envs) stay on the legacy SW handler call —
 *     documented N residual per § 4.1.c (BC-MWPT-FULL-10). Per-tab
 *     pointer divergence deferred to v2 epic.
 */

import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { extensionStorage, wsKeys } from '@/shared/storage';
import {
  applyEnvironmentCreate,
  applyEnvironmentDelete,
  applyEnvVariablesReplacement,
  applyRenameEnvironment,
} from '@/shared/sync/env-write-client';

export type EnvironmentWriteResult = BridgeRpcResponse<'updateEnvironmentVariables'>;

export interface EnvironmentContextValue {
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
  setCollectionPinnedEnvs: (collectionUid: string, pinnedIds: string[], defaultId: string | null) => Promise<boolean>;
}

const defaultContextValue: EnvironmentContextValue = {
  environments: [],
  activeEnvironmentId: null,
  activeEnvironment: null,
  defaultEnvironmentId: null,
  defaultEnvironment: null,
  isReady: false,
  collectionEnvOverrides: {},
  manualEnvId: null,
  createEnvironment: () => Promise.resolve(null),
  renameEnvironment: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  updateEnvironmentVariables: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' }),
  deleteEnvironment: () => Promise.resolve(false),
  setActiveEnvironment: () => Promise.resolve(false),
  setDefaultEnvironment: () => Promise.resolve(false),
  setManualEnv: () => Promise.resolve(false),
  setCollectionEnvOverride: () => Promise.resolve(),
  setCollectionPinnedEnvs: () => Promise.resolve(false),
};

export const EnvironmentContext = createContext<EnvironmentContextValue>(defaultContextValue);

interface EnvironmentProviderProps {
  children: React.ReactNode;
  /** Surface attribution carried on every emitted env envelope. */
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See `RuleProvider` for the full discipline contract; same shape
   * here for the env-list slice (BC-MWPT-FULL-1-env / BC-MWPT-FULL-2-env).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const EnvironmentProvider: React.FC<EnvironmentProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const [environments, setEnvironments] = useState<V5.Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentIdState] = useState<string | null>(null);
  const [defaultEnvironmentId, setDefaultEnvironmentIdState] = useState<string | null>(null);
  const [manualEnvId, setManualEnvIdState] = useState<string | null>(null);
  const [collectionEnvOverrides, setCollectionEnvOverrides] = useState<Record<string, string | null>>({});
  const [isReady, setIsReady] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────
  //
  // Legacy branch: `listEnvironments` RPC + `environmentsChanged`
  // broadcast — global-default-scoped data for system surfaces.
  //
  // Override branch: `wsKeys(workspaceId).environments` direct storage
  // subscribe — workspace-scoped data for diverged workbench tabs.
  // Pointer ops still flow through the legacy `listEnvironments` RPC
  // (active/default/manual envs are still global per § 4.1.c) so the
  // legacy reload runs in BOTH branches; the override branch overwrites
  // the env list with the workspace-scoped read after the RPC returns.

  const reloadLegacyPointers = useCallback(async () => {
    const resp = await call('listEnvironments').catch(() => null);
    if (!resp) return null;
    setActiveEnvironmentIdState(resp.activeEnvironmentId ?? null);
    setDefaultEnvironmentIdState(resp.defaultEnvironmentId ?? null);
    setCollectionEnvOverrides(resp.collectionEnvOverrides ?? {});
    setManualEnvIdState(resp.manualEnvId ?? null);
    return resp;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      const resp = await reloadLegacyPointers();
      if (cancelled) return;
      if (isOverridden) {
        // Override branch reads env list from storage; pointers came from RPC above.
        setIsReady(true);
        return;
      }
      if (resp) setEnvironments(resp.environments ?? []);
      setIsReady(true);
    };
    void initialLoad();

    const unsub = subscribe('environmentsChanged', (payload) => {
      // Legacy branch consumes the bridge broadcast directly. Override
      // branch updates pointers from the broadcast (still global per
      // § 4.1.c) but ignores the env list (workspace-scoped storage
      // subscribe owns it).
      setActiveEnvironmentIdState(payload.activeEnvironmentId);
      setDefaultEnvironmentIdState(payload.defaultEnvironmentId);
      setCollectionEnvOverrides(payload.collectionEnvOverrides);
      setManualEnvIdState(payload.manualEnvId);
      if (!isOverridden) setEnvironments(payload.environments);
    });
    const unsubWs = subscribe('workspaceChanged', () => {
      void reloadLegacyPointers();
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [isOverridden, reloadLegacyPointers]);

  // Override-mode storage subscription — rebinds when the editing-scope
  // workspaceId changes. Diverged workbench tab editing workspace W2
  // reads W2's env array directly; chrome.storage's onChanged fires
  // regardless of which oracle the SW is currently running.
  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setEnvironments([]);
      return;
    }
    void extensionStorage.get(wsKeys(wsId).environments).then((record) => {
      if (overrideIdRef.current !== wsId) return;
      setEnvironments(record ?? []);
    });
    return extensionStorage.subscribe(wsKeys(wsId).environments, (record) => {
      setEnvironments(record ?? []);
    });
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────
  //
  // Override branch: entity CRUD routes through `env-write-client` with
  // an explicit `workspaceId`. Pointer ops stay on the legacy SW call
  // path per § 4.1.c (documented N residual; v2 epic).
  //
  // Legacy branch: identical to the pre-foundation hook — `call(...)`
  // against the SW's runtime-Active workspace.

  const createEnvironment = useCallback<EnvironmentContextValue['createEnvironment']>(
    async (name, variables) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return null;
        const result = await applyEnvironmentCreate({ name, variables }, { workspaceId: wsId, surfaceId });
        return result.ok ? result.environment : null;
      }
      const resp = await call('createEnvironment', { name, variables }).catch(() => null);
      return resp?.success ? (resp.environment ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const renameEnvironment = useCallback<EnvironmentContextValue['renameEnvironment']>(
    async (uid, name) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' } as const;
        const result = await applyRenameEnvironment({ envId: uid, name }, { workspaceId: wsId, surfaceId });
        if (result.ok) return { ok: true } as EnvironmentWriteResult;
        if (result.reason === 'not-found') return { ok: false, reason: 'not-found' } as const;
        return { ok: false, reason: 'other', message: result.message ?? '' } as EnvironmentWriteResult;
      }
      return call('renameEnvironment', { uid, name }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const updateEnvironmentVariables = useCallback<EnvironmentContextValue['updateEnvironmentVariables']>(
    async (uid, variables) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' } as const;
        const oldEnv = environments.find((e) => e.uid === uid);
        const oldVars = oldEnv?.variables ?? [];
        const result = await applyEnvVariablesReplacement(uid, variables, oldVars, { workspaceId: wsId, surfaceId });
        if (result.ok) return { ok: true } as EnvironmentWriteResult;
        if (result.reason === 'not-found') return { ok: false, reason: 'not-found' } as const;
        return { ok: false, reason: 'other', message: result.message ?? '' } as EnvironmentWriteResult;
      }
      return call('updateEnvironmentVariables', { uid, variables }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, environments],
  );

  const deleteEnvironment = useCallback<EnvironmentContextValue['deleteEnvironment']>(
    async (uid) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applyEnvironmentDelete({ envId: uid }, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('deleteEnvironment', { uid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  // Pointer ops — always legacy SW handler call (no workspaceId).
  // Per § 4.1.c, per-tab pointer divergence deferred to v2.

  const setActiveEnvironment = useCallback<EnvironmentContextValue['setActiveEnvironment']>(async (uid) => {
    const resp = await call('setActiveEnvironment', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setDefaultEnvironment = useCallback<EnvironmentContextValue['setDefaultEnvironment']>(async (uid) => {
    const resp = await call('setDefaultEnvironment', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setManualEnv = useCallback<EnvironmentContextValue['setManualEnv']>(async (uid) => {
    const resp = await call('setManualEnv', { uid }).catch(() => null);
    return Boolean(resp?.success);
  }, []);

  const setCollectionEnvOverride = useCallback<EnvironmentContextValue['setCollectionEnvOverride']>(
    async (collectionId, envId) => {
      await call('setCollectionEnvOverride', { collectionId, envId }).catch(() => null);
    },
    [],
  );

  const setCollectionPinnedEnvs = useCallback<EnvironmentContextValue['setCollectionPinnedEnvs']>(
    async (collectionUid, pinnedIds, defaultId) => {
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

  const value: EnvironmentContextValue = {
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

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
};

export function useEnvironmentContext(): EnvironmentContextValue {
  return useContext(EnvironmentContext);
}
