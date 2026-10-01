/**
 * Resolver scope — builds the {@link VariableResolver} a single request
 * execution resolves `{{ref}}` templates against, plus the snapshot of
 * the per-execution scope (vault + workspace pin) the caller needs to
 * track TOTP usage and pick the owning collection.
 *
 * Host-neutral: every scope value is read from the `@openheaders/oracle`
 * entity stores (hydrated identically on the extension SW and the
 * desktop main process), so the same resolver is produced on whichever
 * host runs the chain.
 *
 * When `workspaceId` is supplied, every store read routes through the
 * per-workspace cache for that workspace — required when the dispatch is
 * keyed on a non-runtime-Active workspace (a per-tab workspace's
 * live-refresh chain firing while a different workspace is Active).
 * Otherwise the resolver pulls from the Active-bound module mirrors, the
 * Send-from-workbench path.
 */

import { getSecretProvider, type SecretResolveFailureReason } from '@openheaders/core/secret-providers';
import { generateTotp } from '@openheaders/core/totp';
import type {
  Collection,
  Environment,
  SecretManagerConnection,
  Vault,
  VaultSecretManager,
  VaultSecretTotp,
  WorkspaceVariables,
} from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import {
  type SecretManagerFailures,
  type SecretManagerRegistry,
  type TotpRegistry,
  VariableResolver,
} from '@openheaders/core/variables';
import {
  getActiveEnvironmentId,
  getDefaultEnvironmentId,
  getDefaultEnvironmentIdForWorkspace,
  getEnvironments,
  getEnvironmentsForWorkspace,
  getVault,
  getVaultForWorkspace,
  getWorkspaceVariables,
  getWorkspaceVariablesForWorkspace,
} from '../../entity/environment-store';
import { listFiles } from '../../entity/files-store';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '../../entity/request-store';
import {
  getCollections as getRuleCollections,
  getCollectionsForWorkspace as getRuleCollectionsForWorkspace,
} from '../../entity/rule-store';
import { getSecretManagerConnection } from '../../entity/secret-manager-connections-store';
import { getTemplateCollections, getTemplateCollectionsForWorkspace } from '../../entity/template-store';
import { getLiveRegistrySnapshot, getLiveRegistrySnapshotForWorkspace } from '../../rule-engine/variables-resolver';

/** Per-execution scope captured alongside the resolver. */
export interface ResolverContext {
  workspaceId: string | null;
  environmentId: string | null;
  vault: Vault;
}

interface ExecutionScope {
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
}

function readActiveScope(): ExecutionScope {
  return {
    vault: getVault(),
    environments: getEnvironments(),
    activeEnvironmentId: getActiveEnvironmentId(),
    defaultEnvironmentId: getDefaultEnvironmentId(),
    workspaceVariables: getWorkspaceVariables(),
    collections: {
      ruleCollections: getRuleCollections(),
      requestCollections: getRequestCollections(),
      templateCollections: getTemplateCollections(),
    },
  };
}

async function readPerWorkspaceScope(workspaceId: string): Promise<ExecutionScope> {
  // The default-env pointer is the only scope value not tracked by an
  // entity cache (a singleton scalar); read it via storage. Active-env
  // pointer is irrelevant for chain execution — the chain is dispatched
  // against an explicit env, so we leave activeEnvironmentId null and
  // rely on the caller's environmentId override. Other scopes route
  // through their workspace caches.
  const defaultEnvironmentId = await getDefaultEnvironmentIdForWorkspace(workspaceId);
  return {
    vault: getVaultForWorkspace(workspaceId),
    environments: getEnvironmentsForWorkspace(workspaceId),
    activeEnvironmentId: null,
    defaultEnvironmentId,
    workspaceVariables: getWorkspaceVariablesForWorkspace(workspaceId),
    collections: {
      ruleCollections: getRuleCollectionsForWorkspace(workspaceId),
      requestCollections: getRequestCollectionsForWorkspace(workspaceId),
      templateCollections: getTemplateCollectionsForWorkspace(workspaceId),
    },
  };
}

