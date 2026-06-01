/**
 * `RuleFireHub` — per-tab broadcaster for rule fire observations.
 *
 * Hub owns an internal `RuleFireStore` (dedup + merge + ring cap); the
 * per-tab sink fanout substrate is delegated to `TabSinkRegistry`.
 * Notify verbs are the engine inputs; `attach`/`detach` are the
 * consumer outputs.
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
 * Failure isolation: registry catches per-sink `deliverUpdate` throws
 * so one failure does not stop fanout to siblings.
 */

import type { RuleFireUpdate } from '@openheaders/core/rule-fire-stream';
import type { RequestRecord } from '@openheaders/core/types';

import type { TabLifecycleBus } from '../tab-lifecycle-bus';
import { TabSinkRegistry } from '../tab-sink-registry';

import { snapshotToUpdates } from './replay';
import { RuleFireStore } from './store';
import type { AttachmentHandle, Sink } from './types';

export interface RuleFireHubOptions {
  readonly bus?: TabLifecycleBus;
}

export class RuleFireHub {
  private readonly store = new RuleFireStore();
  private readonly registry = new TabSinkRegistry<RuleFireUpdate>('RuleFireHub');
  private readonly unsubscribeBus: (() => void) | null;

  constructor(options: RuleFireHubOptions = {}) {
    this.unsubscribeBus = options.bus
      ? options.bus.subscribe((event) => {
          if (event.kind === 'tab-forgotten') this.forgetTab(event.tabId);
        })
      : null;
  }

  notifyHeuristicFire(tabId: number, record: RequestRecord): void {
    this.ingestAndBroadcast(tabId, record, false);
  }

  notifyAuthoritativeFire(tabId: number, record: RequestRecord): void {
    this.ingestAndBroadcast(tabId, record, true);
  }

  forgetTab(tabId: number): void {
    this.registry.guardDisposed();
    if (!this.store.forgetTab(tabId)) return;
    this.registry.broadcast(tabId, { kind: 'tab-cleared', tabId });
  }

  /** Read-only snapshot — exposed for tests + parity tooling. */
  snapshotTab(tabId: number): ReturnType<RuleFireStore['snapshotTab']> {
    return this.store.snapshotTab(tabId);
  }

  attach(tabId: number, sink: Sink): AttachmentHandle {
    return this.registry.attach(tabId, sink, (s) => {
      s.deliverReady(tabId);
      for (const update of snapshotToUpdates(tabId, this.store.snapshotTab(tabId))) {
        s.deliverUpdate(update);
      }
    });
  }

  dispose(): void {
    this.unsubscribeBus?.();
    this.registry.dispose();
  }

  private ingestAndBroadcast(tabId: number, record: RequestRecord, authoritative: boolean): void {
    this.registry.guardDisposed();
    const merged = this.store.ingest(tabId, record, authoritative);
    if (merged === null) return;
    this.registry.broadcast(tabId, {
      kind: 'fire',
      tabId,
      record: merged.record,
      authoritative: merged.authoritative,
    });
  }
}
