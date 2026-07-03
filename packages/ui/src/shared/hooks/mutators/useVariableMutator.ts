/**
 * useVariableMutator — single source of truth for variable writes
 * across every scope. Both the dedicated editors (Workspace / Env /
 * Collection / Vault) and the inline hover popover go through this
 * hook so the discriminated `MutationResult` shape lives in exactly
 * one place.
 *
 * The API is intentionally **write-only**: callers pass the full
 * variables list (already spliced) and the hook persists it. Reads
 * happen in the caller.
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
 * `MutationResult` is uniform: `{ ok: true }` on success,
 * `{ ok: false; reason: 'duplicate-name' | 'not-found' | 'other'; message? }`
 * on failure. Callers branch on `reason`. Sync engine §24 retired the
 * Phase 10 stale-draft contract; convergence is per-(field) LWW at the
 * oracle. Per-batch all-or-nothing covers atomic replacement.
 */

import { useEnvVarVault } from '../useEnvVarVault';
import { useLiveVariables } from '../useLiveVariables';
import { useRequests } from '../useRequests';
import { useRules } from '../useRules';
import type { LiveVariableOverride, Variable, VaultSecret } from '@openheaders/core/types';
import { useCallback } from 'react';
import { applyCollectionVariablesReplacement } from '@openheaders/ui/shared/sync/collection-write-client';
import { applyEnvVariablesReplacement } from '@openheaders/ui/shared/sync/env-write-client';
import { applyRequestCollectionVariablesReplacement } from '@openheaders/ui/shared/sync/request-collection-write-client';
import { applyTemplateCollectionVariablesReplacement } from '@openheaders/ui/shared/sync/template-collection-write-client';
import { applyVaultReplacement } from '@openheaders/ui/shared/sync/vault-write-client';
import { applyWorkspaceVariablesReplacement } from '@openheaders/ui/shared/sync/workspace-variables-write-client';

// ── Result shape ─────────────────────────────────────────────────────

export type MutationFailureReason = 'duplicate-name' | 'not-found' | 'other';

export type MutationResult = { ok: true } | { ok: false; reason: MutationFailureReason; message?: string };

// ── Hook ─────────────────────────────────────────────────────────────

export interface UseVariableMutatorApi {
  /** Replace the workspace variables list. */
  replaceWorkspaceVariables(variables: Variable[]): Promise<MutationResult>;
  /** Replace an environment's variables list. */
  replaceEnvironmentVariables(envUid: string, variables: Variable[]): Promise<MutationResult>;
  /** Replace a rule-collection's variables list. */
  replaceCollectionVariables(collectionUid: string, variables: Variable[]): Promise<MutationResult>;
  /** Replace a request-collection's variables list. */
  replaceRequestCollectionVariables(collectionUid: string, variables: Variable[]): Promise<MutationResult>;
  /** Replace a template-collection's variables list. */
  replaceTemplateCollectionVariables(collectionUid: string, variables: Variable[]): Promise<MutationResult>;
  /** Replace the vault. */
  replaceVault(secrets: VaultSecret[]): Promise<MutationResult>;
  /** Set or clear a live variable's manual override. */
  setLiveOverride(uid: string, override: LiveVariableOverride | null): Promise<MutationResult>;
}