/** The empty referenced set — a resolver that resolves no secret-manager entry (the compile-safe default). */
export const NO_SECRET_NAMES: ReadonlySet<string> = new Set();

/**
 * Build the resolver and capture the per-execution scope used for
 * {{ref}} resolution. Returns the vault snapshot alongside so the caller
 * can index TOTP entries by name without re-reading a store that may
 * have rotated between calls.
 *
 * `secretNames` is the set of vault entry names the operation's
 * templates reference (`collectTemplateVariableNames` over the
 * operation's strings): only those `kind: 'secret-manager'` entries are
 * resolved through their providers, so an unreferenced entry never
 * triggers a provider's prompt. Absent = none — the copy-as-command and
 * compile-adjacent paths stay prompt-free and value-free by default.
 */
export async function buildResolver(
  workspaceId: string | undefined,
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>,
  secretNames: ReadonlySet<string> = NO_SECRET_NAMES,
): Promise<{ resolver: VariableResolver; context: ResolverContext }> {
  const resolver = new VariableResolver();
  const scope = workspaceId ? await readPerWorkspaceScope(workspaceId) : readActiveScope();
  resolver.setVault(scope.vault);
  resolver.setEnvironments(scope.environments);
  resolver.setActiveEnvironmentId(scope.activeEnvironmentId);
  resolver.setDefaultEnvironmentId(scope.defaultEnvironmentId);
  resolver.setWorkspaceVariables(scope.workspaceVariables);
  // TOTP scope — precompute the current code for every kind:'totp' vault
  // entry so the resolver's `vault` arm returns them synchronously.
  resolver.setTotpRegistry(await buildTotpRegistry(scope.vault));
  // Secret-manager scope — batch-resolve the REFERENCED kind:'secret-
  // manager' entries through their connections and the host's provider
  // registry (empty on hosts without providers — every entry then
  // carries a typed `unavailable` failure).
  const secretManager = await buildSecretManagerRegistry(scope.vault, secretNames);
  resolver.setSecretManagerRegistry(secretManager.registry, secretManager.failures);
  // Live scope — for an Active-workspace dispatch read the snapshot that
  // backs the DNR compile pipeline; for a per-workspace dispatch read the
  // workspace's own mirror keyed on the explicit envId.
  resolver.setLiveRegistry(
    workspaceId
      ? getLiveRegistrySnapshotForWorkspace(workspaceId, scope.activeEnvironmentId)
      : getLiveRegistrySnapshot(),
  );
  if (stepCaptures) resolver.setStepCaptures(stepCaptures);
  // Feed variables from EVERY collection family — rule, request, AND
  // template. Uids are minted from one pool and never collide, so the
  // resolver's single uid-keyed map carries them all.
  for (const family of [
    scope.collections.ruleCollections,
    scope.collections.requestCollections,
    scope.collections.templateCollections,
  ]) {
    for (const c of family) resolver.setCollectionVariables(c.uid, c.variables ?? []);
  }
  // File registry — powers `{{file.X}}`. Loading the workspace file list
  // once per request is cheap (metadata only, no blob bytes).
  try {
    const files = await listFiles(workspaceId);
    resolver.setFileRegistry(files);
  } catch {
    // If storage is briefly unavailable we proceed without a registry;
    // `{{file.X}}` surfaces `unset-in-scope` rather than breaking outright.
  }
  return {
    resolver,
    context: { workspaceId: workspaceId ?? null, environmentId: null, vault: scope.vault },
  };
}

/**
 * Build the precomputed TOTP code map for every kind:'totp' vault entry.
 * Awaited concurrently. Entries whose seed fails to decode are skipped;
 * the resolver surfaces them as `unset-in-scope` and the request gate
 * rejects the send with a structured error.
 */
