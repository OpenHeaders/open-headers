/**
 * Backward-retention bookkeeping for the H7 late-arrival pair.
 *
 * The correlator's `recentLifecycles` mirror is consulted on every
 * `har-attached` emission so we never mint an attachment for a
 * lifecycle that no longer exists (invariant 1). Without H7, that
 * mirror only shrinks on `detachTab` / `dispose` — every finalized
 * request stays in memory until tab close, an unbounded silent leak.
 *
 * This module tracks the terminal-phase timestamp for each `(tabId,
 * requestId)` and surfaces the keys that have aged past
 * `FINALIZED_RETENTION_MS`. The correlator deletes the corresponding
 * `recentLifecycles` entry on each event tick. Lazy gc, no timers —
 * deterministic under fake clocks and SW-suspend-safe.
 */

import { lifecycleKey } from '@openheaders/core/request-lifecycle';

import { FINALIZED_RETENTION_MS } from './late-arrival-constants';

interface RetentionEntry {
  readonly tabId: number;
  readonly requestId: string;
  readonly finalizedAtMs: number;
}

export class FinalizedRetention {
  /** Insertion-ordered: oldest finalizations gc-evict first. */
  private readonly entries = new Map<string, RetentionEntry>();

  /**
   * Record a terminal-phase emission. Re-marking the same key (e.g.
   * the same lifecycle terminating twice in test scaffolding) refreshes
   * the timestamp to the latest value — the longest window wins,
   * matching invariant 5's monotonic-information posture.
   */
  markFinalized(tabId: number, requestId: string, finalizedAtMs: number): void {
    const key = lifecycleKey(tabId, requestId);
    if (this.entries.has(key)) this.entries.delete(key);
    this.entries.set(key, { tabId, requestId, finalizedAtMs });
  }

  /**
   * Return — and remove — every entry whose `finalizedAtMs` is more
   * than `FINALIZED_RETENTION_MS` behind `nowMs`. Callers iterate the
   * result to delete the matching keys from their own caches.
   *
   * Iteration leverages insertion order: once we find an entry within
   * the window, every subsequent entry is also within (timestamps
   * monotonically increase in steady-state). The early exit keeps gc
   * cheap on long-running tabs.
   */
  gcExpired(nowMs: number): Array<{ tabId: number; requestId: string }> {
    const cutoff = nowMs - FINALIZED_RETENTION_MS;
    const expired: Array<{ tabId: number; requestId: string }> = [];
    for (const [key, entry] of this.entries) {
      if (entry.finalizedAtMs >= cutoff) break;
      expired.push({ tabId: entry.tabId, requestId: entry.requestId });
      this.entries.delete(key);
    }
    return expired;
  }

  /** Drop retention for every request on a tab (invariant 2). */
  forgetTab(tabId: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.tabId === tabId) this.entries.delete(key);
    }
  }

  /** Drop a specific `(tabId, requestId)` — used when its lifecycle is forced out. */
  forget(tabId: number, requestId: string): void {
    this.entries.delete(lifecycleKey(tabId, requestId));
  }

  /** Total retained entries across all tabs — test helper. */
  size(): number {
    return this.entries.size;
  }
}
