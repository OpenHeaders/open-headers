/**
 * Trusted-roots store — the executors' read seam for the workspace
 * trust list.
 *
 * `getTrustedRootsForWorkspace(workspaceId)` is the `getVaultForWorkspace`
 * idiom: read the materialized cache for an explicit workspace, empty
 * when none is mounted. The executors hand the PEM strings to the
 * transport at send time; the transport never reaches in here.
 */

import { EMPTY_TRUSTED_ROOTS, type TrustedRoots } from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import { requireActiveWorkspaceId } from '@openheaders/oracle/sync';
import type { TrustedRootsCache } from '@openheaders/oracle/sync/caches/trusted-roots-cache';
import { TRUSTED_ROOTS_REGISTRATION } from '@openheaders/oracle/sync/entity-registry';
import { getActiveCacheForRegistration, getCacheForWorkspace } from '@openheaders/oracle/sync/service/accessors';

export function getTrustedRootsForWorkspace(workspaceId: string): TrustedRoots {
  const cache = getCacheForWorkspace<TrustedRootsCache>(TRUSTED_ROOTS_REGISTRATION, workspaceId);
  return cache ? cache.getTrustedRoots() : EMPTY_TRUSTED_ROOTS;
}

/** PEM strings of every root in the workspace — the shape the transports take. */
export function getTrustedRootPemsForWorkspace(workspaceId: string): string[] {
  return getTrustedRootsForWorkspace(workspaceId).roots.map((root) => root.certPem);
}

/**
 * The list as an executor seats it on a transport request: absent when
 * there is no workspace to read from or the list is empty, so the
 * transport's runtime-default trust path stays untouched. Takes the
 * executor's resolved workspace pin (`null` = none).
 */
export function getTrustedRootPemsForSend(workspaceId: string | null): string[] | undefined {
  if (workspaceId === null) return undefined;
  const roots = getTrustedRootPemsForWorkspace(workspaceId);
  return roots.length > 0 ? roots : undefined;
}

/**
 * Seed the active workspace's cache from the persisted record. The
 * cache owns the in-memory snapshot after this — readers go through
 * {@link getTrustedRootsForWorkspace}.
 */
export async function bridgeTrustedRootsSyncEngine(): Promise<void> {
  const cache = getActiveCacheForRegistration<TrustedRootsCache>(TRUSTED_ROOTS_REGISTRATION);
  if (!cache) return;
  const workspaceId = requireActiveWorkspaceId();
  const persisted = (await hostStorage.get(wsKeys(workspaceId).trustedRoots)) ?? EMPTY_TRUSTED_ROOTS;
  await cache.seedFromPersistedTrustedRoots(persisted);
  logger.debug('TrustedRootsStore', `Bridged ws=${workspaceId}: ${cache.getTrustedRoots().roots.length} roots`);
}
