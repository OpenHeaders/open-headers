/**
 * useVariableLookup — given the raw inner of a `{{...}}` reference,
 * report every scope that defines it, the active resolved value, and
 * the per-source metadata needed to edit it inline (uid + version for
 * stale-draft tracking).
 *
 * Pure derivation of the same store subscriptions `useVariableResolver`
 * already uses — no extra bridge calls. Returns `null` for refs that
 * don't parse (callers render a "Not defined" affordance themselves).
 */

import { useEnvironments } from '@hooks/useEnvironments';
import { useAllLiveCaches } from '@hooks/useLiveCache';
import { useLiveVariables } from '@hooks/useLiveVariables';
import { useLiveWorkflows } from '@hooks/useLiveWorkflows';
import { useRules } from '@hooks/useRules';
import { useVariableResolver } from '@hooks/useVariableResolver';
import type { V5 } from '@openheaders/core/types';
import { parseReference, parseStepRefName, type VariableNamespace } from '@openheaders/core/variables';
import { useMemo } from 'react';

export type VariableCandidate =
  | {
      scope: 'vault';
      kind: 'string' | 'totp';
      secret: V5.VaultSecret;
      vaultVersion: number;
    }
  | {
      scope: 'environment';
      envUid: string;
      envName: string;
      envVersion: number;
      isActive: boolean;
      isDefault: boolean;
      variable: V5.Variable;
    }
  | {
      scope: 'collection';
      collectionUid: string;
      collectionName: string;
      collectionVersion: number;
      variable: V5.Variable;
    }
  | {
      scope: 'workspace';
      workspaceVersion: number;
      variable: V5.Variable;
    }
  | {
      scope: 'live';
      lv: V5.LiveVariable;
      cached?: { value: string; stale: boolean; environmentId: string | null };
      override?: V5.LiveVariableOverride;
    }
  | {
      scope: 'step';
      stepId: string;
      captureName: string;
    }
  | {
      scope: 'file';
      name: string;
    }
  | { scope: 'reserved'; namespace: VariableNamespace };

export interface VariableLookupResult {
  /** Trimmed raw inner of the reference, e.g. `"TEST"` or `"env.X"`. */
  reference: string;
  /** Parsed namespace (null = flat form). */
  namespace: VariableNamespace | null;
  /** Bare name without namespace prefix. For step refs this is `stepId.captureName`. */
  name: string;
  parseError?: 'empty' | 'unknown-namespace';
  /** Resolved value the resolver would actually substitute. */
  active: {
    value: string;
    scope: V5.VariableScope;
    isSensitive: boolean;
    deferred?: boolean;
  } | null;
  candidates: VariableCandidate[];
  activeEnvName: string | null;
  defaultEnvName: string | null;
}

