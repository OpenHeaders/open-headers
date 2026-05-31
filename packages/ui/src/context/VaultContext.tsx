/**
 * VaultContext — vault singleton-entity provider.
 *
 * Mirrors `WorkspaceVariablesContext` (per MWPT-FULL § 4.1.b — three
 * sibling providers stack: Environment → WorkspaceVariables → Vault).
 *
 *   - Override branch: reads `wsKeys(workspaceId).vault` via storage
 *     subscribe; writes route through `vault-write-client` with the
 *     explicit workspaceId. Diverged tabs editing W2 see and write to
 *     W2's vault, regardless of runtime-Active.
 *   - Legacy branch: reads via `getVault` RPC + `environmentsChanged`
 *     broadcast (the SW publishes vault on the env channel). Writes
 *     route through the Phase B write-client with `useActiveWorkspaceId()`
 *     as the implicit workspaceId.
 *
 * No § 4.1.c residual: vault has no active/default pointer concept, so
 * the migration covers all writes. Vault is local-only per §12.3 — the
 * apply pipe never crosses any sync transport, but per-workspace
 * projection equality holds the same way as for ws-vars.
 */

import type { Vault, VaultSecret } from '@openheaders/core/types';
import { VaultSchema } from '@openheaders/core/schemas';
import { useActiveWorkspaceId } from '../shared/hooks/useActiveWorkspaceId';
import { hostBridge } from '@openheaders/core/bridge';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { hostStorage, wsKeys } from '@openheaders/core/storage';
import {
  applyVaultReplacement,
  applyVaultSecretRemove,
  applyVaultSecretSet,
  type VaultSimpleResult,
} from '../shared/sync/vault-write-client';

const EMPTY_VAULT: Vault = { schemaVersion: 5, secrets: [] };

export interface VaultContextValue {
  vault: Vault;
  isReady: boolean;
  /**
   * True when the persisted vault ciphertext is present but undecryptable —
   * the at-rest key was lost (WS-B B2). `vault` reads empty, but consumers
   * MUST surface "re-entry required" rather than an editable empty table:
   * a write over a locked vault would overwrite recoverable ciphertext.
   */
  isLocked: boolean;
  setVaultSecret: (secret: VaultSecret) => Promise<VaultSimpleResult>;
  removeVaultSecret: (uid: string) => Promise<VaultSimpleResult>;
  replaceVault: (
    newSecrets: readonly VaultSecret[],
    oldSecrets: readonly VaultSecret[],
  ) => Promise<VaultSimpleResult>;
}

const NO_WORKSPACE: VaultSimpleResult = { ok: false, reason: 'other', message: 'no workspace' };

const defaultContextValue: VaultContextValue = {
  vault: EMPTY_VAULT,
  isReady: false,
  isLocked: false,
  setVaultSecret: () => Promise.resolve(NO_WORKSPACE),
  removeVaultSecret: () => Promise.resolve(NO_WORKSPACE),
  replaceVault: () => Promise.resolve(NO_WORKSPACE),
};

export const VaultContext = createContext<VaultContextValue>(defaultContextValue);

interface VaultProviderProps {
  children: React.ReactNode;
  /** Surface attribution carried on every emitted vault envelope. */
  surfaceId: string;
  /**
   * Editing-scope workspace id override (workbench surface only).
   * See `WorkspaceVariablesProvider` / `EnvironmentProvider` for the
   * full discipline contract; same shape here for the vault singleton
   * slice (BC-MWPT-FULL-1-vault / BC-MWPT-FULL-2-vault).
   * System surfaces (popup / sidepanel / panel) MUST NOT pass this prop.
   */
  activeWorkspaceIdOverride?: string | null;
}

