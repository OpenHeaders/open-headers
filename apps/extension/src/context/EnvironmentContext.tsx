/**
 * EnvironmentContext — env-list slice provider for popup, sidepanel,
 * panel, and workbench surfaces.
 *
 * Per-workspace pointer model (post BC-MWPT-FULL-10 fix):
 *
 *   - Pointer state (active / default / manual env, collection env
 *     overrides) lives in `wsKeys(workspaceId).<key>` chrome.storage
 *     keys, scoped to the workspace the surface is editing. Both the
 *     override branch (workbench tab pinned to a workspace via
 *     `activeWorkspaceIdOverride`) and the legacy branch (system
 *     surfaces editing the runtime-active workspace) read and write
 *     the same per-workspace keys — no global pointer state, no
 *     cross-tab cross-talk.
 *
 *   - Reads: `hostStorage.subscribe` on each pointer key, scoped
 *     to the resolved workspaceId. The SW's `environmentsChanged`
 *     broadcast carries env-list re-projections for the legacy
 *     branch but NO LONGER drives pointer state.
 *
 *   - Writes: `hostStorage.set` directly on the per-workspace
 *     pointer keys. The SW environment-store subscribes to its
 *     runtime-Active workspace's pointer keys and reacts (DNR
 *     recompile, resolver invalidate, live-refresh switch-warm) when
 *     a write lands. Stale ids are reconciled SW-side and written
 *     back so the storage value never drifts.
 *
 *   - `setCollectionPinnedEnvs` is an entity-level write on the
 *     collection itself (not a pointer scalar). Override branch goes
 *     through `applySetPinnedAndDefault` with explicit workspaceId;
 *     legacy branch keeps the SW handler (system surfaces always edit
 *     the runtime-Active workspace's collections).
 */

import type { Environment, Variable } from '@openheaders/core/types';
import type { BridgeRpcResponse } from '@utils/bridge';
import { call, subscribe } from '@utils/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import {
  applyEnvironmentCreate,
  applyEnvironmentDelete,
  applyEnvVariablesReplacement,
  applyRenameEnvironment,
} from '@/shared/sync/env-write-client';
import { applySetPinnedAndDefault } from '@/shared/sync/collection-write-client';

export type EnvironmentWriteResult = BridgeRpcResponse<'updateEnvironmentVariables'>;

export interface EnvironmentContextValue {
  environments: Environment[];
  activeEnvironmentId: string | null;
  activeEnvironment: Environment | null;
  defaultEnvironmentId: string | null;
  defaultEnvironment: Environment | null;
  isReady: boolean;
  collectionEnvOverrides: Record<string, string | null>;
  manualEnvId: string | null;

  createEnvironment: (name: string, variables?: Variable[]) => Promise<Environment | null>;
  renameEnvironment: (uid: string, name: string) => Promise<EnvironmentWriteResult>;
  updateEnvironmentVariables: (uid: string, variables: Variable[]) => Promise<EnvironmentWriteResult>;
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
   * Override branch: pinned to the prop value, never tracks runtime-
   * active changes. System surfaces (popup / sidepanel / panel) MUST
   * NOT pass this prop — they auto-track the runtime-active workspace
   * via the `workspaceChanged` broadcast.
   */
  activeWorkspaceIdOverride?: string | null;
}

const isStringOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';

function readPointer(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readOverrides(value: unknown): Record<string, string | null> {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (isStringOrNull(v)) out[k] = v;
  }
  return out;
}