export async function buildTotpRegistry(vault: Vault): Promise<TotpRegistry> {
  const totpEntries = vault.secrets.filter((s): s is VaultSecretTotp => s.kind === 'totp');
  if (totpEntries.length === 0) return new Map();
  const codes = await Promise.all(
    totpEntries.map(async (e) => {
      try {
        const code = await generateTotp({ seed: e.seed, algorithm: e.algorithm, digits: e.digits, period: e.period });
        return [e.name, code] as const;
      } catch (err) {
        logger.info('RequestExec', `TOTP code generation failed for '${e.name}': ${(err as Error).message}`);
        return null;
      }
    }),
  );
  const out = new Map<string, string>();
  for (const entry of codes) {
    if (entry) out.set(entry[0], entry[1]);
  }
  return out;
}

/** One execution's secret-manager resolution snapshot — values for the
 *  resolver's registry, typed failures for its diagnostics. */
export interface SecretManagerSnapshot {
  registry: SecretManagerRegistry;
  failures: SecretManagerFailures;
}

/**
 * Batch-resolve the referenced `kind: 'secret-manager'` vault entries
 * through their connections and the host's provider registry — the
 * per-execution counterpart of {@link buildTotpRegistry}. Values live
 * only in the returned map for the duration of the execution (L1:
 * never persisted, re-resolved per send). Entries not in
 * `referencedNames` are left alone — never resolved, so they can never
 * prompt (the plan's binding rule). Every failure is typed, keyed by
 * entry name:
 *   - the entry names no connection, or one this device no longer
 *     holds, or no provider for its kind is installed here →
 *     `unavailable`
 *   - the provider's own resolve failure passes through verbatim
 *     (`authorization-required` / `not-found` / `unavailable`).
 *
 * The registry never probes. A probe reports the connection's LAST
 * attempt — the standing state the chip reads — while a send is a new
 * attempt: a connection the user denied at Test prompts again on Send,
 * and the provider's resolve answers every structural gap (the SDK
 * unloadable, no credential) typed on its own. Entries are grouped per
 * connection and resolve concurrently behind the provider's one client
 * per connection. `lookupConnection` is the store's read by default;
 * tests inject their own.
 */
export async function buildSecretManagerRegistry(
  vault: Vault,
  referencedNames: ReadonlySet<string>,
  lookupConnection: (uid: string) => SecretManagerConnection | undefined = getSecretManagerConnection,
): Promise<SecretManagerSnapshot> {
  const registry = new Map<string, string>();
  const failures = new Map<string, SecretResolveFailureReason>();
  const entries = vault.secrets.filter(
    (s): s is VaultSecretManager => s.kind === 'secret-manager' && referencedNames.has(s.name),
  );
  if (entries.length === 0) return { registry, failures };
  const byConnection = new Map<string, VaultSecretManager[]>();
  for (const entry of entries) {
    const key = entry.locator.connectionId;
    const group = byConnection.get(key);
    if (group) group.push(entry);
    else byConnection.set(key, [entry]);
  }
  const failGroup = (group: VaultSecretManager[], reason: SecretResolveFailureReason): void => {
    for (const entry of group) failures.set(entry.name, reason);
  };
  await Promise.all(
    [...byConnection].map(async ([connectionId, group]) => {
      const connection = connectionId === '' ? undefined : lookupConnection(connectionId);
      if (!connection) {
        failGroup(group, 'unavailable');
        return;
      }
      const provider = getSecretProvider(connection.config.provider);
      if (!provider) {
        failGroup(group, 'unavailable');
        return;
      }
      await Promise.all(
        group.map(async (entry) => {
          try {
            const result = await provider.resolve(connection, entry.locator);
            if (result.ok) {
              registry.set(entry.name, result.value);
            } else {
              failures.set(entry.name, result.reason);
            }
          } catch (err) {
            // Providers are non-throwing by contract; a throw is a bug in
            // the implementation — degrade to the honest typed failure.
            logger.info('RequestExec', `Secret resolve failed for '${entry.name}': ${(err as Error).message}`);
            failures.set(entry.name, 'unavailable');
          }
        }),
      );
    }),
  );
  return { registry, failures };
}
