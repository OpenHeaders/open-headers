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
 *   `detach(handle)` removes the sink; when the per-tab refcount hits
 *   zero the tab partition is dropped from the hub's bookkeeping (the
 *   store partition itself is owned by `tab-lifecycle-bridge`, NOT
 *   the hub — the hub is a read-only consumer).
 *
 *   The hub holds ONE `store.subscribe` for its lifetime, set in the
 *   constructor. Every applied update fans out O(1) lookup + O(sinks)
 *   delivery per tab.
 *
 * Failure isolation: `deliverUpdate` exceptions from one sink do not
 * stop fanout to other sinks — caller wraps post calls if needed; the
 * hub treats sinks as best-effort delivery channels.
 */

import type { RequestLifecycleStore } from '../request-lifecycle-store';

import { tabIdOf } from './filter';
import { snapshotToUpdates } from './replay';
import type { AttachmentHandle, Sink } from './types';

export interface RequestLifecycleHubOptions {
  readonly store: RequestLifecycleStore;
}

interface TabAttachment {
  refCount: number;
  sinks: Set<Sink>;
}

export class RequestLifecycleHub {
  private readonly store: RequestLifecycleStore;
  private readonly attachments = new Map<number, TabAttachment>();
  private readonly unsubscribeStore: () => void;
  private disposed = false;

  constructor(options: RequestLifecycleHubOptions) {
    this.store = options.store;
    this.unsubscribeStore = this.store.subscribe((update) => {
      const attachment = this.attachments.get(tabIdOf(update));
      if (attachment === undefined) return;
      for (const sink of attachment.sinks) {
        try {
          sink.deliverUpdate(update);
        } catch {
          /* sink delivery is best-effort — a throw must not block siblings */
        }
      }
    });
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    if (this.disposed) throw new Error('RequestLifecycleHub: attach after dispose');
    const attachment = this.attachments.get(tabId) ?? this.openAttachment(tabId);
    attachment.refCount++;
    attachment.sinks.add(sink);

    sink.deliverReady(tabId);
    const replay = snapshotToUpdates(this.store.snapshotTab(tabId));
    for (const update of replay) sink.deliverUpdate(update);

    let detached = false;
    return {
      tabId,
      detach: () => {
        if (detached) return;
        detached = true;
        this.removeSink(tabId, sink);
      },
    };
  }

  /** Tear down all attachments. Sinks are notified via `close()`. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribeStore();
    for (const attachment of this.attachments.values()) {
      for (const sink of attachment.sinks) sink.close();
    }
    this.attachments.clear();
  }

  private openAttachment(tabId: number): TabAttachment {
    const attachment: TabAttachment = { refCount: 0, sinks: new Set() };
    this.attachments.set(tabId, attachment);
    return attachment;
  }

  private removeSink(tabId: number, sink: Sink): void {
    const attachment = this.attachments.get(tabId);
    if (attachment === undefined) return;
    attachment.sinks.delete(sink);
    attachment.refCount--;
    if (attachment.refCount <= 0) this.attachments.delete(tabId);
  }
}
