/**
 * Host-local workspace eviction — the Discard leg of removing a
 * backend (the multi-backend plan §4).
 *
 * A consumed workspace's Discard must NOT be a synced delete: the
 * remove mutation's tombstone carries a fresh local HLC that outranks
 * the backend's older workspace state forever, and the retained log
 * rows keep folding the backend's HLCs into the re-join STATE_VECTOR
 * — catch-up then sends nothing and "re-joining syncs them down
 * again" can never hold. Eviction is state surgery instead — no
 * mutation is minted anywhere:
 *
 *   1. Flip the active pointer off the evicted workspace (a real,
 *      home-org-scoped `setActive` mutation — local state, survives
 *      the org purge).
 *   2. Purge the per-workspace data (same purge a synced delete runs).
 *   3. Drop the evicted org's rows from the workspace's own log
 *      stripe AND the `__global__` workspace-list stripe, then force-
 *      dispose the per-workspace service — the next state vector must
 *      not claim the backend's HLCs, and a stale in-memory store must
 *      not resurrect dedup state on a same-session re-join.
 *   4. Evict the list entity's set item without a tombstone and
 *      forget the purged mutation ids, so the backend's original
 *      `addToSet` re-materializes the workspace on re-join.
 *   5. Refresh the global cache explicitly — nothing was broadcast.
 *
 * Home-org deletes keep the tombstone path (`deleteWorkspace`)
 * untouched; this module is only for workspaces consumed from a
 * backend that is being removed with Discard.
 */

import {
  EXTENSION_WORKSPACE_ENTITY_TYPE,
  EXTENSION_WORKSPACE_ID,
  EXTENSION_WORKSPACES_SET_PATH,
} from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { getActiveExtensionWorkspaceCache } from '../sync/caches/extension-workspace-cache';
import { getGlobalMutationLog, getGlobalOracle } from '../sync/global-service';
import { forgetRecentlyApplied } from '../sync/mutation-stream-bridge';
import { acquireScopeLog } from '../sync/scope-log-accessor';
import { disposeWorkspace } from '../sync/service';
import {
  getWorkspace,
  listWorkspaces,
  peekActiveWorkspaceId,
  setActiveWorkspaceById,
} from './extension-workspace-store';
import { purgeWorkspaceData } from './workspace-coordinator';

export interface EvictWorkspaceResult {
  ok: boolean;
  reason?: 'not-found' | 'not-initialized';
}

export async function evictConsumedWorkspace(id: string): Promise<EvictWorkspaceResult> {
  const target = getWorkspace(id);
  if (!target) return { ok: false, reason: 'not-found' };
  const oracle = getGlobalOracle();
  const globalLog = getGlobalMutationLog();
  const cache = getActiveExtensionWorkspaceCache();
  if (!oracle || !globalLog || !cache) return { ok: false, reason: 'not-initialized' };

  // Point the active pointer at a survivor first, while the stores are
  // intact — the flip's coordinator swap reads the outgoing state. With
  // no survivor the pointer is left dangling, same as deleteWorkspace's
  // last-workspace posture (next boot reseeds a default workspace).
  if (peekActiveWorkspaceId() === id) {
    const neighbour = listWorkspaces().find((w) => w.id !== id);
    if (neighbour) await setActiveWorkspaceById(neighbour.id);
  }

  await purgeWorkspaceData([id]);

  const scopeHandle = acquireScopeLog(id);
  let scopeForgotten: string[];
  try {
    await scopeHandle.hydrated;
    scopeForgotten = await scopeHandle.log.purgeOrg(target.orgId);
  } finally {
    scopeHandle.release();
  }
  disposeWorkspace(id);

  const globalForgotten = await globalLog.purgeOrg(target.orgId);
  await oracle.evictSetItem(
    EXTENSION_WORKSPACE_ENTITY_TYPE,
    EXTENSION_WORKSPACE_ID,
    EXTENSION_WORKSPACES_SET_PATH,
    id,
    globalForgotten,
  );
  // Third dedup layer: the wire-level echo seen set. The log purge and
  // store forget cover storage + document dedup; without this one a
  // same-session re-join's redelivery of the backend's original
  // envelopes dies at the bridge's early return.
  forgetRecentlyApplied([...scopeForgotten, ...globalForgotten]);
  cache.refresh();

  logger.info('WorkspaceEviction', `Evicted workspace ${id} "${target.name}" (org=${target.orgId})`);
  return { ok: true };
}
