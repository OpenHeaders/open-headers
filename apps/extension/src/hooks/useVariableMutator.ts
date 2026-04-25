/**
 * useVariableMutator — single source of truth for variable writes
 * across every scope. Both the dedicated editors (Workspace / Env /
 * Collection / Vault) and the inline hover popover go through this
 * hook so the discriminated `MutationResult` shape (and its mapping
 * to the bridge's varying response shapes) lives in exactly one place.
 *
 * The API is intentionally **write-only**: callers pass the full
 * variables list (already spliced) plus the expected version, and the
 * hook persists it. Reads happen in the caller.
 *
 * The reason for the write-only shape: each `useEnvironments()` call
 * is an INDEPENDENT React state instance that hydrates via its own
 * post-mount effects. If this hook also called `useEnvironments()`
 * and did a read-modify-write internally, its view could race against
 * the caller's view (the popover saw a value that the mutator hadn't
 * loaded yet) and the splice would clobber every other variable. By
 * having callers do the read against THEIR OWN useEnvironments view
 * and pass the resulting list here, the read and the splice are
 * always against the same snapshot — no race.
 *
 * `MutationResult` is uniform: `{ ok: true; version }` on success,
 * `{ ok: false; reason: 'stale-draft' | 'duplicate-name' | 'not-found' | 'other'; message? }`
 * on failure. Callers branch on `reason`; bridge response shapes never
 * leak past this hook.
 */

import { useEnvironments } from '@hooks/useEnvironments';
import { useLiveVariables } from '@hooks/useLiveVariables';
import type { V5 } from '@openheaders/core/types';
import { useCallback } from 'react';

// ── Result shape ─────────────────────────────────────────────────────

export type MutationFailureReason = 'stale-draft' | 'duplicate-name' | 'not-found' | 'other';

export type MutationResult =
  | { ok: true; version: number }
  | { ok: false; reason: 'stale-draft'; serverVersion: number }
  | { ok: false; reason: 'duplicate-name' | 'not-found' | 'other'; message?: string };

// ── Hook ─────────────────────────────────────────────────────────────

export interface UseVariableMutatorApi {
  /** Replace the workspace variables list. */
  replaceWorkspaceVariables(variables: V5.Variable[], expectedVersion?: number): Promise<MutationResult>;
  /** Replace an environment's variables list. */
  replaceEnvironmentVariables(
    envUid: string,
    variables: V5.Variable[],
    expectedVersion?: number,
  ): Promise<MutationResult>;
  /** Replace a collection's variables list. */
  replaceCollectionVariables(
    collectionUid: string,
    variables: V5.Variable[],
    expectedVersion?: number,
  ): Promise<MutationResult>;
  /** Replace the vault. */
  replaceVault(secrets: V5.VaultSecret[], expectedVersion?: number): Promise<MutationResult>;
  /** Set or clear a live variable's manual override. */
  setLiveOverride(
    uid: string,
    override: V5.LiveVariableOverride | null,
    expectedVersion?: number,
  ): Promise<MutationResult>;
}

export function useVariableMutator(): UseVariableMutatorApi {
  const { setVault, updateEnvironmentVariables, updateCollectionVariables, setWorkspaceVariables } = useEnvironments();
  const { setOverride } = useLiveVariables();

  const replaceWorkspaceVariables = useCallback<UseVariableMutatorApi['replaceWorkspaceVariables']>(
    async (variables, expectedVersion) => {
      const r = await setWorkspaceVariables(
        { schemaVersion: 5, version: expectedVersion ?? 1, variables },
        expectedVersion,
      );
      return mapWriteResult(r);
    },
    [setWorkspaceVariables],
  );

  const replaceEnvironmentVariables = useCallback<UseVariableMutatorApi['replaceEnvironmentVariables']>(
    async (envUid, variables, expectedVersion) => {
      const r = await updateEnvironmentVariables(envUid, variables, expectedVersion);
      return mapWriteResult(r);
    },
    [updateEnvironmentVariables],
  );

  const replaceCollectionVariables = useCallback<UseVariableMutatorApi['replaceCollectionVariables']>(
    async (collectionUid, variables, expectedVersion) => {
      const r = await updateCollectionVariables(collectionUid, variables, expectedVersion);
      return mapWriteResult(r);
    },
    [updateCollectionVariables],
  );

  const replaceVault = useCallback<UseVariableMutatorApi['replaceVault']>(
    async (secrets, expectedVersion) => {
      const r = await setVault({ schemaVersion: 5, version: expectedVersion ?? 1, secrets }, expectedVersion);
      return mapWriteResult(r);
    },
    [setVault],
  );

  const setLiveOverride = useCallback<UseVariableMutatorApi['setLiveOverride']>(
    async (uid, override, expectedVersion) => {
      const r = await setOverride(uid, override, expectedVersion);
      // Live variable RPCs use {success, reason} — distinct from the
      // {ok, reason} editor shape. Map both into MutationResult so
      // callers don't care which RPC family they hit.
      if (r.success) {
        return { ok: true, version: r.variable.version };
      }
      if (r.reason === 'stale-draft') {
        return { ok: false, reason: 'stale-draft', serverVersion: r.serverVersion ?? 0 };
      }
      if (r.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other' };
    },
    [setOverride],
  );

  return {
    replaceWorkspaceVariables,
    replaceEnvironmentVariables,
    replaceCollectionVariables,
    replaceVault,
    setLiveOverride,
  };
}

// ── Internal helpers ─────────────────────────────────────────────────

interface BridgeWriteResult {
  ok?: boolean;
  reason?: string;
  version?: number;
  serverVersion?: number;
  message?: string;
}

function mapWriteResult(r: BridgeWriteResult): MutationResult {
  if (r.ok && typeof r.version === 'number') return { ok: true, version: r.version };
  if (r.reason === 'stale-draft') {
    return { ok: false, reason: 'stale-draft', serverVersion: r.serverVersion ?? 0 };
  }
  if (r.reason === 'not-found') return { ok: false, reason: 'not-found' };
  return { ok: false, reason: 'other', message: r.message };
}
