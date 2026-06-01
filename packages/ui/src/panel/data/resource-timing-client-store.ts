/**
 * `ResourceTimingClientStore` — panel-side mirror of the latest Resource
 * Timing snapshot for the inspected tab, fed by `ResourceTimingUpdate`s
 * arriving on `oh-rt:<tabId>`.
 *
 * Sibling of `PageClientStore`, but simpler: the Resource Timing buffer
 * is cumulative, so a `snapshot` replaces the held entry list wholesale
 * (no per-entry reducer). Snapshot identity is structurally stable —
 * `getSnapshot()` returns the same reference until `apply()` / `clear()`
 * actually changes state, so `useSyncExternalStore` consumers short-
 * circuit re-renders on upstream noops.
 *
 * Single-tab; the relay partitions per tab. `clear()` is the only drop
 * verb, driven by `ready` (replay-on-reconnect) or a `tab-cleared`
 * update.
 */

import type { ResourceTimingEntry, ResourceTimingUpdate } from '@openheaders/core/resource-timing';

import { createSnapshotPublisher } from './snapshot-publisher';

export interface ResourceTimingClientSnapshot {
  /** Wall-clock ms of the document time origin, or `null` before any snapshot. */
  readonly timeOriginMs: number | null;
  /** Latest cumulative Resource Timing entries. Same identity until replaced. */
  readonly entries: readonly ResourceTimingEntry[];
}

const EMPTY_SNAPSHOT: ResourceTimingClientSnapshot = Object.freeze({
  timeOriginMs: null,
  entries: Object.freeze([]) as readonly ResourceTimingEntry[],
});

export class ResourceTimingClientStore {
  private timeOriginMs: number | null = EMPTY_SNAPSHOT.timeOriginMs;
  private entries: readonly ResourceTimingEntry[] = EMPTY_SNAPSHOT.entries;
  private readonly pub = createSnapshotPublisher<ResourceTimingClientSnapshot>(
    () => ({ timeOriginMs: this.timeOriginMs, entries: this.entries }),
    EMPTY_SNAPSHOT,
  );

  apply(update: ResourceTimingUpdate): void {
    switch (update.kind) {
      case 'snapshot':
        this.timeOriginMs = update.timeOriginMs;
        this.entries = update.entries;
        this.pub.markDirty();
        break;
      case 'tab-cleared':
        this.clear();
        break;
    }
  }

  clear(): void {
    if (this.timeOriginMs === null && this.entries.length === 0) return;
    this.timeOriginMs = null;
    this.entries = [];
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}
