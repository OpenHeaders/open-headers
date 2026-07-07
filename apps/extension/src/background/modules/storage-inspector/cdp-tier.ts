/**
 * CDP tier of the storage inspector — additive, never required
 * (STORAGE_PANEL_PLAN.md §2.3). When the inspected tab is CDP-attached,
 * scope listing upgrades each scope with its partitioned storage key via
 * `Storage.getStorageKey`; detached tabs just skip the stamp.
 *
 * The access seam is registered by the lifecycle pipeline (which owns
 * the attach reconciler and the debugger source) — this module NEVER
 * attaches or names `chrome.debugger` itself; it only asks the existing
 * attach state and rides the existing session sender. Storage keys come
 * only from the browser (`Storage.getStorageKey`) — never recomputed
 * here.
 */

import type { StorageScopeWire } from '@openheaders/core/bridge';
import { logger } from '@utils/logger';

export interface StorageCdpAccess {
  /** Whether the reconciler holds a committed CDP attachment for the tab. */
  isAttached(tabId: number): boolean;
  /** Issue one CDP command on the tab's root session. */
  send(tabId: number, method: string, params?: Record<string, unknown>): Promise<unknown>;
}

let access: StorageCdpAccess | null = null;

/** Registered once by the lifecycle pipeline. Idempotent (SW re-init). */
export function registerStorageCdpAccess(next: StorageCdpAccess): void {
  access = next;
}

/** Test-only — drop the registration so tests start from a clean seam. */
export function __resetStorageCdpAccessForTests(): void {
  access = null;
}

interface RawFrame {
  id: string;
  url?: string;
}

interface RawFrameTreeNode {
  frame: RawFrame;
  childFrames?: RawFrameTreeNode[];
}

/** Map each http(s) origin in the CDP frame tree to its topmost frame id
 *  (breadth-first, so the main frame and shallower frames win). */
function frameIdsByOrigin(root: RawFrameTreeNode): Map<string, string> {
  const byOrigin = new Map<string, string>();
  const queue: RawFrameTreeNode[] = [root];
  while (queue.length > 0) {
    const node = queue.shift();
    if (!node) break;
    const url = node.frame?.url;
    if (typeof url === 'string') {
      try {
        const origin = new URL(url).origin;
        if (!byOrigin.has(origin)) byOrigin.set(origin, node.frame.id);
      } catch {
        // Non-URL frame (about:blank etc.) — no scope maps to it anyway.
      }
    }
    for (const child of node.childFrames ?? []) queue.push(child);
  }
  return byOrigin;
}

/**
 * Stamp each scope's partitioned storage key when the tab is attached.
 * Display-only enrichment: any failure (detached mid-flight, tree
 * unavailable, per-frame command error) leaves the scope unstamped and
 * the standard-plane result intact.
 */
export async function stampStorageKeys(tabId: number, scopes: StorageScopeWire[]): Promise<StorageScopeWire[]> {
  if (!access || scopes.length === 0 || !access.isAttached(tabId)) return scopes;

  let byOrigin: Map<string, string>;
  try {
    const tree = (await access.send(tabId, 'Page.getFrameTree')) as { frameTree?: RawFrameTreeNode } | undefined;
    if (!tree?.frameTree) return scopes;
    byOrigin = frameIdsByOrigin(tree.frameTree);
  } catch (e) {
    logger.info('StorageCdpTier', `getFrameTree ✗ tab ${tabId}: ${(e as Error).message}`);
    return scopes;
  }

  return Promise.all(
    scopes.map(async (scope) => {
      const frameId = byOrigin.get(scope.origin);
      if (!frameId) return scope;
      try {
        const res = (await access?.send(tabId, 'Storage.getStorageKey', { frameId })) as
          | { storageKey?: string }
          | undefined;
        return typeof res?.storageKey === 'string' ? { ...scope, storageKey: res.storageKey } : scope;
      } catch {
        return scope;
      }
    }),
  );
}
