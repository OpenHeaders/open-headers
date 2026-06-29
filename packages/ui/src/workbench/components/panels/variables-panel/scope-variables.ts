/**
 * Display-variable builders — the model layer behind both panel views.
 *
 *   - `buildAllScopeVariables` produces every scope's variables for the
 *     "All" view, whatever their referenced state.
 *   - `buildInContextVariables` walks a focused entity's templated
 *     strings, resolves each through the full resolveTemplate machinery
 *     (namespaces, default-env fallback, reserved-namespace detection),
 *     then dedupes variables by display name and errors by reference.
 *     The walker is entity-agnostic: rules, requests and templates are
 *     all plain objects whose templated fields `collectTemplateStrings`
 *     can harvest.
 */

import { isLiveVariableEffective } from '@openheaders/core/live';
import type {
  Environment,
  LiveVariable,
  Request,
  Rule,
  Template,
  Variable,
  Vault,
  WorkspaceVariables,
} from '@openheaders/core/types';
import type { ResolutionError, VariableResolver } from '@openheaders/core/variables';
import { type CollectionFamilies, findCollectionByUid } from '@openheaders/ui/shared/variables';
import { collectTemplateStrings } from '../../../variable-references';
import type { LiveRegistry } from './live-registry';
import type { AllScopeVariables, DisplayScope, DisplayVariable } from './types';

export interface AllScopeVariablesInput {
  vault: Vault;
  environments: Environment[];
  activeEnvironmentId: string | null;
  workspaceVariables: WorkspaceVariables;
  families: CollectionFamilies;
  activeCollectionId: string | null;
  liveVariables: LiveVariable[];
  liveRegistry: LiveRegistry;
}

export function buildAllScopeVariables(input: AllScopeVariablesInput): AllScopeVariables {
  const {
    vault,
    environments,
    activeEnvironmentId,
    workspaceVariables,
    families,
    activeCollectionId,
    liveVariables,
    liveRegistry,
  } = input;

  const vaultList: DisplayVariable[] = vault.secrets.map((s) => {
    // TOTP entries surface a live `TotpPreview` (rendered when `totp` is
    // present); the literal `value` field is empty because the code is
    // dynamic. "resolved" stays true so the row doesn't render as
    // unresolved — cooldown is enforced at the executor, not here.
    if (s.kind === 'totp') {
      return {
        name: s.name,
        value: '',
        scope: 'vault',
        isSensitive: true,
        resolved: true,
        totp: { seed: s.seed, algorithm: s.algorithm, digits: s.digits, period: s.period },
      };
    }
    return {
      name: s.name,
      value: s.value,
      scope: 'vault',
      isSensitive: true,
      resolved: s.value !== '',
    };
  });

  const envList: Variable[] = activeEnvironmentId
    ? (environments.find((e) => e.uid === activeEnvironmentId)?.variables ?? [])
    : [];
  const envDisplay: DisplayVariable[] = envList.map((v) => ({
    name: v.name,
    value: v.value,
    scope: 'environment',
    isSensitive: v.type === 'secret',
    resolved: v.value !== '',
  }));

  const collList: DisplayVariable[] = activeCollectionId
    ? (findCollectionByUid(activeCollectionId, families)?.variables ?? []).map((v) => ({
        name: v.name,
        value: v.value,
        scope: 'collection' as const,
        isSensitive: v.type === 'secret',
        resolved: v.value !== '',
      }))
    : [];

  const wsList: DisplayVariable[] = workspaceVariables.variables.map((v) => ({
    name: v.name,
    value: v.value,
    scope: 'workspace',
    isSensitive: v.type === 'secret',
    resolved: v.value !== '',
  }));

  const liveList: DisplayVariable[] = liveVariables
    .filter((lv) => isLiveVariableEffective(lv))
    .map((lv) => {
      const entry = liveRegistry.get(lv.name);
      return {
        name: lv.name,
        value: entry?.value ?? '',
        scope: 'live' as const,
        // Values can contain secrets (tokens) — mask by default.
        isSensitive: true,
        resolved: entry !== undefined,
        liveVariableUid: lv.uid,
        definitionallyStale: entry?.definitionallyStale === true,
      };
    });

  return { vault: vaultList, environment: envDisplay, collection: collList, workspace: wsList, live: liveList };
}

export interface InContextVariablesInput {
  contextEntity: Rule | Request | Template | null;
  activeCollectionId: string | null;
  resolver: VariableResolver;
  liveVariables: LiveVariable[];
}

export interface InContextVariablesResult {
  inContextVars: DisplayVariable[];
  inContextErrors: ResolutionError[];
}

export function buildInContextVariables(input: InContextVariablesInput): InContextVariablesResult {
  const { contextEntity, activeCollectionId, resolver, liveVariables } = input;
  if (!contextEntity) return { inContextVars: [], inContextErrors: [] };

  const templateStrings: string[] = [];
  collectTemplateStrings(contextEntity, templateStrings);

  const ctx = activeCollectionId ? { collectionId: activeCollectionId } : undefined;
  const seenVars = new Map<string, DisplayVariable>();
  const seenErrors = new Map<string, ResolutionError>();

  for (const str of templateStrings) {
    const { variables, errors } = resolver.resolveTemplate(str, ctx);
    for (const v of variables) {
      if (seenVars.has(v.name)) continue;
      if (v.resolved) {
        const scope = (v.scope ?? 'workspace') as DisplayScope;
        seenVars.set(v.name, {
          name: v.name,
          value: v.value ?? '',
          scope,
          isSensitive: v.isSensitive ?? false,
          resolved: true,
          ...(scope === 'live' ? { liveVariableUid: liveVariables.find((lv) => lv.name === v.name)?.uid } : {}),
        });
      } else {
        seenVars.set(v.name, {
          name: v.name,
          value: '',
          scope: 'workspace' as DisplayScope,
          isSensitive: false,
          resolved: false,
        });
      }
    }
    for (const e of errors) {
      if (!seenErrors.has(e.reference)) seenErrors.set(e.reference, e);
    }
  }

  return { inContextVars: [...seenVars.values()], inContextErrors: [...seenErrors.values()] };
}
