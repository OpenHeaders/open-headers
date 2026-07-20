/**
 * `ResourceTimingClientStore` — panel-side mirror of the inspected tab's
 * Resource Timing, fed by `ResourceTimingUpdate`s on `oh-rt:<tabId>`.
 *
 * Sibling of `PageClientStore`. The Resource Timing buffer is reset on
 * every navigation (it lives in the document), so a single last-wins
 * snapshot would lose a prior page's memory-cache hits the moment the
 * tab navigates — even with preserve-log on. To match how real rows
 * persist, the relay (the authoritative SW-side hub) keeps **one group
 * per navigation**, keyed by the document's `timeOrigin`, and replays
 * every group on attach; this store mirrors them. A `snapshot` upserts
 * the group for its origin (same document → replace as the buffer grows;
 * new document → a new group).
 *
 * Snapshot identity is structurally stable — `getSnapshot()` returns the
 * same reference until `apply()` / `clear()` mutates state.
 *
 * Single-tab; the relay partitions per tab. `clear()` drops every group
 * — driven by the hook's `ready` (replay-on-reconnect, rebuilt from the
 * relay's full replay), a `tab-cleared` update, or the panel Clear
 * action. Upsert-by-origin keeps the replay idempotent either way.
 */

import type { ResourceTimingEntry, ResourceTimingUpdate } from '@openheaders/core/resource-timing';

import { createSnapshotPublisher } from './snapshot-publisher';

export interface ResourceTimingPageGroup {
  /** Document time origin in wall-clock ms — the per-navigation key. */
  readonly timeOriginMs: number;
  /** That document's cumulative Resource Timing entries. */
  readonly entries: readonly ResourceTimingEntry[];
}

export interface ResourceTimingClientSnapshot {
  /** One group per observed navigation, in arrival order. */
  readonly groups: readonly ResourceTimingPageGroup[];
}

/** Shared frozen empty snapshot — a surface with no resource-timing
 *  feed (the proxy capture view) feeds this to `usePanelData`. */
export const EMPTY_RESOURCE_TIMING_SNAPSHOT: ResourceTimingClientSnapshot = Object.freeze({
  groups: Object.freeze([]) as readonly ResourceTimingPageGroup[],
});
const EMPTY_SNAPSHOT = EMPTY_RESOURCE_TIMING_SNAPSHOT;

export class ResourceTimingClientStore {
  // Keyed by rounded time origin so the rare `Date.now()-performance.now()`
  // fallback (when `performance.timeOrigin` is unavailable) doesn't mint a
  // fresh group every poll. Map preserves insertion (navigation) order.
  private readonly groups = new Map<number, ResourceTimingPageGroup>();
  private readonly pub = createSnapshotPublisher<ResourceTimingClientSnapshot>(
    () => ({ groups: [...this.groups.values()] }),
    EMPTY_SNAPSHOT,
  );

  apply(update: ResourceTimingUpdate): void {
    switch (update.kind) {
      case 'snapshot': {
        this.groups.set(Math.round(update.timeOriginMs), {
          timeOriginMs: update.timeOriginMs,
          entries: update.entries,
        });
        this.pub.markDirty();
        break;
      }
      case 'tab-cleared':
        this.clear();
        break;
    }
  }

  clear(): void {
    if (this.groups.size === 0) return;
    this.groups.clear();
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}