export function useVariableMutator(): UseVariableMutatorApi {
  const { vault, environments, workspaceVariables: currentWorkspaceVariables } = useEnvVarVault();
  const { localCollections, templateCollections, activeWorkspaceId: workspaceId } = useRules();
  const { collections: requestCollections } = useRequests();
  const { setOverride } = useLiveVariables();

  const replaceWorkspaceVariables = useCallback<UseVariableMutatorApi['replaceWorkspaceVariables']>(
    async (variables) => {
      if (!workspaceId) return { ok: false, reason: 'other', message: 'no active workspace' };
      const result = await applyWorkspaceVariablesReplacement(variables, currentWorkspaceVariables.variables, {
        workspaceId,
        surfaceId: 'workbench',
      });
      if (result.ok) return { ok: true };
      const message = result.reason === 'other' ? result.message : undefined;
      return { ok: false, reason: 'other', message };
    },
    [workspaceId, currentWorkspaceVariables],
  );

  const replaceEnvironmentVariables = useCallback<UseVariableMutatorApi['replaceEnvironmentVariables']>(
    async (envUid, variables) => {
      if (!workspaceId) return { ok: false, reason: 'other', message: 'no active workspace' };
      const env = environments.find((e) => e.uid === envUid);
      if (!env) return { ok: false, reason: 'not-found' };
      const result = await applyEnvVariablesReplacement(envUid, variables, env.variables, {
        workspaceId,
        surfaceId: 'workbench',
      });
      if (result.ok) return { ok: true };
      if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other', message: result.message };
    },
    [workspaceId, environments],
  );

  const replaceCollectionVariables = useCallback<UseVariableMutatorApi['replaceCollectionVariables']>(
    async (collectionUid, variables) => {
      if (!workspaceId) return { ok: false, reason: 'other', message: 'no active workspace' };
      const collection = localCollections.find((c) => c.uid === collectionUid);
      if (!collection) return { ok: false, reason: 'not-found' };
      const result = await applyCollectionVariablesReplacement(collectionUid, variables, collection.variables, {
        workspaceId,
        surfaceId: 'workbench',
      });
      if (result.ok) return { ok: true };
      if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other', message: result.message };
    },
    [workspaceId, localCollections],
  );

  const replaceRequestCollectionVariables = useCallback<UseVariableMutatorApi['replaceRequestCollectionVariables']>(
    async (collectionUid, variables) => {
      if (!workspaceId) return { ok: false, reason: 'other', message: 'no active workspace' };
      const collection = requestCollections.find((c) => c.uid === collectionUid);
      if (!collection) return { ok: false, reason: 'not-found' };
      const result = await applyRequestCollectionVariablesReplacement(collectionUid, variables, collection.variables, {
        workspaceId,
        surfaceId: 'workbench',
      });
      if (result.ok) return { ok: true };
      if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other', message: result.message };
    },
    [workspaceId, requestCollections],
  );

  const replaceTemplateCollectionVariables = useCallback<UseVariableMutatorApi['replaceTemplateCollectionVariables']>(
    async (collectionUid, variables) => {
      if (!workspaceId) return { ok: false, reason: 'other', message: 'no active workspace' };
      const collection = templateCollections.find((c) => c.uid === collectionUid);
      if (!collection) return { ok: false, reason: 'not-found' };
      const result = await applyTemplateCollectionVariablesReplacement(collectionUid, variables, collection.variables, {
        workspaceId,
        surfaceId: 'workbench',
      });
      if (result.ok) return { ok: true };
      if (result.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other', message: result.message };
    },
    [workspaceId, templateCollections],
  );

  const replaceVault = useCallback<UseVariableMutatorApi['replaceVault']>(
    async (secrets) => {
      if (!workspaceId) return { ok: false, reason: 'other', message: 'no active workspace' };
      const result = await applyVaultReplacement(secrets, vault.secrets, {
        workspaceId,
        surfaceId: 'workbench',
      });
      if (result.ok) return { ok: true };
      const message = result.reason === 'other' ? result.message : undefined;
      return { ok: false, reason: 'other', message };
    },
    [workspaceId, vault],
  );

  const setLiveOverride = useCallback<UseVariableMutatorApi['setLiveOverride']>(
    async (uid, override) => {
      const r = await setOverride(uid, override);
      // Live variable RPCs use {success, reason} — distinct from the
      // {ok, reason} editor shape. Map both into MutationResult so
      // callers don't care which RPC family they hit.
      if (r.success) return { ok: true };
      if (r.reason === 'not-found') return { ok: false, reason: 'not-found' };
      return { ok: false, reason: 'other' };
    },
    [setOverride],
  );

  return {
    replaceWorkspaceVariables,
    replaceEnvironmentVariables,
    replaceCollectionVariables,
    replaceRequestCollectionVariables,
    replaceTemplateCollectionVariables,
    replaceVault,
    setLiveOverride,
  };
}
