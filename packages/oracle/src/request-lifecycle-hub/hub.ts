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
import { TabSinkRegistry } from '../tab-sink-registry';
import type { TabLifecycleBus } from '../tab-lifecycle-bus';

import { tabIdOf } from './filter';
import { snapshotToUpdates } from './replay';
import type { AttachmentHandle, Sink } from './types';

export interface RequestLifecycleHubOptions {
  readonly store: RequestLifecycleStore;
  readonly bus?: TabLifecycleBus;
}

export class RequestLifecycleHub {
  private readonly store: RequestLifecycleStore;
  private readonly registry = new TabSinkRegistry<RequestLifecycleUpdate>('RequestLifecycleHub');
  private readonly unsubscribeStore: () => void;
  private readonly unsubscribeBus: (() => void) | null;

  constructor(options: RequestLifecycleHubOptions) {
    this.store = options.store;
    this.unsubscribeStore = this.store.subscribe((update) => {
      this.registry.broadcast(tabIdOf(update), update);
    });
    this.unsubscribeBus = options.bus
      ? options.bus.subscribe((event) => {
          if (event.kind === 'tab-forgotten') {
            this.registry.broadcastTabCleared(event.tabId);
          }
        })
      : null;
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    return this.registry.attach(tabId, sink, (s) => {
      for (const update of snapshotToUpdates(this.store.snapshotTab(tabId))) {
        s.deliverUpdate(update);
      }
    });
  }

  /** Tear down all attachments. Sinks are notified via `close()`. */
  dispose(): void {
    if (this.registry.isDisposed) return;
    this.unsubscribeStore();
    this.unsubscribeBus?.();
    this.registry.dispose();
  }
}
