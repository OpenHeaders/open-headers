/**
 * Display-variable builders — the model layer behind both panel views.
 *
 *   - `buildAllScopeVariables` produces every scope's variables for the
 *     "All" view, whatever their referenced state.
 *   - `buildInContextVariables` walks a focused entity's templated
 *     strings, resolves each through the full resolveTemplate machinery
 *     (namespaces, default-env fallback, reserved-namespace detection),
 *     then dedupes variables by display name and errors by reference.
 *     The walk is the kind's own: a request of any wire kind through
 *     its core scan (the executor's field list, so the panel names
 *     exactly the references the send resolves — a script's text or a
 *     disabled row never shows), a rule or a template through the deep
 *     walk of every templated field.
 */

import {
  collectGraphqlRequestTemplateStrings,
  collectGrpcRequestTemplateStrings,
  collectMqttRequestTemplateStrings,
  collectRequestTemplateStrings,
  collectWebSocketRequestTemplateStrings,
  isLiveVariableEffective,
} from '@openheaders/core/live';
import { formatSecretLocator } from '@openheaders/core/secret-providers';
import type { Environment, LiveVariable, Variable, Vault, WorkspaceVariables } from '@openheaders/core/types';
import type { ResolutionError, VariableResolver } from '@openheaders/core/variables';
import { type CollectionFamilies, findCollectionByUid } from '@openheaders/ui/shared/variables';
import { collectTemplateStrings } from '../../../variable-references';
import type { LiveRegistry } from './live-registry';
import type { AllScopeVariables, DisplayScope, DisplayVariable, ScopeEntity } from './types';

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
    // Client-certificate entries list so users see the entry exists,
    // but carry no template value — they're consumed by the request
    // "Client certificate" setting, not by `{{vault.X}}`.
    if (s.kind === 'client-certificate') {
      return {
        name: s.name,
        value: '',
        scope: 'vault',
        isSensitive: true,
        resolved: true,
      };
    }
    // Secret-manager entries show their REFERENCE (shareable by
    // construction) — never a resolved value, which only exists
    // transiently at consume time.
    if (s.kind === 'secret-manager') {
      return {
        name: s.name,
        value: formatSecretLocator(s.locator),
        scope: 'vault',
        isSensitive: false,
        resolved: true,
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
  contextEntity: ScopeEntity | null;
  activeCollectionId: string | null;
  resolver: VariableResolver;
  liveVariables: LiveVariable[];
  /** The vault — a deferred TOTP or secret-manager reference reads as
   *  the All view's row (the live preview, the reference), not a blank. */
  vault: Vault;
}

const NO_VAULT_NAME_PREFIX = 'vault.';

function deferredVaultRow(vault: Vault, name: string): Partial<DisplayVariable> | null {
  const bare = name.startsWith(NO_VAULT_NAME_PREFIX) ? name.slice(NO_VAULT_NAME_PREFIX.length) : name;
  const secret = vault.secrets.find((s) => s.name === bare);
  if (secret === undefined) return null;
  if (secret.kind === 'totp') {
    return { totp: { seed: secret.seed, algorithm: secret.algorithm, digits: secret.digits, period: secret.period } };
  }
  if (secret.kind === 'secret-manager') return { value: formatSecretLocator(secret.locator), isSensitive: false };
  return null;
}

export interface InContextVariablesResult {
  inContextVars: DisplayVariable[];
  inContextErrors: ResolutionError[];
}

/** Every templated field of the entity, depth first. */
function deepTemplateStrings(entity: unknown): string[] {
  const out: string[] = [];
  collectTemplateStrings(entity, out);
  return out;
}

/**
 * The templates the focused entity's executor resolves. Trust boundary:
 * the panel reads persisted rows raw (git-synced files, rows written by
 * another version), and a kind's scan reads the entity's field list by
 * shape — a malformed row falls back to the deep walk instead of taking
 * the panel down with it.
 */
function scopeEntityTemplateStrings(scope: ScopeEntity): string[] {
  try {
    switch (scope.kind) {
      case 'rule':
      case 'template':
        return deepTemplateStrings(scope.entity);
      case 'request':
        return collectRequestTemplateStrings(scope.entity);
      case 'grpc-request':
        return collectGrpcRequestTemplateStrings(scope.entity);
      case 'websocket-request':
        return collectWebSocketRequestTemplateStrings(scope.entity);
      case 'mqtt-request':
        return collectMqttRequestTemplateStrings(scope.entity);
      case 'graphql-request':
        return collectGraphqlRequestTemplateStrings(scope.entity);
    }
  } catch {
    return deepTemplateStrings(scope.entity);
  }
}

export function buildInContextVariables(input: InContextVariablesInput): InContextVariablesResult {
  const { contextEntity, activeCollectionId, resolver, liveVariables, vault } = input;
  if (!contextEntity) return { inContextVars: [], inContextErrors: [] };

  const templateStrings = scopeEntityTemplateStrings(contextEntity);

  const ctx = activeCollectionId ? { collectionId: activeCollectionId } : undefined;
  const seenVars = new Map<string, DisplayVariable>();
  const seenErrors = new Map<string, ResolutionError>();

  for (const str of templateStrings) {
    const { variables, errors } = resolver.resolveTemplate(str, ctx);
    for (const v of variables) {
      if (seenVars.has(v.name)) continue;
      if (v.resolved) {
        const scope = (v.scope ?? 'workspace') as DisplayScope;
        // A vault row resolved without a value is a deferred one — the
        // code or the secret lands at compile or send time.
        const deferred = scope === 'vault' && (v.value ?? '') === '' ? deferredVaultRow(vault, v.name) : null;
        seenVars.set(v.name, {
          name: v.name,
          value: v.value ?? '',
          scope,
          isSensitive: v.isSensitive ?? false,
          resolved: true,
          ...(scope === 'live' ? { liveVariableUid: liveVariables.find((lv) => lv.name === v.name)?.uid } : {}),
          ...(deferred ?? {}),
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
