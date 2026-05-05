/**
 * EnvironmentContext — provides the active workspace's environment list
 * + collection-env-overrides + manual/default/active-env pointers to
 * popup, sidepanel, and workbench surfaces.
 *
 * Mirrors `RuleContext` exactly. Two read paths picked by `isOverridden`:
 *
 * 1. Non-override (popup / sidepanel — system surfaces). Snapshot from
 *    `listEnvironments` RPC; live updates from `environmentsChanged`.
 *
 * 2. Override (workbench surface). Reads workspace-scoped data directly
 *    from `chrome.storage.local` under `wsKeys(override).*`. Bridge
 *    broadcasts (`environmentsChanged`) carry global-default data and
 *    must NOT leak into a diverged tab — short-circuited.
 *
 * Mutations:
 *   - Override mode → Phase B `env-write-client` with explicit
 *     `{ workspaceId, surfaceId }`.
 *   - Non-override → legacy SW handlers via the bridge.
 *
 * Pointer ops (`setActiveEnvironment` / `setDefaultEnvironment` /
 * `setManualEnv`) ALWAYS go through legacy global-default handlers.
 * Per-tab pointer divergence is a deferred v2 epic (BC-MWPT-FULL-10
 * residual).
 */

import type { V5 } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import { generateUid } from '@openheaders/core/utils';
import type React from 'react';
import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  setCollectionPinnedEnvs: (
    collectionUid: string,
    pinnedIds: string[],
    defaultId: string | null,
  ) => Promise<boolean>;
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
  renameEnvironment: () => Promise.resolve({ ok: false, reason: 'other', message: 'no provider' } as const),
  updateEnvironmentVariables: () =>
    Promise.resolve({ ok: false, reason: 'other', message: 'no provider' } as const),
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
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   *
   * `undefined` → legacy path: `listEnvironments` RPC + bridge broadcast
   * + `workspaceChanged` re-fetch. System surfaces (popup, sidepanel,
   * panel) mount without this prop and stay on the global default.
   *
   * Defined → override path: subscribes to `wsKeys(override).*` storage
   * keys directly, ignores `environmentsChanged` broadcast (which
   * carries global-default data and would re-corrupt a diverged tab),
   * routes env-list mutations through the Phase B `env-write-client`
   * with `{ workspaceId: override }`. Pointer ops still call legacy
   * handlers — per-tab pointer divergence is BC-MWPT-FULL-10 N
   * residual, deferred to a v2 epic.
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

  // Track the last-bound override id so the override-change effect can
  // detect a switch even when the override is reactive.
  const overrideIdRef = useRef<string | null | undefined>(undefined);

  // ── Override branch: per-workspace storage subscriptions ─────────
  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;

    if (!wsId) {
      setEnvironments([]);
      setActiveEnvironmentIdState(null);
      setDefaultEnvironmentIdState(null);
      setManualEnvIdState(null);
      setCollectionEnvOverrides({});
      setIsReady(true);
      return;
    }

    // Prime initial values, then subscribe.
    void Promise.all([
      extensionStorage.get(wsKeys(wsId).environments),
      extensionStorage.get(wsKeys(wsId).activeEnvironmentId),
      extensionStorage.get(wsKeys(wsId).defaultEnvironmentId),
      extensionStorage.get(wsKeys(wsId).manualEnvId),
      extensionStorage.get(wsKeys(wsId).collectionEnvOverrides),
    ]).then(([envs, activeId, defaultId, manualId, overrides]) => {
      if (overrideIdRef.current !== wsId) return;
      setEnvironments(envs ?? []);
      setActiveEnvironmentIdState(activeId ?? null);
      setDefaultEnvironmentIdState(defaultId ?? null);
      setManualEnvIdState(manualId ?? null);
      setCollectionEnvOverrides(overrides ?? {});
      setIsReady(true);
    });

    const unsubEnvs = extensionStorage.subscribe(wsKeys(wsId).environments, (record) => {
      setEnvironments(record ?? []);
    });
    const unsubActive = extensionStorage.subscribe(wsKeys(wsId).activeEnvironmentId, (record) => {
      setActiveEnvironmentIdState(record ?? null);
    });
    const unsubDefault = extensionStorage.subscribe(wsKeys(wsId).defaultEnvironmentId, (record) => {
      setDefaultEnvironmentIdState(record ?? null);
    });
    const unsubManual = extensionStorage.subscribe(wsKeys(wsId).manualEnvId, (record) => {
      setManualEnvIdState(record ?? null);
    });
    const unsubOverrides = extensionStorage.subscribe(wsKeys(wsId).collectionEnvOverrides, (record) => {
      setCollectionEnvOverrides(record ?? {});
    });

    return () => {
      unsubEnvs();
      unsubActive();
      unsubDefault();
      unsubManual();
      unsubOverrides();
    };
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Non-override branch: legacy RPC + bridge broadcast ───────────
  useEffect(() => {
    if (isOverridden) return;
    let cancelled = false;

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

    const unsub = subscribe('environmentsChanged', (payload) => {
      setEnvironments(payload.environments);
      setActiveEnvironmentIdState(payload.activeEnvironmentId);
      setDefaultEnvironmentIdState(payload.defaultEnvironmentId);
      setCollectionEnvOverrides(payload.collectionEnvOverrides);
      setManualEnvIdState(payload.manualEnvId);
    });

    // Workspace switches don't fire environmentsChanged on their own —
    // re-read from scratch when the global active workspace changes.
    const unsubWs = subscribe('workspaceChanged', () => {
      void call('listEnvironments')
        .then((resp) => {
          if (cancelled) return;
          setEnvironments(resp.environments ?? []);
          setActiveEnvironmentIdState(resp.activeEnvironmentId ?? null);
          setDefaultEnvironmentIdState(resp.defaultEnvironmentId ?? null);
          setCollectionEnvOverrides(resp.collectionEnvOverrides ?? {});
          setManualEnvIdState(resp.manualEnvId ?? null);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [isOverridden]);

  // ── Mutations ─────────────────────────────────────────────────────

  const createEnvironment = useCallback<EnvironmentContextValue['createEnvironment']>(
    async (name, variables) => {
      const trimmed = name.trim() || 'Untitled Environment';
      const wsId = isOverridden ? (activeWorkspaceIdOverride ?? null) : null;
      if (isOverridden) {
        if (!wsId) return null;
        const env: V5.Environment = {
          schemaVersion: 5,
          uid: generateUid(),
          name: trimmed,
          variables: variables ?? [],
        };
        const result = await applyEnvironmentCreate(env, { workspaceId: wsId, surfaceId });
        return result.ok ? env : null;
      }
      const resp = await call('createEnvironment', { name: trimmed, variables }).catch(() => null);
      return resp?.success ? (resp.environment ?? null) : null;
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  const renameEnvironment = useCallback<EnvironmentContextValue['renameEnvironment']>(
    async (uid, name) => {
      const wsId = isOverridden ? (activeWorkspaceIdOverride ?? null) : null;
      if (isOverridden) {
        if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' };
        const result = await applyRenameEnvironment(
          { envId: uid, name: name.trim() },
          { workspaceId: wsId, surfaceId },
        );
        if (result.ok) {
          const next = environments.find((e) => e.uid === uid);
          return next
            ? ({ ok: true, environment: { ...next, name: name.trim() || next.name } } as const)
            : ({ ok: false, reason: 'not-found' } as const);
        }
        const message = result.reason === 'other' ? (result.message ?? '') : '';
        return { ok: false, reason: 'other', message } as const;
      }
      return call('renameEnvironment', { uid, name }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, environments],
  );

  const updateEnvironmentVariables = useCallback<EnvironmentContextValue['updateEnvironmentVariables']>(
    async (uid, variables) => {
      const wsId = isOverridden ? (activeWorkspaceIdOverride ?? null) : null;
      if (isOverridden) {
        if (!wsId) return { ok: false, reason: 'other', message: 'no workspace' };
        const prev = environments.find((e) => e.uid === uid);
        if (!prev) return { ok: false, reason: 'not-found' };
        const result = await applyEnvVariablesReplacement(uid, variables, prev.variables, {
          workspaceId: wsId,
          surfaceId,
        });
        if (result.ok) {
          return { ok: true, environment: { ...prev, variables } } as const;
        }
        const message = result.reason === 'other' ? (result.message ?? '') : '';
        return { ok: false, reason: 'other', message } as const;
      }
      return call('updateEnvironmentVariables', { uid, variables }).catch(
        (err: Error) => ({ ok: false, reason: 'other', message: err.message }) as const,
      );
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId, environments],
  );

  const deleteEnvironment = useCallback(
    async (uid: string) => {
      const wsId = isOverridden ? (activeWorkspaceIdOverride ?? null) : null;
      if (isOverridden) {
        if (!wsId) return false;
        const result = await applyEnvironmentDelete(uid, { workspaceId: wsId, surfaceId });
        return result.ok;
      }
      const resp = await call('deleteEnvironment', { uid }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
  );

  // Pointer ops always go through legacy global-default handlers
  // (BC-MWPT-FULL-10 N residual — § 4.1.c).
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
