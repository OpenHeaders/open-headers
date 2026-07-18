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
 *
 * Split into an inputs hook + a pure builder so EXECUTING consumers
 * can construct a differently-configured resolver from the SAME scope
 * snapshot: display surfaces ride {@link useVariableResolver} (vault
 * mode `'defer'` — reference-validity checks without real codes),
 * while the WebSocket page-session publisher rides
 * {@link useVariableResolverInputs} + {@link buildRendererResolver}
 * with a computed TOTP registry and the default `'reject'` mode, so an
 * in-page send never ships a placeholder where a code belongs.
 */

import { isLiveVariableEffective, isWorkflowEffective } from '@openheaders/core/live';
import type { Collection, Environment, FileRef, Vault, WorkspaceVariables } from '@openheaders/core/types';
import {
  type DeferredVaultMode,
  type LiveRegistry,
  type ResolvedLiveValue,
  type TotpRegistry,
  VariableResolver,
} from '@openheaders/core/variables';
import { feedCollectionVariablesToResolver } from '@openheaders/ui/shared/variables';
import { useMemo } from 'react';
import { useEnvVarVault } from '../readers/useEnvVarVault';
import { useFiles } from '../readers/useFiles';
import { useAllLiveCaches } from '../readers/useLiveCache';
import { useLiveVariables } from '../readers/useLiveVariables';
import { useLiveWorkflows } from '../readers/useLiveWorkflows';
import { useRequests } from '../readers/useRequests';
import { useRules } from '../readers/useRules';

/** One renderer-side scope snapshot — everything a resolver is fed. */
export interface RendererResolverInputs {
  vault: Vault;
  environments: Environment[];
  activeEnvironmentId: string | null;
  defaultEnvironmentId: string | null;
  workspaceVariables: WorkspaceVariables;
  collections: {
    ruleCollections: Collection[];
    requestCollections: Collection[];
    templateCollections: Collection[];
  };
  files: FileRef[];
  liveRegistry: LiveRegistry;
}

/** Gather the renderer scope snapshot from the store subscriptions —
 *  the input side of {@link useVariableResolver}, exposed so executing
 *  consumers can build their own resolver from the same snapshot. */
export function useVariableResolverInputs(): RendererResolverInputs {
  const { environments, activeEnvironmentId, defaultEnvironmentId, workspaceVariables, vault } = useEnvVarVault();
  const { localCollections, templateCollections } = useRules();
  const { collections: requestCollections } = useRequests();
  const { files } = useFiles();
  const { variables: liveVariables } = useLiveVariables();
  const { workflows: liveWorkflows } = useLiveWorkflows();

  const liveWorkflowUids = useMemo(() => liveWorkflows.map((w) => w.uid), [liveWorkflows]);
  const { byWorkflowUid: liveCaches } = useAllLiveCaches(liveWorkflowUids);

  const liveRegistry = useMemo(() => {
    const nowMs = Date.now();
    // A binding only resolves when BOTH the LV and its backing workflow
    // are effective (published + enabled + complete) — mirrors the SW's
    // `buildLiveRegistryFor`. Without the workflow gate the Inspector /
    // editor would show a draft workflow's vars as live while the wire
    // (which checks the workflow) refuses to resolve them.
    const effectiveWorkflowUids = new Set(liveWorkflows.filter(isWorkflowEffective).map((w) => w.uid));
    const registry = new Map<string, ResolvedLiveValue>();
    for (const lv of liveVariables) {
      if (!isLiveVariableEffective(lv)) continue;
      // Manual override is user-set and independent of execution — it
      // resolves regardless of workflow state, so handle it before the
      // workflow gate (mirrors `buildLiveRegistryFor`'s order).
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
      // Cached-capture path requires the backing workflow to be effective.
      if (!effectiveWorkflowUids.has(lv.workflowUid)) continue;
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
        definitionallyStale: run.definitionallyStale === true,
      });
    }
    return registry;
  }, [liveVariables, liveWorkflows, liveCaches, activeEnvironmentId]);

  return useMemo(
    () => ({
      vault,
      environments,
      activeEnvironmentId,
      defaultEnvironmentId,
      workspaceVariables,
      collections: {
        ruleCollections: localCollections,
        requestCollections,
        templateCollections,
      },
      files,
      liveRegistry,
    }),
    [
      vault,
      environments,
      activeEnvironmentId,
      defaultEnvironmentId,
      workspaceVariables,
      localCollections,
      requestCollections,
      templateCollections,
      files,
      liveRegistry,
    ],
  );
}

/** Build a fed resolver from one scope snapshot — pure, so callers
 *  pick the vault posture their use demands. Display surfaces pass
 *  `deferredVaultMode: 'defer'`; executing consumers keep the default
 *  `'reject'` and install a computed {@link TotpRegistry} instead. */
export function buildRendererResolver(
  inputs: RendererResolverInputs,
  options?: { deferredVaultMode?: DeferredVaultMode; totpRegistry?: TotpRegistry },
): VariableResolver {
  const r = new VariableResolver();
  r.setVault(inputs.vault);
  r.setEnvironments(inputs.environments);
  r.setActiveEnvironmentId(inputs.activeEnvironmentId);
  r.setDefaultEnvironmentId(inputs.defaultEnvironmentId);
  r.setWorkspaceVariables(inputs.workspaceVariables);
  feedCollectionVariablesToResolver(r, inputs.collections);
  // File registry — powers `{{file.X}}` (resolves to the content hash,
  // not bytes). Without this the editor falsely flags references to
  // files that exist, since the SW executor feeds the same registry
  // and resolves them on the wire. Missing files still surface as
  // `unset-in-scope`, matching the executor's gate.
  r.setFileRegistry(inputs.files);
  r.setLiveRegistry(inputs.liveRegistry);
  if (options?.totpRegistry !== undefined) r.setTotpRegistry(options.totpRegistry);
  if (options?.deferredVaultMode !== undefined) r.setDeferredVaultMode(options.deferredVaultMode);
  return r;
}

export function useVariableResolver(): VariableResolver {
  const inputs = useVariableResolverInputs();
  // Renderer surfaces (template-input syntax highlighting, Inspector)
  // only need to know whether a `{{vault.X}}` reference is resolvable;
  // the actual TOTP code is computed at request execution time in the
  // SW. Opt into deferred resolution so kind:'totp' entries that exist
  // in the vault report as resolved without inventing a fake code
  // here. The DNR-compile path keeps the default `'reject'` mode and
  // remains architecturally protected from baking 30s codes into
  // static rules.
  return useMemo(() => buildRendererResolver(inputs, { deferredVaultMode: 'defer' }), [inputs]);
}
