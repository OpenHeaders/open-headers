/**
 * `LifecycleClientStore` — panel-side per-request map fed by
 * `LifecycleWireMessage`s arriving on `oh-lifecycle:<tabId>`.
 *
 * The hub is the authoritative engine-side store; this one is its
 * downstream mirror. Scope is a single tab (the inspected one) — the
 * port host already partitions per tab, so this store does not need a
 * per-tab map of its own.
 *
 * Differences from the engine store on purpose:
 *   - No LRU. The SW already bounds memory; replay never exceeds the
 *     engine's cap. A second eviction policy here would compete with the
 *     engine's and produce divergent ordering.
 *   - No invariant enforcement. The reducer is trust-but-apply (see
 *     `lifecycle-client-reducer.ts`) — rejection happens upstream.
 *   - No `forgetTab`. The store is single-tab; `clear()` is the only
 *     drop verb and is driven by a `ready` envelope (replay-on-reconnect
 *     rebuilds from the engine's current state) or by panel UI action.
 *
 * Snapshot shape is structurally stable: `getSnapshot()` returns the
 * same object until an `apply()` or `clear()` actually mutates state,
 * which lets React's `useSyncExternalStore` short-circuit re-renders on
 * upstream noops (e.g. duplicate `started` for a known request).
 */

import type { RequestLifecycle, RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import { NOOP, reduceClientUpdate } from './lifecycle-client-reducer';
import { createSnapshotPublisher } from './snapshot-publisher';

export interface LifecycleClientSnapshot {
  /** Identity map keyed by `requestId`. */
  readonly byRequestId: ReadonlyMap<string, RequestLifecycle>;
  /** Insertion-ordered values. Oldest first — same as Map iteration. */
  readonly ordered: readonly RequestLifecycle[];
}

const EMPTY_SNAPSHOT: LifecycleClientSnapshot = Object.freeze({
  byRequestId: new Map<string, RequestLifecycle>(),
  ordered: Object.freeze([]) as readonly RequestLifecycle[],
});

export class LifecycleClientStore {
  private byRequestId = new Map<string, RequestLifecycle>();
  private readonly pub = createSnapshotPublisher<LifecycleClientSnapshot>(
    () => ({
      byRequestId: new Map(this.byRequestId),
      ordered: [...this.byRequestId.values()],
    }),
    EMPTY_SNAPSHOT,
  );

  /** Apply one engine update. Noop reducer results skip notify. */
  apply(update: RequestLifecycleUpdate): void {
    const requestId = requestIdOf(update);
    const prev = this.byRequestId.get(requestId);
    const result = reduceClientUpdate(prev, update);

    if (result === NOOP) return;

    if (result === null) {
      this.byRequestId.delete(requestId);
    } else {
      this.byRequestId.set(requestId, result);
    }
    this.pub.markDirty();
  }

  /**
   * Reset to empty. Called on `ready` (so replay rebuilds from a clean
   * slate after a port reconnect — SW eviction, panel reload) and on a
   * user-driven panel "clear" action.
   */
  clear(): void {
    if (this.byRequestId.size === 0) return;
    this.byRequestId = new Map();
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}

function requestIdOf(update: RequestLifecycleUpdate): string {
  return update.kind === 'started' ? update.lifecycle.requestId : update.requestId;
}
