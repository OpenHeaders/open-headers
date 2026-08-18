/**
 * useVariableSuggestions — renderer-side assembly of the cross-scope
 * variable-suggestion list for a given input site.
 *
 * Subscribes to the same stores that feed the resolver (env / vault /
 * workspace vars / collections / live vars + cache) and runs
 * `@openheaders/core/variables/buildSuggestions` against a caller-
 * supplied {@link SuggestionContext}. The heavy subscription cost is
 * amortized via React state in the underlying hooks (`useEnvironments`
 * etc.) — each of those keeps a single host-store listener, so
 * mounting ten {@link TemplateInput} instances on one page fires one
 * effective listener per store, not ten.
 *
 * The live-registry construction mirrors `VariablesPanel` and
 * `variables-resolver.buildLiveRegistry` — enabled LVs only, cache
 * filtered to the active env, honoring manualOverride.until. Keep the
 * three in sync when extending.
 *
 * See the variable-autocomplete plan Phase B.
 */

import { isLiveVariableEffective } from '@openheaders/core/live';
import {
  buildSuggestions,
  type LiveSuggestionEntry,
  type SuggestionContext,
  type SuggestionRegistries,
  type VariableSuggestion,
} from '@openheaders/core/variables';
import { iterateAllCollections } from '@openheaders/ui/shared/variables';
import { useMemo } from 'react';
import { useEnvVarVault } from '../readers/useEnvVarVault';
import { useAllLiveCaches } from '../readers/useLiveCache';
import { useLiveVariables } from '../readers/useLiveVariables';
import { useLiveWorkflows } from '../readers/useLiveWorkflows';
import { useRequests } from '../readers/useRequests';
import { useRules } from '../readers/useRules';

export interface UseVariableSuggestionsApi {
  suggestions: VariableSuggestion[];
  isReady: boolean;
}

export function useVariableSuggestions(context: SuggestionContext): UseVariableSuggestionsApi {
  const {
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    vault,
    isReady: envsReady,
  } = useEnvVarVault();
  const { localCollections, templateCollections } = useRules();
  const { collections: requestCollections } = useRequests();
  const { variables: liveVariables, isReady: lvReady } = useLiveVariables();
  const { workflows: liveWorkflows, isReady: lwReady } = useLiveWorkflows();

  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches, isReady: cacheReady } = useAllLiveCaches(liveWorkflowUids);

  // LiveRegistry mirrors the SW's `buildLiveRegistry` + VariablesPanel's
  // snapshot: effective LVs (published + enabled) only, active-env cache
  // row wins over null-env, manual override (still within `until`)
  // short-circuits. Keep parallel to those two sites.
  const liveRegistry = useMemo<ReadonlyMap<string, LiveSuggestionEntry>>(() => {
    const nowMs = Date.now();
    const registry = new Map<string, LiveSuggestionEntry>();
    for (const lv of liveVariables) {
      if (!isLiveVariableEffective(lv)) continue;
      if (lv.manualOverride) {
        const activeOverride = lv.manualOverride.until === undefined || lv.manualOverride.until > nowMs;
        if (activeOverride) {
          registry.set(lv.name, {
            value: lv.manualOverride.value,
            stale: false,
            workflowUid: lv.workflowUid,
          });
          continue;
        }
      }
      const runs = liveCaches[lv.workflowUid] ?? [];
      const run =
        runs.find((r) => r.environmentId === activeEnvironmentId) ?? runs.find((r) => r.environmentId === null) ?? null;
      if (!run) continue;
      const value = run.stepCaptures[lv.stepId]?.[lv.captureName];
      if (typeof value !== 'string') continue;
      registry.set(lv.name, {
        value,
        stale: run.expiresAt !== null && run.expiresAt < nowMs,
        definitionallyStale: run.definitionallyStale === true,
        workflowUid: lv.workflowUid,
      });
    }
    return registry;
  }, [liveVariables, liveCaches, activeEnvironmentId]);

  const registries = useMemo<SuggestionRegistries>(
    () => ({
      vault: vault.secrets,
      environments: environments.map((e) => ({ uid: e.uid, name: e.name, variables: e.variables })),
      activeEnvironmentId,
      defaultEnvironmentId,
      collections: [
        ...iterateAllCollections({
          ruleCollections: localCollections,
          requestCollections,
          templateCollections,
        }),
      ].map((c) => ({ uid: c.uid, variables: c.variables ?? [] })),
      workspaceVariables: workspaceVariables.variables,
      liveRegistry,
    }),
    [
      vault,
      environments,
      activeEnvironmentId,
      defaultEnvironmentId,
      localCollections,
      requestCollections,
      templateCollections,
      workspaceVariables,
      liveRegistry,
    ],
  );

  // Context is caller-owned — we don't deep-equal it. If the caller
  // passes a fresh object every render, we rebuild the suggestions.
  // Cheap: the build walks small arrays. Callers that care can memoize
  // their context upstream.
  const suggestions = useMemo(() => buildSuggestions(registries, context), [registries, context]);

  return {
    suggestions,
    isReady: envsReady && lvReady && lwReady && cacheReady,
  };
}
