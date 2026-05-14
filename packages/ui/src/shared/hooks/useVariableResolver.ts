/**
 * useVariableResolver — renderer-side `VariableResolver` mirroring the
 * SW's `buildLiveRegistry` + VariablesPanel's scope wiring. Shared so
 * both the inspector panel and inline mirror highlighting in
 * {@link TemplateInput} resolve identically to what ships into DNR.
 *
 * Keep the live-registry construction in lock-step with:
 *   - `background/modules/variables-resolver.buildLiveRegistry`
 *   - `VariablesPanel`'s liveRegistry memo
 *   - `useVariableSuggestions`'s liveRegistry memo
 *
 * The hook is a pure derivation of the existing store subscriptions —
 * no new RPCs. Components that only need to resolve templates (not
 * offer suggestions) can skip `useVariableSuggestions` and use this
 * directly.
 */

import { useEnvVarVault } from './useEnvVarVault';
import { useAllLiveCaches } from './useLiveCache';
import { useLiveVariables } from './useLiveVariables';
import { useLiveWorkflows } from './useLiveWorkflows';
import { useRequests } from './useRequests';
import { useRules } from './useRules';
import { isLiveVariableEffective } from '@openheaders/core/live';
import { type ResolvedLiveValue, VariableResolver } from '@openheaders/core/variables';
import { useMemo } from 'react';
import { feedCollectionVariablesToResolver } from '@openheaders/ui/shared/variables';

export function useVariableResolver(): VariableResolver {
  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvVarVault();
  const { localCollections, templateCollections } = useRules();
  const { collections: requestCollections } = useRequests();
  const { variables: liveVariables } = useLiveVariables();
  const { workflows: liveWorkflows } = useLiveWorkflows();

  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);

  const liveRegistry = useMemo(() => {
    const nowMs = Date.now();
    const registry = new Map<string, ResolvedLiveValue>();
    for (const lv of liveVariables) {
      if (!isLiveVariableEffective(lv)) continue;
      if (lv.manualOverride) {
        const activeOverride = lv.manualOverride.until === undefined || lv.manualOverride.until > nowMs;
        if (activeOverride) {
          registry.set(lv.name, {
            value: lv.manualOverride.value,
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
        workflowUid: lv.workflowUid,
        stale: run.expiresAt !== null && run.expiresAt < nowMs,
      });
    }
    return registry;
  }, [liveVariables, liveCaches, activeEnvironmentId]);

  return useMemo(() => {
    const r = new VariableResolver();
    r.setVault(vault);
    r.setEnvironments(environments);
    r.setActiveEnvironmentId(activeEnvironmentId);
    r.setDefaultEnvironmentId(defaultEnvironmentId);
    r.setWorkspaceVariables(workspaceVariables);
    feedCollectionVariablesToResolver(r, {
      ruleCollections: localCollections,
      requestCollections,
      templateCollections,
    });
    r.setLiveRegistry(liveRegistry);
    // Renderer surfaces (template-input syntax highlighting, Inspector)
    // only need to know whether a `{{vault.X}}` reference is resolvable;
    // the actual TOTP code is computed at request execution time in the
    // SW. Opt into deferred resolution so kind:'totp' entries that exist
    // in the vault report as resolved without inventing a fake code
    // here. The DNR-compile path keeps the default `'reject'` mode and
    // remains architecturally protected from baking 30s codes into
    // static rules.
    r.setDeferredVaultMode('defer');
    return r;
  }, [
    vault,
    environments,
    activeEnvironmentId,
    defaultEnvironmentId,
    workspaceVariables,
    localCollections,
    requestCollections,
    templateCollections,
    liveRegistry,
  ]);
}
