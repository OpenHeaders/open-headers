/**
 * `PageClientStore` — panel-side per-tab page list fed by
 * `PageWireMessage`s arriving on `oh-page:<tabId>`.
 *
 * Single-tab; the port host already partitions per tab. Snapshot
 * shape is structurally stable: `getSnapshot()` returns the same
 * reference until `apply()` or `clear()` actually mutates state, so
 * `useSyncExternalStore` consumers short-circuit re-renders on
 * upstream noops.
 *
 * Differences from the hub on purpose:
 *   - No id minting. The hub assigns `page_N` ids; the client
 *     trust-but-applies.
 *   - No `forgetTab`. Single-tab; `clear()` is the only drop verb,
 *     driven by `ready` (replay-on-reconnect) or panel UI action.
 */

import type { Page, PageStreamUpdate } from '@openheaders/core/page-stream';

import { NOOP, reducePageUpdate } from './page-client-reducer';

export interface PageClientSnapshot {
  /** Insertion-ordered. Same identity until a real mutation happens. */
  readonly pages: readonly Page[];
}

const EMPTY_SNAPSHOT: PageClientSnapshot = Object.freeze({
  pages: Object.freeze([]) as readonly Page[],
});

export class PageClientStore {
  private pages: readonly Page[] = EMPTY_SNAPSHOT.pages;
  private snapshotCache: PageClientSnapshot = EMPTY_SNAPSHOT;
  private snapshotDirty = false;
  private readonly listeners = new Set<() => void>();

  apply(update: PageStreamUpdate): void {
    const next = reducePageUpdate(this.pages, update);
    if (next === NOOP) return;
    this.pages = next;
    this.snapshotDirty = true;
    this.notify();
  }

  clear(): void {
    if (this.pages.length === 0) return;
    this.pages = [];
    this.snapshotDirty = true;
    this.notify();
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): PageClientSnapshot => {
    if (this.snapshotDirty) {
      this.snapshotCache = { pages: this.pages };
      this.snapshotDirty = false;
    }
    return this.snapshotCache;
  };

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
