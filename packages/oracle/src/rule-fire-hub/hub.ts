/**
 * `RuleFireHub` — per-tab broadcaster for rule fire observations.
 *
 * Combines an internal `RuleFireStore` (dedup + merge + ring cap) with
 * the lifecycle-hub fanout pattern. Notify verbs are the engine inputs;
 * `attach`/`detach` are the consumer outputs.
 *
 * Notify verbs:
 *   - `notifyHeuristicFire(tabId, record)` — fire inferred by tab
 *     telemetry from a webRequest match. `authoritative = false`.
 *   - `notifyAuthoritativeFire(tabId, record)` — fire reported by
 *     `chrome.declarativeNetRequest.onRuleMatchedDebug` (or any host
 *     equivalent). `authoritative = true`.
 *   - `forgetTab(tabId)` — drop the tab's fire log; broadcasts
 *     `'tab-cleared'` (mirrors `PageStreamHub.forgetTab`). Called from
 *     `chrome.tabs.onRemoved` adapters.
 *
 * The two notify verbs converge through the store's `ingest`; if the
 * arrival is a no-op (existing entry already stronger), the hub skips
 * the broadcast — same "if next === prev return" discipline as the page
 * hub. The store's merge output drives the wire payload, so consumers
 * always see post-merge state.
 *
 * Replay: `attach` delivers `ready` then re-emits the tab's ordered
 * snapshot as `'fire'` updates synchronously. JS single-threaded; the
 * notify verbs mutate + broadcast synchronously, so no live update
 * interleaves between snapshot read and replay emit.
 *
 * Failure isolation: a `deliverUpdate` throw from one sink does not stop
 * fanout to siblings.
 */

import type { RequestRecord } from '@openheaders/core/types';
import type { RuleFireUpdate } from '@openheaders/core/rule-fire-stream';

import { snapshotToUpdates } from './replay';
import { RuleFireStore } from './store';
import type { AttachmentHandle, Sink } from './types';

export class RuleFireHub {
  private readonly store = new RuleFireStore();
  private readonly attachments = new Map<number, Set<Sink>>();
  private disposed = false;

  notifyHeuristicFire(tabId: number, record: RequestRecord): void {
    this.ingestAndBroadcast(tabId, record, false);
  }

  notifyAuthoritativeFire(tabId: number, record: RequestRecord): void {
    this.ingestAndBroadcast(tabId, record, true);
  }

  forgetTab(tabId: number): void {
    this.guardDisposed();
    if (!this.store.forgetTab(tabId)) return;
    this.broadcast(tabId, { kind: 'tab-cleared', tabId });
  }

  /** Read-only snapshot — exposed for tests + parity tooling. */
  snapshotTab(tabId: number): ReturnType<RuleFireStore['snapshotTab']> {
    return this.store.snapshotTab(tabId);
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    if (this.disposed) throw new Error('RuleFireHub: attach after dispose');
    let sinks = this.attachments.get(tabId);
    if (sinks === undefined) {
      sinks = new Set();
      this.attachments.set(tabId, sinks);
    }
    sinks.add(sink);

    sink.deliverReady(tabId);
    for (const update of snapshotToUpdates(tabId, this.store.snapshotTab(tabId))) {
      sink.deliverUpdate(update);
    }

    let detached = false;
    return {
      tabId,
      detach: () => {
        if (detached) return;
        detached = true;
        const set = this.attachments.get(tabId);
        if (set === undefined) return;
        set.delete(sink);
        if (set.size === 0) this.attachments.delete(tabId);
      },
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sinks of this.attachments.values()) {
      for (const sink of sinks) {
        try {
          sink.close();
        } catch {
          /* close is best-effort */
        }
      }
    }
    this.attachments.clear();
  }

  private ingestAndBroadcast(tabId: number, record: RequestRecord, authoritative: boolean): void {
    this.guardDisposed();
    const merged = this.store.ingest(tabId, record, authoritative);
    if (merged === null) return;
    this.broadcast(tabId, {
      kind: 'fire',
      tabId,
      record: merged.record,
      authoritative: merged.authoritative,
    });
  }

  private broadcast(tabId: number, update: RuleFireUpdate): void {
    const sinks = this.attachments.get(tabId);
    if (sinks === undefined) return;
    for (const sink of sinks) {
      try {
        sink.deliverUpdate(update);
      } catch {
        /* sink delivery is best-effort */
      }
    }
  }

  private guardDisposed(): void {
    if (this.disposed) throw new Error('RuleFireHub: operation after dispose');
  }
}
