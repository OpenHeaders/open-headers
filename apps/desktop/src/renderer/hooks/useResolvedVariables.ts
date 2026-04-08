/**
 * useResolvedVariables — single source of truth for {{VAR}} resolution.
 *
 * Merges all 4 variable scopes in priority order:
 *   1. Vault   (highest — secrets, never synced)
 *   2. Environment (active environment variables)
 *   3. Collection (scoped to the given collectionId)
 *   4. Workspace (lowest — global variables)
 */

import type { V5 } from '@openheaders/core/types';
import { useMemo } from 'react';
import { useCollections, useEnvironments, useWorkspaceVariables } from './useCentralizedWorkspace';
import { useCentralizedWorkspace } from './useCentralizedWorkspace';

// ── Public types ─────────────────────────────────────────────────

export type VariableScope = 'vault' | 'environment' | 'collection' | 'workspace';

/** A single resolved variable with its scope metadata. */
export interface ResolvedVarInfo {
  value: string;
  isSensitive: boolean;
  scope: VariableScope;
  /** Human-readable scope label (e.g. "Development", "My Collection", "Workspace") */
  scopeLabel: string;
}

/** Per-scope variable entry. */
export interface ScopeVarEntry {
  value: string;
  isSensitive: boolean;
}

/** Per-scope breakdown for Inspector display. */
export interface VariablesByScope {
  vault: Record<string, ScopeVarEntry>;
  environment: Record<string, ScopeVarEntry>;
  collection: Record<string, ScopeVarEntry>;
  workspace: Record<string, ScopeVarEntry>;
}

export interface ResolvedVariablesResult {
  resolved: Record<string, ResolvedVarInfo>;
  byScope: VariablesByScope;
  activeEnvironmentName: string | null;
  activeCollectionName: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────

function variablesToScope(vars: V5.Variable[]): Record<string, ScopeVarEntry> {
  const scope: Record<string, ScopeVarEntry> = {};
  for (const v of vars) {
    scope[v.name] = { value: v.value, isSensitive: v.type === 'secret' };
  }
  return scope;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useResolvedVariables(collectionId?: string | null): ResolvedVariablesResult {
  const { environments, activeEnvironment } = useEnvironments();
  const { collections } = useCollections();
  const { workspaceVariables } = useWorkspaceVariables();
  const { vault } = useCentralizedWorkspace();

  const activeEnv = activeEnvironment ? environments.find((e) => e.name === activeEnvironment) : undefined;
  const activeEnvName = activeEnv?.name ?? null;

  const collection = collectionId ? collections.find((c) => c.uid === collectionId) : undefined;
  const activeColName = collection?.name ?? null;

  return useMemo(() => {
    const vaultScope = variablesToScope(
      (vault?.secrets ?? []).map((s) => ({ name: s.name, value: s.value, type: 'secret' as const })),
    );
    const envScope = variablesToScope(activeEnv?.variables ?? []);
    const colScope = variablesToScope(collection?.variables ?? []);
    const wsScope = variablesToScope(workspaceVariables?.variables ?? []);

    const byScope: VariablesByScope = {
      vault: vaultScope,
      environment: envScope,
      collection: colScope,
      workspace: wsScope,
    };

    // Build flat resolved map (priority: vault > env > collection > workspace)
    const resolved: Record<string, ResolvedVarInfo> = {};

    // Lowest priority first, higher overwrites
    for (const [name, entry] of Object.entries(wsScope)) {
      resolved[name] = { ...entry, scope: 'workspace', scopeLabel: 'Workspace' };
    }
    for (const [name, entry] of Object.entries(colScope)) {
      resolved[name] = { ...entry, scope: 'collection', scopeLabel: activeColName ?? 'Collection' };
    }
    for (const [name, entry] of Object.entries(envScope)) {
      resolved[name] = { ...entry, scope: 'environment', scopeLabel: activeEnvName ?? 'Environment' };
    }
    for (const [name, entry] of Object.entries(vaultScope)) {
      resolved[name] = { ...entry, isSensitive: true, scope: 'vault', scopeLabel: 'Vault' };
    }

    return { resolved, byScope, activeEnvironmentName: activeEnvName, activeCollectionName: activeColName };
  }, [activeEnv, activeEnvName, collection, activeColName, workspaceVariables, vault]);
}
