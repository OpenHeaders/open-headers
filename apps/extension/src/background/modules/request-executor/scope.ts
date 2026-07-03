/**
 * Resolver construction — builds the `VariableResolver` with every
 * scope fed (vault / env / workspace vars / TOTP registry / live
 * registry / step captures / collection vars / file registry), reading
 * either the Active-workspace mirrors or the per-workspace caches.
 */

import { generateTotp } from '@openheaders/core/totp';
import type {
  Collection,
  Environment,
  Request,
  Vault,
  VaultSecretTotp,
  WorkspaceVariables,
} from '@openheaders/core/types';
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
} from '@openheaders/oracle/entity/environment-store';
import { listFiles } from '@openheaders/oracle/entity/files-store';
import { getRequestCollections, getRequestCollectionsForWorkspace } from '@openheaders/oracle/entity/request-store';
import {
  getCollections as getRuleCollections,
  getCollectionsForWorkspace as getRuleCollectionsForWorkspace,
} from '@openheaders/oracle/entity/rule-store';
import { getTemplateCollections, getTemplateCollectionsForWorkspace } from '@openheaders/oracle/entity/template-store';
import {
  getLiveRegistrySnapshot,
  getLiveRegistrySnapshotForWorkspace,
} from '@openheaders/oracle/rule-engine/variables-resolver';
import { feedCollectionVariablesToResolver } from '@openheaders/ui/shared/variables';
import { logger } from '@utils/logger';

export interface ResolverContext {
  workspaceId: string | null;
  environmentId: string | null;
  vault: Vault;
}

/**
 * Build the resolver and capture the per-execution scope used for
 * {{ref}} resolution. Returns the vault snapshot alongside so the
 * caller can index TOTP entries by name without re-reading a store
 * that may have rotated between calls.
 *
 * When `workspaceId` is supplied, every store read routes through the
 * per-workspace cache for that workspace — required when the dispatch
 * is keyed on a non-runtime-Active workspace (live-refresh chain
 * executor for a per-tab MWPT workspace, MWPT-FULL session #19).
 * Otherwise the resolver pulls from the Active-bound module mirrors,
 * the Send-from-workbench path the user-initiated executor has always
 * used.
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
  // TOTP scope — precompute the current code for every kind:'totp'
  // vault entry so the resolver's `vault` arm can return them
  // synchronously. Codes have ~30s lifetime; we compute fresh on every
  // request execution so the user never sees a stale code. The DNR
  // compile pipeline does NOT precompute (no TotpRegistry installed
  // there) — TOTP-kind entries surface as unresolved at compile time
  // and the rule is dropped, which is the architectural gate keeping
  // 30s-codes out of static rule values.
  resolver.setTotpRegistry(await buildTotpRegistry(scope.vault));
  // Live scope — for an Active-workspace dispatch we read the snapshot
  // that backs the DNR compile pipeline (same mirror the rule engine
  // uses). For a per-workspace dispatch we read the workspace's own
  // mirror keyed on the explicit envId (Active-env pointer is irrelevant
  // for chain execution, which is keyed on (workspaceId, envId)).
  resolver.setLiveRegistry(
    workspaceId
      ? getLiveRegistrySnapshotForWorkspace(workspaceId, scope.activeEnvironmentId)
      : getLiveRegistrySnapshot(),
  );
  if (stepCaptures) {
    // Step-capture context — only present during Live Workflow chain
    // runs. Installed here so `{{step.<id>.<name>}}` references in a
    // step's templates see prior steps' extracted values.
    resolver.setStepCaptures(stepCaptures);
  }
  // Feed variables from EVERY collection family — rule, request, AND
  // template. Uids are minted from one pool and never collide, so the
  // resolver's single Map keyed by uid carries them all. The shared
  // helper centralizes this so renderer surfaces and the SW agree on
  // the merged scope.
  feedCollectionVariablesToResolver(resolver, scope.collections);
  // File registry — powers `{{file.X}}` (ARCHITECTURE §6). Loading
  // the full workspace file list once per request is cheap (metadata
  // only, no blob bytes), and matches how other scopes are fed.
  try {
    const files = await listFiles(workspaceId);
    resolver.setFileRegistry(files);
  } catch {
    // If IDB is briefly unavailable (SW restart race) we proceed
    // without a registry; `{{file.X}}` surfaces `unset-in-scope` on
    // the error channel rather than breaking the request entirely.
  }
  return {
    resolver,
    context: {
      workspaceId: workspaceId ?? null,
      environmentId: null,
      vault: scope.vault,
    },
  };
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
  // entity cache (it's a singleton scalar persisted as `oh.ws.<id>
  // .defaultEnvironmentId`); read it via storage. Active-env pointer is
  // irrelevant for chain execution — the chain is dispatched against an
  // explicit env, so we leave activeEnvironmentId null and rely on the
  // `ResolutionContext.environmentId` override the executor threads
  // through. Other scopes route through their workspace caches.
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
 * Find the collection a request belongs to. Requests live under
 * `requests/<coll-name-uid>/...`, so we look in the REQUEST collection
 * tree — not the rule tree (paths under `rules/` never prefix a
 * request path). Returns `undefined` for orphaned requests (defensive —
 * every persisted request should have an owning collection).
 *
 * `workspaceId` routes the lookup through the per-workspace request-
 * collection cache when supplied — required for cross-workspace chain
 * dispatches where the runtime-Active workspace's collections aren't
 * the right namespace.
 */
export function collectionIdForRequest(request: Request, workspaceId: string | null): string | undefined {
  const collections = workspaceId ? getRequestCollectionsForWorkspace(workspaceId) : getRequestCollections();
  const hit = collections.find((c) => request.path.startsWith(`${c.path}/`));
  return hit?.uid;
}

/**
 * Build the precomputed TOTP code map for every kind:'totp' vault entry.
 * Awaited concurrently so a vault with N TOTP entries pays one
 * `Promise.all` round-trip rather than N serial waits. Entries whose
 * seed fails to decode (malformed base32) are skipped; the resolver
 * surfaces them as `unset-in-scope` and the request gate rejects the
 * send with a structured error.
 */
async function buildTotpRegistry(vault: Vault): Promise<TotpRegistry> {
  const totpEntries = vault.secrets.filter((s): s is VaultSecretTotp => s.kind === 'totp');
  if (totpEntries.length === 0) return new Map();
  const codes = await Promise.all(
    totpEntries.map(async (e) => {
      try {
        const code = await generateTotp({
          seed: e.seed,
          algorithm: e.algorithm,
          digits: e.digits,
          period: e.period,
        });
        return [e.name, code] as const;
      } catch (err) {
        logger.info('RequestExecutor', `TOTP code generation failed for '${e.name}': ${(err as Error).message}`);
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