export const EnvironmentProvider: React.FC<EnvironmentProviderProps> = ({
  children,
  surfaceId,
  activeWorkspaceIdOverride,
}) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [activeEnvironmentId, setActiveEnvironmentIdState] = useState<string | null>(null);
  const [defaultEnvironmentId, setDefaultEnvironmentIdState] = useState<string | null>(null);
  const [manualEnvId, setManualEnvIdState] = useState<string | null>(null);
  const [collectionEnvOverrides, setCollectionEnvOverrides] = useState<Record<string, string | null>>({});
  const [isReady, setIsReady] = useState(false);
  // Legacy branch: tracks the SW's runtime-active workspace, learned
  // from `listWorkspaces` bootstrap + `workspaceChanged` broadcast.
  // Override branch: this state stays null — the override prop is the
  // authoritative source.
  const [legacyWorkspaceId, setLegacyWorkspaceId] = useState<string | null>(null);

  const effectiveWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : legacyWorkspaceId;
  const workspaceIdRef = useRef<string | null>(null);
  workspaceIdRef.current = effectiveWorkspaceId;

  // ── Legacy-branch active workspace tracking ───────────────────────
  //
  // System surfaces follow whichever workspace the SW is currently
  // bound to. Override branch skips this entirely.

  useEffect(() => {
    if (isOverridden) return;
    let cancelled = false;
    void call('listWorkspaces')
      .then((resp) => {
        if (cancelled) return;
        setLegacyWorkspaceId(resp.activeWorkspaceId ?? null);
      })
      .catch(() => {
        // Bootstrap failure: nothing to read until a workspaceChanged
        // broadcast carries an id.
      });
    const unsubWs = subscribe('workspaceChanged', (payload) => {
      setLegacyWorkspaceId(payload.activeWorkspaceId ?? null);
    });
    return () => {
      cancelled = true;
      unsubWs();
    };
  }, [isOverridden]);

  // ── Env list subscription ─────────────────────────────────────────
  //
  // Both branches read `wsKeys(ws).environments` directly. Legacy
  // surfaces previously consumed `environmentsChanged` for the env
  // list — the broadcast still fires for downstream consumers
  // (Vault / WorkspaceVariables / scheduleUpdate) but env-list
  // updates here come from the storage subscription.

  useEffect(() => {
    const wsId = effectiveWorkspaceId;
    if (!wsId) {
      setEnvironments([]);
      return;
    }
    void hostStorage.get(wsKeys(wsId).environments).then((record) => {
      if (workspaceIdRef.current !== wsId) return;
      setEnvironments(record ?? []);
    });
    return hostStorage.subscribe(wsKeys(wsId).environments, (record) => {
      if (workspaceIdRef.current !== wsId) return;
      setEnvironments(record ?? []);
    });
  }, [effectiveWorkspaceId]);

  // ── Pointer subscriptions ────────────────────────────────────────

  useEffect(() => {
    const wsId = effectiveWorkspaceId;
    if (!wsId) {
      setActiveEnvironmentIdState(null);
      setDefaultEnvironmentIdState(null);
      setManualEnvIdState(null);
      setCollectionEnvOverrides({});
      setIsReady(!isOverridden ? false : true);
      return;
    }
    const keys = wsKeys(wsId);
    let cancelled = false;

    void Promise.all([
      hostStorage.get(keys.activeEnvironmentId),
      hostStorage.get(keys.defaultEnvironmentId),
      hostStorage.get(keys.manualEnvId),
      hostStorage.get(keys.collectionEnvOverrides),
    ]).then(([active, def, manual, overrides]) => {
      if (cancelled || workspaceIdRef.current !== wsId) return;
      setActiveEnvironmentIdState(readPointer(active));
      setDefaultEnvironmentIdState(readPointer(def));
      setManualEnvIdState(readPointer(manual));
      setCollectionEnvOverrides(readOverrides(overrides));
      setIsReady(true);
    });

    const disposers = [
      hostStorage.subscribe(keys.activeEnvironmentId, (next) => {
        if (workspaceIdRef.current !== wsId) return;
        setActiveEnvironmentIdState(readPointer(next));
      }),
      hostStorage.subscribe(keys.defaultEnvironmentId, (next) => {
        if (workspaceIdRef.current !== wsId) return;
        setDefaultEnvironmentIdState(readPointer(next));
      }),
      hostStorage.subscribe(keys.manualEnvId, (next) => {
        if (workspaceIdRef.current !== wsId) return;
        setManualEnvIdState(readPointer(next));
      }),
      hostStorage.subscribe(keys.collectionEnvOverrides, (next) => {
        if (workspaceIdRef.current !== wsId) return;
        setCollectionEnvOverrides(readOverrides(next));
      }),
    ];

    return () => {
      cancelled = true;
      for (const d of disposers) d();
    };
  }, [effectiveWorkspaceId, isOverridden]);

  // ── Mutators ──────────────────────────────────────────────────────
  //
  // Entity CRUD routes through the env write-client with explicit
  // workspaceId on the override branch, and the legacy SW handler on
  // the legacy branch (which operates on the runtime-active workspace
  // — equivalent to writing the legacy branch's workspaceId).

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

  // Pointer ops — both branches write per-workspace storage directly.
  // The SW environment-store subscribes to its runtime-Active
  // workspace's pointer keys and applies side-effects (DNR recompile,
  // resolver invalidate, live-refresh switch-warm) when a write
  // lands. Stale ids reconcile SW-side.

  const setActiveEnvironment = useCallback<EnvironmentContextValue['setActiveEnvironment']>(
    async (uid) => {
      const wsId = workspaceIdRef.current;
      if (!wsId) return false;
      await hostStorage.set(wsKeys(wsId).activeEnvironmentId, uid);
      return true;
    },
    [],
  );

  const setDefaultEnvironment = useCallback<EnvironmentContextValue['setDefaultEnvironment']>(
    async (uid) => {
      const wsId = workspaceIdRef.current;
      if (!wsId) return false;
      await hostStorage.set(wsKeys(wsId).defaultEnvironmentId, uid);
      return true;
    },
    [],
  );

  const setManualEnv = useCallback<EnvironmentContextValue['setManualEnv']>(
    async (uid) => {
      const wsId = workspaceIdRef.current;
      if (!wsId) return false;
      await hostStorage.set(wsKeys(wsId).manualEnvId, uid);
      return true;
    },
    [],
  );

  const setCollectionEnvOverride = useCallback<EnvironmentContextValue['setCollectionEnvOverride']>(
    async (collectionId, envId) => {
      const wsId = workspaceIdRef.current;
      if (!wsId) return;
      const next = { ...collectionEnvOverrides };
      if (envId === undefined) {
        delete next[collectionId];
      } else {
        next[collectionId] = envId;
      }
      await hostStorage.set(wsKeys(wsId).collectionEnvOverrides, next);
    },
    [collectionEnvOverrides],
  );

  const setCollectionPinnedEnvs = useCallback<EnvironmentContextValue['setCollectionPinnedEnvs']>(
    async (collectionUid, pinnedIds, defaultId) => {
      if (isOverridden) {
        const wsId = activeWorkspaceIdOverride ?? null;
        if (!wsId) return false;
        const result = await applySetPinnedAndDefault(
          { collectionUid, pinnedEnvironmentIds: pinnedIds, defaultEnvironmentId: defaultId },
          { workspaceId: wsId, surfaceId },
        );
        return result.ok;
      }
      const resp = await call('setCollectionPinnedEnvs', {
        collectionUid,
        pinnedEnvironmentIds: pinnedIds,
        defaultEnvironmentId: defaultId,
      }).catch(() => null);
      return Boolean(resp?.success);
    },
    [isOverridden, activeWorkspaceIdOverride, surfaceId],
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
