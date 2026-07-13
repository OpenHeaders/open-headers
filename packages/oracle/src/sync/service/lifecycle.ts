/**
 * Sync service — per-workspace residency lifecycle: lazy refcounted
 * acquire, grace-period release, forced disposal, and the shared
 * teardown path.
 */

import { logger } from '@openheaders/core/utils';
import { getOracleHostHooks } from '@openheaders/oracle/sync';
import { disposeCaches } from '../entity-registry';
import { buildService } from './build';
import { detachActiveBoundRunners } from './runners';
import { depsFactory, graceMs, services } from './state';
import type { WorkspaceServiceState } from './types';

/**
 * Lazy + refcount-incrementing accessor for a workspace's service
 * state. Idempotent: subsequent calls return the same slot and bump
 * its refcount. Cancels any pending grace-period disposal timer so
 * a service with refcount=0 inside its grace window can be re-acquired
 * cleanly.
 *
 * The caller MUST pair every successful acquisition with exactly one
 * {@link releaseWorkspaceService} call (or {@link disposeWorkspace} if
 * the workspace is being deleted).
 */
export function getOrCreateWorkspaceService(workspaceId: string): WorkspaceServiceState {
  let svc = services.get(workspaceId);
  if (svc?.disposing) {
    // A teardown is mid-flight; rebuild a fresh service. Should be
    // unreachable today (teardown is synchronous) but the contract
    // matters once seed-from-storage becomes async in later commits.
    svc = undefined;
  }
  if (!svc) {
    svc = buildService(depsFactory(workspaceId));
    services.set(workspaceId, svc);
  }
  if (svc.disposalTimer !== null) {
    clearTimeout(svc.disposalTimer);
    svc.disposalTimer = null;
  }
  svc.refcount++;
  return svc;
}

/**
 * Refcount-incrementing acquire for an ALREADY-resident workspace
 * service — returns `null` instead of building one when the workspace
 * has no live service. For callers that want to ride an existing sync
 * runtime when present but must not force-materialize one (the
 * workspace-import orchestrator's local-mutation emission). A non-null
 * return must be paired with exactly one {@link releaseWorkspaceService}.
 */
export function acquireResidentWorkspaceService(workspaceId: string): WorkspaceServiceState | null {
  const svc = services.get(workspaceId);
  if (!svc || svc.disposing) return null;
  return getOrCreateWorkspaceService(workspaceId);
}

/**
 * Decrement a workspace service's refcount. When refcount reaches 0 the
 * service is scheduled for disposal after `graceMs`; the timer is
 * cancellable by a subsequent {@link getOrCreateWorkspaceService}
 * within the window. Already-disposing services are ignored.
 */
export function releaseWorkspaceService(workspaceId: string): void {
  const svc = services.get(workspaceId);
  if (!svc || svc.disposing) return;
  svc.refcount = Math.max(0, svc.refcount - 1);
  if (svc.refcount > 0) return;
  if (svc.disposalTimer !== null) return; // already scheduled
  if (graceMs <= 0) {
    finalizeDisposal(svc);
    return;
  }
  svc.disposalTimer = setTimeout(() => {
    svc.disposalTimer = null;
    if (svc.refcount === 0 && !svc.disposing) finalizeDisposal(svc);
  }, graceMs);
}

/**
 * Forced disposal — used on workspace deletion. Tears down the service
 * regardless of refcount and removes it from the map immediately.
 * In-flight applies that hold a refcount will see the next operation
 * fail because the oracle's underlying resources are released; future
 * commits add an explicit `disposing` short-circuit on the apply path.
 */
export function disposeWorkspace(workspaceId: string): void {
  const svc = services.get(workspaceId);
  if (!svc) return;
  if (svc.disposalTimer !== null) {
    clearTimeout(svc.disposalTimer);
    svc.disposalTimer = null;
  }
  finalizeDisposal(svc);
}
/**
 * Tear down a workspace service unconditionally and remove it from
 * the map. Idempotent — repeat calls on an already-disposed service
 * are no-ops.
 */
function finalizeDisposal(svc: WorkspaceServiceState): void {
  if (svc.disposing) return;
  svc.disposing = true;
  if (svc.disposalTimer !== null) {
    clearTimeout(svc.disposalTimer);
    svc.disposalTimer = null;
  }
  // Detach Active-bound runners first if this was the Active service —
  // the broadcast unsubscribe below would prevent late event delivery
  // anyway, but explicit detach surfaces the invariant.
  detachActiveBoundRunners(svc);
  svc.unsubscribeBroadcast();
  disposeCaches(svc.caches);
  svc.awareness.dispose();
  // Drop the per-workspace variables-resolver state alongside the
  // service teardown so the resolver memo + live-cache mirror don't
  // outlive their owning workspace (F-16).
  getOracleHostHooks().disposeResolverStateForWorkspace?.(svc.workspaceId);
  services.delete(svc.workspaceId);
  logger.info('SyncService', `Disposed workspace ${svc.workspaceId}`);
}
