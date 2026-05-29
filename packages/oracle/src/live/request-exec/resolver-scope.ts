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

import { generateTotp } from '@openheaders/core/totp';
import type { Collection, Environment, Vault, VaultSecretTotp, WorkspaceVariables } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { type TotpRegistry, VariableResolver } from '@openheaders/core/variables';
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

/**
 * Build the resolver and capture the per-execution scope used for
 * {{ref}} resolution. Returns the vault snapshot alongside so the caller
 * can index TOTP entries by name without re-reading a store that may
 * have rotated between calls.
 */
export async function buildResolver(
  workspaceId: string | undefined,
  stepCaptures?: ReadonlyMap<string, ReadonlyMap<string, string>>,
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
