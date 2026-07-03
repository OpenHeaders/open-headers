/**
 * Sync service — awareness surface: renderer publishes, per-workspace
 * store accessors, presence snapshots, and the lifeline-driven
 * instance sweep.
 */

import type { AwarenessPublishRequest, AwarenessPublishResponse, AwarenessState } from '@openheaders/core/protocol';
import type { AwarenessStore } from '../awareness/awareness';
import { handleAwarenessPublish } from '../awareness/awareness-bridge';
import { currentActive, services } from './state';

// ── Awareness ────────────────────────────────────────────────────────

/**
 * Apply an awareness publish from a renderer surface. Returns the
 * post-GC presence so the caller's local mirror has an immediate
 * synchronous answer; the subsequent `awarenessBroadcast` carries the
 * same shape to every other surface. Cross-workspace publishes (a
 * renderer that hasn't observed an Active workspace switch yet) drop
 * to an empty presence list rather than throwing — the renderer's
 * mirror clears the entry.
 */
export function publishAwareness(request: AwarenessPublishRequest): AwarenessPublishResponse {
  return handleAwarenessPublish((workspaceId) => services.get(workspaceId)?.awareness ?? null, request);
}

/**
 * Direct accessor for SW-internal consumers (e.g. tests). Returns the
 * Active workspace's awareness store, or null when no Active workspace
 * is set.
 */
export function getAwarenessStoreForCurrentWorkspace(): AwarenessStore | null {
  if (currentActive === null) return null;
  return services.get(currentActive)?.awareness ?? null;
}

/**
 * Workspace-targeted accessor — used by the cross-host awareness
 * receiver to route inbound peer presence into the right per-workspace
 * store. Returns null when no service exists for the id (workspace not
 * resident on this host yet); receivers degrade silently in that case.
 */
export function getAwarenessStoreForWorkspace(workspaceId: string): AwarenessStore | null {
  return services.get(workspaceId)?.awareness ?? null;
}

/**
 * Snapshot the canonical presence list for the Active workspace — used
 * by renderer surfaces on mount so they have a starting view before
 * the next publish/broadcast.
 */
export function snapshotAwarenessPresence(): AwarenessState[] {
  if (currentActive === null) return [];
  return services.get(currentActive)?.awareness.list() ?? [];
}

/**
 * Drop a presence row by `instanceId` across every resident workspace.
 * Called by the lifeline port handler on `onDisconnect`, which fires
 * whenever a surface unmounts or the tab closes — connection-bound
 * liveness instead of polling. The lifeline doesn't know which
 * workspace the surface was attached to (a surface may have rebound
 * during its lifetime), so the sweep clears the row from every
 * resident workspace; missing rows are silent no-ops.
 */
export function removeAwarenessByInstanceId(instanceId: string): void {
  for (const svc of services.values()) {
    svc.awareness.remove(instanceId);
  }
}
