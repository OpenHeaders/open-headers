/**
 * CDP tier of the storage inspector — additive, never required
 * (STORAGE_PANEL_PLAN.md §2.3). When the inspected tab is CDP-attached,
 * scope listing upgrades each scope with its partitioned storage key via
 * `Storage.getStorageKey`, and arms `Storage.trackIndexedDBForStorageKey`
 * per stamped key so IDB changes push an invalidation note to the panel
 * (which refetches through the injected read plane — the CDP `IndexedDB`
 * read domain stays blocked). Detached tabs skip both.
 *
 * The access seam is registered by the lifecycle pipeline (which owns
 * the attach reconciler and the debugger source) — this module NEVER
 * attaches or names `chrome.debugger` itself; it only asks the existing
 * attach state and rides the existing session sender + event fan.
 * Storage keys come only from the browser (`Storage.getStorageKey`) —
 * never recomputed here.
 *
 * Tracking subscriptions are DERIVED state (plan §7): the armed set
 * lives in module memory, dies with the SW or a detach, and re-arms on
 * the next scope listing of an attached tab — never persisted.
 */

import type { StorageScopeWire } from '@openheaders/core/bridge';
import { broadcast } from '@utils/bridge';
import { logger } from '@utils/logger';

export interface StorageCdpAccess {
  /** Whether the reconciler holds a committed CDP attachment for the tab. */
  isAttached(tabId: number): boolean;
  /** Issue one CDP command on the tab's root session. */
  send(tabId: number, method: string, params?: Record<string, unknown>): Promise<unknown>;
  /** Observe IDB tracking updates for an armed storage key. Returns unsubscribe. */
  subscribeIdbUpdated(listener: (tabId: number, storageKey: string) => void): () => void;
  /** Observe a tab's CDP detach. Returns unsubscribe. */
  onDetach(listener: (tabId: number) => void): () => void;
}

let access: StorageCdpAccess | null = null;
let accessUnsubscribers: Array<() => void> = [];
/** Storage keys with a live tracking subscription, per attached tab. */
const armedIdbKeys = new Map<number, Set<string>>();

/** Registered once by the lifecycle pipeline. Idempotent (SW re-init). */
export function registerStorageCdpAccess(next: StorageCdpAccess): void {
  for (const off of accessUnsubscribers) off();
  accessUnsubscribers = [];
  armedIdbKeys.clear();
  access = next;
  accessUnsubscribers.push(
    // Relay only for a tab this module armed — the panel treats the note
    // as WHAT went stale, never as data.
    next.subscribeIdbUpdated((tabId) => {
      if (armedIdbKeys.has(tabId)) broadcast('idbStorageInvalidated', { tabId });
    }),
    // The browser drops tracking subscriptions with the attachment; drop
    // the bookkeeping too so a re-attach re-arms on its next listing.
    next.onDetach((tabId) => {
      armedIdbKeys.delete(tabId);
    }),
  );
}

/** Test-only — drop the registration so tests start from a clean seam. */
export function __resetStorageCdpAccessForTests(): void {
  for (const off of accessUnsubscribers) off();
  accessUnsubscribers = [];
  armedIdbKeys.clear();
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

/**
 * Arm IDB change tracking for each stamped storage key not yet armed on
 * the tab. Rides the scope listing (the moment the panel is actually
 * looking, with the frame-tree walk already paid) — fire-and-forget:
 * a failed arm just stays un-armed and the next listing retries.
 */
export async function armIdbTracking(tabId: number, scopes: StorageScopeWire[]): Promise<void> {
  if (!access || !access.isAttached(tabId)) return;
  for (const scope of scopes) {
    const storageKey = scope.storageKey;
    if (typeof storageKey !== 'string' || armedIdbKeys.get(tabId)?.has(storageKey)) continue;
    try {
      await access.send(tabId, 'Storage.trackIndexedDBForStorageKey', { storageKey });
      let armed = armedIdbKeys.get(tabId);
      if (!armed) {
        armed = new Set();
        armedIdbKeys.set(tabId, armed);
      }
      armed.add(storageKey);
    } catch (e) {
      logger.info('StorageCdpTier', `trackIndexedDB ✗ tab ${tabId}: ${(e as Error).message}`);
    }
  }
}
