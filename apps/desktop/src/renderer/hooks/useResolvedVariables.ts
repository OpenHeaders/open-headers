/**
 * useResolvedVariables — single source of truth for {{VAR}} resolution.
 *
 * Merges all 4 variable scopes in priority order:
 *   1. Secret  (highest — TODO: vault not yet wired)
 *   2. Environment (active environment + source-produced variables)
 *   3. Collection (scoped to the given collectionId)
 *   4. Workspace (lowest — global variables)
 *
 * Consumers:
 *   - TemplateInput (autocomplete + hover popovers)
 *   - Inspector (right sidebar variable panel)
 *   - Any editor that needs variable resolution context
 */

import { useMemo } from 'react';
import { useCollections, useEnvironments, useSources, useWorkspaceVariables } from './useCentralizedWorkspace';

// ── Public types ─────────────────────────────────────────────────

export type VariableScope = 'secret' | 'environment' | 'collection' | 'workspace';

/** A single resolved variable with its scope metadata. */
export interface ResolvedVarInfo {
  value: string;
  isSensitive: boolean;
  scope: VariableScope;
  /** Human-readable scope label (e.g. "Development", "My Collection", "Workspace") */
  scopeLabel: string;
  /** Source name when the value is produced by a source's storeAsVariable */
  producedBy?: string;
}

/** Per-scope variable entry (no scope field — the scope is the key). */
export interface ScopeVarEntry {
  value: string;
  isSensitive: boolean;
  description?: string;
  producedBy?: string;
}

/** Per-scope breakdown for Inspector display. */
export interface VariablesByScope {
  secret: Record<string, ScopeVarEntry>;
  environment: Record<string, ScopeVarEntry>;
  collection: Record<string, ScopeVarEntry>;
  workspace: Record<string, ScopeVarEntry>;
}

export interface ResolvedVariablesResult {
  /**
   * Flat resolved map — highest-priority scope wins per variable name.
   * This is what TemplateInput consumes for autocomplete and highlighting.
   */
  resolved: Record<string, ResolvedVarInfo>;

  /**
   * Per-scope breakdown — every scope's variables independently.
   * This is what Inspector consumes to show all scopes side by side.
   */
  byScope: VariablesByScope;

  /** Active environment name (null when "No environment" selected). */
  activeEnvironmentName: string | null;

  /** Collection name for the given collectionId (null when no collection). */
  activeCollectionName: string | null;
}

// ── Hook ─────────────────────────────────────────────────────────

export function useResolvedVariables(collectionId?: string | null): ResolvedVariablesResult {
  const { environments, activeEnvironment } = useEnvironments();
  const { collections } = useCollections();
  const { sources } = useSources();
  const { workspaceVariables } = useWorkspaceVariables();

  const activeEnv = activeEnvironment ? environments.find((e) => e.id === activeEnvironment) : undefined;
  const activeEnvName = activeEnv?.name ?? null;

  const collection = collectionId ? collections.find((c) => c.id === collectionId) : undefined;
  const activeColName = collection?.name ?? null;

  // Source-produced variables (sources with storeAsVariable set)
  const sourceOutputMap = useMemo(() => {
    const map = new Map<string, { value: string; sourceName: string }>();
    for (const source of sources) {
      if (
        source.storeAsVariable &&
        source.sourceContent !== null &&
        source.sourceContent !== undefined &&
        source.activationState !== 'waiting_for_deps'
      ) {
        map.set(source.storeAsVariable, {
          value: source.sourceContent,
          sourceName: source.sourceName || source.sourcePath || source.sourceId,
        });
      }
    }
    return map;
  }, [sources]);

  return useMemo(() => {
    // ── Build per-scope maps ─────────────────────────────────────

    const envScope: Record<string, ScopeVarEntry> = {};
    const activeEnvVars = activeEnv?.variables ?? {};
    for (const [name, variable] of Object.entries(activeEnvVars)) {
      envScope[name] = {
        value: variable.value,
        isSensitive: variable.isSensitive,
        description: variable.description,
      };
    }
    // Add source-produced variables (environment scope, not already defined)
    for (const [name, output] of sourceOutputMap) {
      if (!envScope[name]) {
        envScope[name] = {
          value: output.value,
          isSensitive: false,
          producedBy: output.sourceName,
        };
      }
    }

    const colScope: Record<string, ScopeVarEntry> = {};
    for (const [name, variable] of Object.entries(collection?.variables ?? {})) {
      colScope[name] = {
        value: variable.value,
        isSensitive: variable.isSensitive,
        description: variable.description,
      };
    }

    const wsScope: Record<string, ScopeVarEntry> = {};
    for (const [name, variable] of Object.entries(workspaceVariables)) {
      wsScope[name] = {
        value: variable.value,
        isSensitive: variable.isSensitive,
        description: variable.description,
      };
    }

    const secretScope: Record<string, ScopeVarEntry> = {};
    // TODO: wire vault secrets when vault UI is implemented

    const byScope: VariablesByScope = {
      secret: secretScope,
      environment: envScope,
      collection: colScope,
      workspace: wsScope,
    };

    // ── Build flat resolved map (priority: secret > env > collection > workspace) ──

    const resolved: Record<string, ResolvedVarInfo> = {};

    // Lowest priority first, higher overwrites
    for (const [name, entry] of Object.entries(wsScope)) {
      resolved[name] = {
        value: entry.value,
        isSensitive: entry.isSensitive,
        scope: 'workspace',
        scopeLabel: 'Workspace',
      };
    }

    for (const [name, entry] of Object.entries(colScope)) {
      resolved[name] = {
        value: entry.value,
        isSensitive: entry.isSensitive,
        scope: 'collection',
        scopeLabel: activeColName ?? 'Collection',
      };
    }

    for (const [name, entry] of Object.entries(envScope)) {
      resolved[name] = {
        value: entry.value,
        isSensitive: entry.isSensitive,
        scope: 'environment',
        scopeLabel: activeEnvName ?? 'Environment',
        producedBy: entry.producedBy,
      };
    }

    for (const [name, entry] of Object.entries(secretScope)) {
      resolved[name] = {
        value: entry.value,
        isSensitive: true,
        scope: 'secret',
        scopeLabel: 'Secret',
      };
    }

    return {
      resolved,
      byScope,
      activeEnvironmentName: activeEnvName,
      activeCollectionName: activeColName,
    };
  }, [activeEnv, activeEnvName, collection, activeColName, sourceOutputMap, workspaceVariables]);
}