export const VaultProvider: React.FC<VaultProviderProps> = ({ children, surfaceId, activeWorkspaceIdOverride }) => {
  const isOverridden = activeWorkspaceIdOverride !== undefined;
  const activeWorkspaceId = useActiveWorkspaceId();
  const writeWorkspaceId = isOverridden ? (activeWorkspaceIdOverride ?? null) : activeWorkspaceId;

  const [vault, setVault] = useState<Vault>(EMPTY_VAULT);
  const [isReady, setIsReady] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const overrideIdRef = useRef<string | null>(null);

  // ── Read path ─────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    const initialLoad = async () => {
      if (isOverridden) return;
      const resp = await hostBridge.call('getVault').catch(() => null);
      if (cancelled) return;
      if (resp) {
        setVault(resp.vault);
        setIsLocked(resp.vaultLocked ?? false);
      }
      setIsReady(true);
    };
    void initialLoad();

    const unsub = hostBridge.subscribe('environmentsChanged', (payload) => {
      if (isOverridden) return;
      setVault(payload.vault);
      setIsLocked(payload.vaultLocked ?? false);
    });
    const unsubWs = hostBridge.subscribe('workspaceChanged', () => {
      if (isOverridden) return;
      void hostBridge.call('getVault')
        .then((resp) => {
          setVault(resp.vault);
          setIsLocked(resp.vaultLocked ?? false);
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
      unsub();
      unsubWs();
    };
  }, [isOverridden]);

  useEffect(() => {
    if (!isOverridden) return;
    const wsId = activeWorkspaceIdOverride ?? null;
    overrideIdRef.current = wsId;
    if (!wsId) {
      setVault(EMPTY_VAULT);
      setIsLocked(false);
      setIsReady(true);
      return;
    }
    setIsReady(false);

    // Guarded tri-state read: the direct-storage path bypasses the SW cache's
    // lock, so it must detect the undecryptable-but-present slot itself.
    // `subscribe` only carries the decrypted record (null on undecryptable),
    // so re-derive through `getValidatedGuarded` on every change. Hosts with
    // no cipher (in-memory fakes) omit it → fall back to a plain read.
    const key = wsKeys(wsId).vault;
    const readGuarded = async () => {
      if (hostStorage.getValidatedGuarded) {
        const guarded = await hostStorage.getValidatedGuarded(key, VaultSchema);
        if (overrideIdRef.current !== wsId) return;
        setIsLocked(guarded.status === 'undecryptable');
        setVault(guarded.status === 'ok' ? (guarded.value ?? EMPTY_VAULT) : EMPTY_VAULT);
      } else {
        const record = await hostStorage.get(key);
        if (overrideIdRef.current !== wsId) return;
        setIsLocked(false);
        setVault(record ?? EMPTY_VAULT);
      }
    };

    void readGuarded().then(() => {
      if (overrideIdRef.current === wsId) setIsReady(true);
    });
    return hostStorage.subscribe(key, () => {
      void readGuarded();
    });
  }, [isOverridden, activeWorkspaceIdOverride]);

  // ── Mutators ──────────────────────────────────────────────────

  const setVaultSecret = useCallback<VaultContextValue['setVaultSecret']>(
    async (secret) => {
      if (!writeWorkspaceId) return NO_WORKSPACE;
      return applyVaultSecretSet({ secret }, { workspaceId: writeWorkspaceId, surfaceId });
    },
    [writeWorkspaceId, surfaceId],
  );

  const removeVaultSecret = useCallback<VaultContextValue['removeVaultSecret']>(
    async (uid) => {
      if (!writeWorkspaceId) return NO_WORKSPACE;
      return applyVaultSecretRemove({ uid }, { workspaceId: writeWorkspaceId, surfaceId });
    },
    [writeWorkspaceId, surfaceId],
  );

  const replaceVault = useCallback<VaultContextValue['replaceVault']>(
    async (newSecrets, oldSecrets) => {
      if (!writeWorkspaceId) return NO_WORKSPACE;
      return applyVaultReplacement(newSecrets, oldSecrets, { workspaceId: writeWorkspaceId, surfaceId });
    },
    [writeWorkspaceId, surfaceId],
  );

  const value = useMemo<VaultContextValue>(
    () => ({
      vault,
      isReady,
      isLocked,
      setVaultSecret,
      removeVaultSecret,
      replaceVault,
    }),
    [vault, isReady, isLocked, setVaultSecret, removeVaultSecret, replaceVault],
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};

export function useVaultContext(): VaultContextValue {
  return useContext(VaultContext);
}
