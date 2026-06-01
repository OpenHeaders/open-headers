/**
 * `RequestLifecycleHub` — per-tab fanout of `RequestLifecycleStore`
 * updates to N sinks. Host-neutral; the chrome / desktop / daemon
 * adapter implements `Sink`.
 *
 * Lifecycle:
 *
 *   `attach(tabId, sink)` registers the sink under `tabId`, delivers a
 *   `ready` envelope, then replays `store.snapshotTab(tabId)` as a
 *   sequence of synthetic `started` updates. The whole attach is one
 *   synchronous block, so no live update interleaves between snapshot
 *   read and replay emit (JS single-threaded; `store.subscribe` and
 *   `snapshotTab` are both sync).
 *
 *   `detach(handle)` removes the sink; when the tab's last sink leaves
 *   the partition is dropped from the registry's bookkeeping (the store
 *   partition itself is owned by `tab-lifecycle-bridge`, NOT the hub —
 *   the hub is a read-only consumer).
 *
 *   The hub holds ONE `store.subscribe` for its lifetime, set in the
 *   constructor. Every applied update fans out via the registry.
 *
 * Failure isolation: registry catches per-sink throws so one failure
 * does not stop fanout to siblings.
 */

import type { RequestLifecycleUpdate } from '@openheaders/core/request-lifecycle';

import type { RequestLifecycleStore } from '../request-lifecycle-store';
import type { TabLifecycleBus } from '../tab-lifecycle-bus';
import { TabSinkRegistry } from '../tab-sink-registry';

import { tabIdOf } from './filter';
import { snapshotToUpdates } from './replay';
import type { AttachmentHandle, Sink } from './types';
import { InMemoryWatchSessionFloors, type WatchSessionFloors } from './watch-session-floors';

export interface RequestLifecycleHubOptions {
  readonly store: RequestLifecycleStore;
  readonly bus?: TabLifecycleBus;
  /**
   * Owns the per-tab watch-session floor. Defaults to an in-memory
   * implementation (lost on restart); a host that wants the session to
   * survive an SW restart injects a persistent one.
   */
  readonly sessionFloors?: WatchSessionFloors;
}

export class RequestLifecycleHub {
  private readonly store: RequestLifecycleStore;
  private readonly registry = new TabSinkRegistry<RequestLifecycleUpdate>('RequestLifecycleHub');
  private readonly sessionFloors: WatchSessionFloors;
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeBus: (() => void) | null;

  constructor(options: RequestLifecycleHubOptions) {
    this.store = options.store;
    this.sessionFloors = options.sessionFloors ?? new InMemoryWatchSessionFloors();
    this.unsubscribeStore = this.store.subscribe((update) => {
      this.registry.broadcast(tabIdOf(update), update);
    });
    this.unsubscribeBus = options.bus
      ? options.bus.subscribe((event) => {
          if (event.kind === 'tab-forgotten') {
            // A closed tab ends its watch session — drop the floor so a
            // future tab reusing this id starts fresh.
            this.sessionFloors.forget(event.tabId);
            this.registry.broadcastTabCleared(event.tabId);
          }
        })
      : null;
  }

  /**
   * Attach a sink and replay the tab's history scoped to `opts.sinceMs`
   * (a `startedAtMs` floor). With `sinceMs` omitted the watcher gets its
   * engine-owned watch session: the floor is resolved (and, the first
   * time the tab is watched, established at the current watermark) so a
   * reconnect or remount re-resolves the SAME floor and an in-flight
   * request observed earlier in the session still replays. The current
   * watermark is reported in the `ready` envelope. Live broadcasts after
   * attach are never floor-filtered.
   */
  attach(tabId: number, sink: Sink, opts?: { sinceMs?: number }): AttachmentHandle {
    const watermarkMs = this.store.tabWatermark(tabId);
    const sinceMs = opts?.sinceMs ?? this.sessionFloors.resolveFloor(tabId, watermarkMs);
    return this.registry.attach(tabId, sink, (s) => {
      s.deliverReady(tabId, watermarkMs);
      for (const update of snapshotToUpdates(this.store.snapshotTab(tabId, { sinceMs }))) {
        s.deliverUpdate(update);
      }
    });
  }

  /**
   * Start a fresh watch session for the tab — advance the floor to the
   * current watermark so subsequent replays drop everything observed
   * before now. The user's "Clear" calls this so the reset survives a
   * later reconnect (the consumer clears its own mirror separately).
   */
  resetSession(tabId: number): void {
    this.sessionFloors.reset(tabId, this.store.tabWatermark(tabId));
  }

  /** Tear down all attachments. Sinks are notified via `close()`. */
  dispose(): void {
    if (this.registry.isDisposed) return;
    this.unsubscribeStore();
    this.unsubscribeBus?.();
    this.registry.dispose();
  }
}
