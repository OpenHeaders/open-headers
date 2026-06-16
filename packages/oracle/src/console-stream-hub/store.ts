/**
 * `ConsoleStore` — per-tab bounded append log for captured console entries.
 *
 * Pure data. The hub owns one; every captured entry appends and broadcasts —
 * console output has no identity to dedup on (unlike `RuleFireStore`), so this
 * is a plain ordered log, not a keyed merge.
 *
 * Cap: `MAX_CONSOLE_ENTRIES_PER_TAB` per tab, oldest-evicted on overflow —
 * replay then sees a bounded window, which is the entire reason this lives
 * engine-side instead of in the consumer. The store is authoritative; a
 * cross-process reconnect replays from `snapshotTab`, never from a
 * transport-layer buffer.
 */

import type { ConsoleEntry } from '@openheaders/core/console-stream';

/** Per-tab replay cap. Sized for "DevTools session length" not "all-time" —
 *  the consumer keeps its own larger display window if it wants more. Mirrors
 *  the rule-fire hub's per-tab cap. */
export const MAX_CONSOLE_ENTRIES_PER_TAB = 1_000;

export class ConsoleStore {
  /** Per-tab log, oldest first. */
  private readonly tabs = new Map<number, ConsoleEntry[]>();

  /** Append an entry; evict the oldest once past the cap. */
  append(tabId: number, entry: ConsoleEntry): void {
    let log = this.tabs.get(tabId);
    if (log === undefined) {
      log = [];
      this.tabs.set(tabId, log);
    }
    log.push(entry);
    if (log.length > MAX_CONSOLE_ENTRIES_PER_TAB) log.shift();
  }

  /** Drop a tab's log. Returns `true` when state existed (hub uses this to
   *  gate the `tab-cleared` broadcast). */
  forgetTab(tabId: number): boolean {
    return this.tabs.delete(tabId);
  }

  /** Read-only ordered snapshot (oldest first) — used for replay. */
  snapshotTab(tabId: number): readonly ConsoleEntry[] {
    return this.tabs.get(tabId) ?? EMPTY;
  }
}

const EMPTY: readonly ConsoleEntry[] = Object.freeze([]) as readonly ConsoleEntry[];
