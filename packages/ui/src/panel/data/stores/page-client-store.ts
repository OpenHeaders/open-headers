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
import { createSnapshotPublisher } from './snapshot-publisher';

export interface PageClientSnapshot {
  /** Insertion-ordered. Same identity until a real mutation happens. */
  readonly pages: readonly Page[];
}

/** Shared frozen empty snapshot — a surface with no page stream (the
 *  proxy capture view) feeds this to `usePanelData`. */
export const EMPTY_PAGE_SNAPSHOT: PageClientSnapshot = Object.freeze({
  pages: Object.freeze([]) as readonly Page[],
});
const EMPTY_SNAPSHOT = EMPTY_PAGE_SNAPSHOT;

export class PageClientStore {
  private pages: readonly Page[] = EMPTY_SNAPSHOT.pages;
  private readonly pub = createSnapshotPublisher<PageClientSnapshot>(() => ({ pages: this.pages }), EMPTY_SNAPSHOT);

  apply(update: PageStreamUpdate): void {
    const next = reducePageUpdate(this.pages, update);
    if (next === NOOP) return;
    this.pages = next;
    this.pub.markDirty();
  }

  clear(): void {
    if (this.pages.length === 0) return;
    this.pages = [];
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}