export function useVariableLookup(reference: string, collectionId?: string): VariableLookupResult {
  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvironments();
  const { localCollections } = useRules();
  const { variables: liveVariables } = useLiveVariables();
  const { workflows: liveWorkflows } = useLiveWorkflows();
  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);
  const resolver = useVariableResolver();

  return useMemo<VariableLookupResult>(() => {
    const trimmed = reference.trim();
    const parsed = parseReference(trimmed);

    const activeEnvName = activeEnvironmentId
      ? (environments.find((e) => e.uid === activeEnvironmentId)?.name ?? null)
      : null;
    const defaultEnvName = defaultEnvironmentId
      ? (environments.find((e) => e.uid === defaultEnvironmentId)?.name ?? null)
      : null;

    if (!parsed.ok) {
      return {
        reference: trimmed,
        namespace: null,
        name: trimmed,
        parseError: parsed.reason,
        active: null,
        candidates: [],
        activeEnvName,
        defaultEnvName,
      };
    }

    const { ref } = parsed;
    const ctx = collectionId ? { collectionId } : undefined;
    const resolved =
      ref.namespace === null ? resolver.resolve(ref.name, ctx) : resolver.resolveScoped(ref.name, ref.namespace, ctx);

    const candidates: VariableCandidate[] = [];

    const wantNs = (ns: VariableNamespace) => ref.namespace === null || ref.namespace === ns;

    // Vault — only when ref is flat or `{{vault.X}}`.
    if (wantNs('vault')) {
      const secret = vault.secrets.find((s) => s.name === ref.name);
      if (secret) {
        candidates.push({
          scope: 'vault',
          kind: secret.kind,
          secret,
          vaultVersion: vault.version,
        });
      }
    }

    // Environments — for flat or `{{env.X}}`. List active + default
    // separately (they're the only envs the resolver looks at; other
    // envs aren't in the resolution chain for THIS lookup, but a user
    // who defined the same name in a third env probably wants to see
    // it. v1: include every env that defines the name, marked with
    // isActive / isDefault flags.
    if (wantNs('env')) {
      for (const env of environments) {
        const variable = env.variables.find((v) => v.name === ref.name);
        if (!variable) continue;
        candidates.push({
          scope: 'environment',
          envUid: env.uid,
          envName: env.name,
          envVersion: env.version,
          isActive: env.uid === activeEnvironmentId,
          isDefault: env.uid === defaultEnvironmentId,
          variable,
        });
      }
    }

    // Collection — for flat or `{{collection.X}}`. Only the
    // request/rule's owning collection participates in resolution.
    if (wantNs('collection') && collectionId) {
      const collection = localCollections.find((c) => c.uid === collectionId);
      if (collection) {
        const variable = collection.variables?.find((v) => v.name === ref.name);
        if (variable) {
          candidates.push({
            scope: 'collection',
            collectionUid: collection.uid,
            collectionName: collection.name,
            collectionVersion: collection.version,
            variable,
          });
        }
      }
    }

    // Workspace.
    if (wantNs('workspace')) {
      const variable = workspaceVariables.variables.find((v) => v.name === ref.name);
      if (variable) {
        candidates.push({
          scope: 'workspace',
          workspaceVersion: workspaceVariables.version,
          variable,
        });
      }
    }

    // Live.
    if (ref.namespace === 'live') {
      const lv = liveVariables.find((v) => v.name === ref.name);
      if (lv) {
        const runs = liveCaches[lv.workflowUid] ?? [];
        const run =
          runs.find((r) => r.environmentId === activeEnvironmentId) ??
          runs.find((r) => r.environmentId === null) ??
          null;
        const cachedValue = run?.stepCaptures[lv.stepId]?.[lv.captureName];
        const nowMs = Date.now();
        const stale = run?.expiresAt != null && run.expiresAt < nowMs;
        const overrideActive =
          lv.manualOverride && (lv.manualOverride.until === undefined || lv.manualOverride.until > nowMs)
            ? lv.manualOverride
            : undefined;
        candidates.push({
          scope: 'live',
          lv,
          cached:
            typeof cachedValue === 'string'
              ? { value: cachedValue, stale: !!stale, environmentId: run?.environmentId ?? null }
              : undefined,
          override: overrideActive,
        });
      }
    }

    // Step.
    if (ref.namespace === 'step') {
      const parts = parseStepRefName(ref.name);
      if (parts) candidates.push({ scope: 'step', stepId: parts.stepId, captureName: parts.captureName });
    }

    // File.
    if (ref.namespace === 'file') {
      candidates.push({ scope: 'file', name: ref.name });
    }

    // Reserved.
    if (ref.namespace === 'dynamic') {
      candidates.push({ scope: 'reserved', namespace: 'dynamic' });
    }

    return {
      reference: trimmed,
      namespace: ref.namespace,
      name: ref.name,
      active: resolved
        ? {
            value: resolved.value,
            scope: resolved.scope,
            isSensitive: resolved.isSensitive,
            deferred: resolved.deferred,
          }
        : null,
      candidates,
      activeEnvName,
      defaultEnvName,
    };
  }, [
    reference,
    collectionId,
    resolver,
    vault,
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    localCollections,
    liveVariables,
    liveCaches,
  ]);
}
