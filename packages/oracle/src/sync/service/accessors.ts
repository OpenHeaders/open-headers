/**
 * Sync service — direct oracle / cache / mutator-context accessors for
 * SW-internal consumers, in Active-scoped and explicit-workspace
 * variants.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import { type EntityCacheLike, type EntityRegistration, WORKSPACE_REGISTRY } from '../entity-registry';
import type { EntityOracle } from '../oracle';
import type { SwContextHandle } from '../sw-context';
import { currentActive, services } from './state';

/**
 * Direct oracle access for SW-internal consumers (rule-store's write
 * path emits mutations through this rather than the bridge layer —
 * they're already in-process). Returns null when no Active workspace
 * is set so alarm dispatch paths don't crash on cold-wake races.
 */
export function getOracleForCurrentWorkspace(): EntityOracle | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.oracle ?? null;
}

/**
 * Direct oracle access scoped to an explicit workspace. Returns null
 * when no service is materialized for the requested id. Used by SW
 * stores that route mutations through a tab's editing-scope workspace
 * rather than the runtime-Active one (MWPT-FULL session #8 + Session 14
 * — closes the same-class bug that lands renderer mutations on the
 * runtime-Active workspace when the gesture origin is a diverged tab).
 */
export function getOracleForWorkspace(workspaceId: string): EntityOracle | null {
  return services.get(workspaceId)?.oracle ?? null;
}

/**
 * Resolve a per-entity cache for the runtime-Active workspace. Returns
 * null when no Active workspace is set or the workspace's service
 * hasn't been materialized yet. SW-internal consumers in
 * `background/modules/` use this in place of the legacy
 * `getActiveXCache()` accessors — the helper enforces "Active
 * workspace's cache" by construction. Callers that need a specific
 * workspace's cache use `getOrCreateWorkspaceService(id)` and index
 * `caches` by registry position directly.
 *
 * The generic parameter is the cache type the registration owns; the
 * cast is sound because `caches[i]` was produced by
 * `registry[i].createCache` in {@link buildService}.
 */
export function getActiveCacheForRegistration<C extends EntityCacheLike>(reg: EntityRegistration): C | null {
  if (currentActive === null) return null;
  const svc = services.get(currentActive);
  if (!svc) return null;
  const idx = WORKSPACE_REGISTRY.indexOf(reg);
  if (idx === -1) return null;
  const cache = svc.caches[idx];
  return (cache as C | undefined) ?? null;
}

/**
 * Resolve a per-entity cache for an explicit workspace. Mirrors
 * {@link getActiveCacheForRegistration} but reads from the workspace's
 * service slot directly instead of routing through `currentActive` —
 * the load-bearing accessor for SW-internal consumers (live-refresh
 * scheduler, chain adapter, request executor) that operate on workflows
 * scoped to a non-Active workspace under MWPT-FULL session #19.
 *
 * Returns null when no service is materialized for the requested
 * workspace (which is also the right shape for "orphan alarm: cancel"
 * in the scheduler's reconcile path).
 */
export function getCacheForWorkspace<C extends EntityCacheLike>(
  reg: EntityRegistration,
  workspaceId: string,
): C | null {
  const svc = services.get(workspaceId);
  if (!svc) return null;
  const idx = WORKSPACE_REGISTRY.indexOf(reg);
  if (idx === -1) return null;
  const cache = svc.caches[idx];
  return (cache as C | undefined) ?? null;
}
/**
 * Mint a fresh `MutatorContext` from the Active workspace's HLC
 * sequencer. Used by SW-internal callers (rule-store, hydration) —
 * surfaces hosted in a renderer mint their own contexts with their
 * own nodeId.
 */
export function nextSwMutatorContext(opts?: Parameters<SwContextHandle['next']>[0]): MutatorContext | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.context.next(opts) ?? null;
}

/**
 * Workspace-scoped variant of {@link nextSwMutatorContext}. Returns null
 * when no service is materialized for the requested id. Mirrors
 * {@link getOracleForWorkspace} — both are needed together when a SW
 * store routes a mutation against an explicit workspace's oracle
 * (Session #8 files-store + Session 14 collection/folder/template
 * routing).
 */
export function nextSwMutatorContextForWorkspace(
  workspaceId: string,
  opts?: Parameters<SwContextHandle['next']>[0],
): MutatorContext | null {
  return services.get(workspaceId)?.context.next(opts) ?? null;
}
