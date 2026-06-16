/**
 * `ConsoleClientStore` — panel-side append-only log of `ConsoleEntry`
 * records arriving on the engine-side `oh-console:<tabId>` port.
 *
 * Sibling of `PageClientStore` / `FireClientStore`, but simpler than both:
 * console output carries no identity and never merges — every captured
 * `console.*` call / uncaught exception is a distinct event — so this is a
 * plain ordered list with `append` + `clear`, no key map and no upsert.
 *
 * Bounded to the same per-tab window the engine console store holds, so the
 * client view stays aligned with what the engine retains: replay can never
 * exceed it, and live appends past the cap evict the oldest entry. (The bound
 * is duplicated here rather than imported — the UI can't reach the engine —
 * with the client trusting the engine to enforce its own copy.)
 *
 * Snapshot identity is structurally stable: `getSnapshot()` returns the same
 * reference until `append()` or `clear()` actually mutates state, so
 * `useSyncExternalStore` consumers short-circuit re-renders on upstream noops.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';

import { createSnapshotPublisher } from './snapshot-publisher';

/** Mirror of the engine console store's per-tab retention window. */
const MAX_ENTRIES = 1000;

export interface ConsoleClientSnapshot {
  /** Arrival-ordered. Same identity until a real mutation happens. */
  readonly entries: readonly ConsoleEntry[];
}

const EMPTY_SNAPSHOT: ConsoleClientSnapshot = Object.freeze({
  entries: Object.freeze([]) as readonly ConsoleEntry[],
});

export class ConsoleClientStore {
  private entries: ConsoleEntry[] = [];
  private readonly pub = createSnapshotPublisher<ConsoleClientSnapshot>(
    () => ({ entries: this.entries.slice() }),
    EMPTY_SNAPSHOT,
  );

  append(entry: ConsoleEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.shift();
    this.pub.markDirty();
  }

  clear(): void {
    if (this.entries.length === 0) return;
    this.entries = [];
    this.pub.markDirty();
  }

  readonly subscribe = this.pub.subscribe;
  readonly getSnapshot = this.pub.getSnapshot;
}
