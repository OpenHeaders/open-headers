/**
 * Sync service — Active-workspace flip: the single-flight
 * `setRuntimeActive` chain, its legacy shims, and the Active-pointer
 * teardown.
 */

import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { getOrCreateWorkspaceService, releaseWorkspaceService } from './lifecycle';
import { attachActiveBoundRunners, detachActiveBoundRunners } from './runners';
import { currentActive, services, setCurrentActive } from './state';
import type { WorkspaceServiceState } from './types';

/**
 * Structured outcome of {@link setRuntimeActive}. The five `ok: false`
 * reasons let callers respond differently — silent retry on
 * `workspace-disposed`, "rate-limited" toast on `runner-attach-failed`,
 * workspace-list refresh on `workspace-not-found`, etc.
 */
export type SetActiveResult =
  | { ok: true }
  | { ok: false; reason: 'workspace-disposed' }
  | { ok: false; reason: 'workspace-not-found' }
  | { ok: false; reason: 'hydration-failed'; error: unknown }
  | { ok: false; reason: 'runner-attach-failed'; error: unknown }
  | { ok: false; reason: 'storage-failed'; error: unknown };

/**
 * Single-flight chain for {@link setRuntimeActive}. Each call queues
 * onto the previous one's settle (success OR failure — chained via
 * `.catch(() => undefined)` so a transient failure does not poison
 * subsequent flips). Rapid `setRuntimeActive(W2) → setRuntimeActive(W3)`
 * preserves arrival order; W3 is never observable before W2's flip
 * settles.
 */
let activeFlipChain: Promise<unknown> = Promise.resolve();

/**
 * Make `workspaceId` the Active workspace. Single-flight: serializes
 * with prior calls to avoid split-brain (two flips interleaving their
 * detach/attach steps). Returns a {@link SetActiveResult} so callers
 * can distinguish transient failures (hydration / attach / storage)
 * from terminal ones (workspace deleted mid-flight).
 *
 * Boot is the atomicity backstop. `bootSyncSubsystem` calls
 * `setRuntimeActive(persistedActive)` — same code path. Eviction
 * recovery is structurally identical to cold boot. Rigorous mid-flip
 * rollback is NOT specified — torn flips heal at next SW eviction.
 */
export function setRuntimeActive(workspaceId: string): Promise<SetActiveResult> {
  const next = activeFlipChain.catch(() => undefined).then(() => doSetActive(workspaceId));
  activeFlipChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/**
 * Make `workspaceId` the Active workspace synchronously. Legacy entry
 * point — fire-and-forget; bypasses the single-flight queue's structured
 * result. Prefer {@link setRuntimeActive} for new call sites.
 *
 * Today this delegates to {@link setRuntimeActive} (which executes
 * synchronously when no flip is in flight). Kept on the public surface
 * because background.ts boot + workspace-coord callers already invoke
 * it; sub-commit 1b doesn't sweep those call sites.
 */
export function initSyncService(workspaceId: string): void {
  void setRuntimeActive(workspaceId);
}

async function doSetActive(workspaceId: string): Promise<SetActiveResult> {
  // 1. Lazy-acquire (refcount++). Today this never throws — the slot
  //    is always synthesizable. Future commits may surface
  //    `workspace-not-found` from a registry check before the acquire.
  let newSvc: WorkspaceServiceState;
  try {
    newSvc = getOrCreateWorkspaceService(workspaceId);
  } catch (error) {
    logger.warn('SyncService', `setRuntimeActive(${workspaceId}): workspace-not-found`, error);
    return { ok: false, reason: 'workspace-not-found' };
  }

  // 2. Hydration gate. Resolves synchronously today; the contract is in
  //    place for a future async seed-from-storage step.
  try {
    await newSvc.hydrated;
  } catch (error) {
    releaseWorkspaceService(workspaceId);
    logger.warn('SyncService', `setRuntimeActive(${workspaceId}): hydration-failed`, error);
    return { ok: false, reason: 'hydration-failed', error };
  }

  // 3. Disposed mid-flight (forced disposal happened between acquire
  //    and hydrate)? Release the ref we got and report the structured
  //    failure so the caller can refresh its workspace list.
  if (newSvc.disposing) {
    releaseWorkspaceService(workspaceId);
    return { ok: false, reason: 'workspace-disposed' };
  }

  // 4. Same-as-current short-circuit. Release the extra ref the
  //    acquire above gave us; the existing Active pointer ref is the
  //    one that stays.
  if (currentActive === workspaceId) {
    releaseWorkspaceService(workspaceId);
    return { ok: true };
  }

  const oldActive = currentActive;

  // 5. Detach Active-bound runners on the old service. Cache singletons
  //    no longer exist (1d) — caches are per-workspace and stay alive
  //    for the workspace's full residency, so there's nothing to detach
  //    on that axis. Runner detach must precede new-runner attach so
  //    `recompile` (browser-singular DNR rebuild) is never doubly
  //    subscribed across the swap point.
  if (oldActive !== null) {
    const oldSvc = services.get(oldActive);
    if (oldSvc) detachActiveBoundRunners(oldSvc);
  }

  // 6. Attach Active-bound runners on the new service. Runner attach is
  //    the swap point — at exactly this moment the new workspace's
  //    intent envelopes start driving `recompile`. The "≤1 DNR-writing
  //    runner at a time" invariant is therefore one structural step.
  try {
    attachActiveBoundRunners(newSvc);
  } catch (error) {
    detachActiveBoundRunners(newSvc);
    releaseWorkspaceService(workspaceId);
    logger.warn('SyncService', `setRuntimeActive(${workspaceId}): runner-attach-failed`, error);
    return { ok: false, reason: 'runner-attach-failed', error };
  }

  // 7. Update Active pointer; release old's Active ref (may schedule
  //    grace-period disposal if no other refs hold it).
  setCurrentActive(workspaceId);
  if (oldActive !== null) {
    releaseWorkspaceService(oldActive);
  }

  logger.info(
    'SyncService',
    `Active workspace = ${workspaceId} (entity=${RULE_ENTITY_TYPE}, nodeId=${newSvc.context.nodeId})`,
  );
  return { ok: true };
}

/**
 * Drop the Active pointer. The Active workspace's Active-bound runner
 * subscriptions are disposed; its service may be torn down after grace
 * if no other refs hold it. Used at SW shutdown and by the test harness.
 */
export function dispose(): void {
  if (currentActive === null) return;
  const svc = services.get(currentActive);
  if (svc) detachActiveBoundRunners(svc);
  const oldActive = currentActive;
  setCurrentActive(null);
  releaseWorkspaceService(oldActive);
}

/** Re-initialize for a new workspace in one call. */
export function reinitForWorkspace(workspaceId: string): void {
  initSyncService(workspaceId);
}
