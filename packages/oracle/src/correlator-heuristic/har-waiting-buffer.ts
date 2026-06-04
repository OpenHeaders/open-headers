/**
 * Forward-race buffer for the H7 late-arrival pair.
 *
 * When a HAR entry arrives before its matching `onBeforeRequest`, the
 * in-flight FIFO has no slot to pop — without buffering, the entry is
 * silently dropped and the lifecycle never gets its HAR attachment.
 * This buffer holds those orphaned HAR entries per-tab, lets the
 * correlator retry the join when a new in-flight slot is recorded, and
 * drops entries whose own `startedDateTime` has fallen past
 * `HAR_FORWARD_HOLD_MS` from the GC clock.
 *
 * Body events are exempt from invariant 8's ordering guarantee (HAR
 * body delivery is async by design) and are not held here.
 */

import type { InspectorHarEntry } from '@openheaders/core/types';

import { HAR_FORWARD_HOLD_MS, MAX_HAR_WAITING_PER_TAB } from './late-arrival-constants';

interface HeldEntry {
  readonly entry: InspectorHarEntry;
  /** Wall-clock ms at which this entry was held (parsed from `startedDateTime`). */
  readonly heldAtMs: number;
}

/** Optional drop hook — fires when a held entry is removed without ever attaching. */
export type HarWaitingDropLogger = (info: {
  readonly tabId: number;
  readonly reason: 'expired' | 'lru' | 'tab-forgotten';
  readonly entry: InspectorHarEntry;
}) => void;

/**
 * Resolved retry outcome — the join target that minted the match.
 * Mirrors {@link InFlightMatch}; defined locally to keep this module's
 * import surface narrow.
 */
export interface HarRetryMatch {
  readonly requestId: string;
  readonly hopIndex: number;
}

/**
 * Retry hook the correlator passes to {@link HarWaitingBuffer.drain}.
 * Returns the matched `{ requestId, hopIndex }` (caller will emit
 * `har-attached`) or `undefined` to leave the entry buffered.
 */
export type HarRetry = (entry: InspectorHarEntry) => HarRetryMatch | undefined;

/**
 * Outcome of a successful drain pass — the buffer hands each matched
 * entry + its resolved join target back so the correlator can emit.
 */
export interface HarDrainResult {
  readonly entry: InspectorHarEntry;
  readonly requestId: string;
  readonly hopIndex: number;
}

export class HarWaitingBuffer {
  /** `tabId → insertion-ordered queue of held entries`. */
  private readonly perTab = new Map<number, HeldEntry[]>();
  private readonly onDrop: HarWaitingDropLogger | undefined;

  constructor(options?: { readonly onDrop?: HarWaitingDropLogger }) {
    this.onDrop = options?.onDrop;
  }

  /**
   * Hold a HAR entry that failed in-flight matching. `heldAtMs` is the
   * entry's own `startedDateTime` parsed to wall-clock ms — this is the
   * reference for window expiry, not "now". An entry held at t=0 with
   * a current GC tick at t=6000 is past-window regardless of how
   * recently it was deposited here.
   */
  hold(tabId: number, entry: InspectorHarEntry, heldAtMs: number): void {
    let queue = this.perTab.get(tabId);
    if (!queue) {
      queue = [];
      this.perTab.set(tabId, queue);
    }
    queue.push({ entry, heldAtMs });
    while (queue.length > MAX_HAR_WAITING_PER_TAB) {
      const evicted = queue.shift();
      if (evicted && this.onDrop) {
        this.onDrop({ tabId, reason: 'lru', entry: evicted.entry });
      }
    }
  }

  /**
   * Try to attach every held entry for `tabId` via `retry`. Each entry
   * that produces a `requestId` is removed and returned to the caller.
   * Entries that still don't match stay queued for the next drain or
   * gc pass.
   *
   * Order preserved (insertion order) — important when two entries
   * race for the same in-flight slot the closest-timestamp ordering
   * inside `InFlightFifo` already handles fairness.
   */
  drain(tabId: number, retry: HarRetry): HarDrainResult[] {
    const queue = this.perTab.get(tabId);
    if (!queue || queue.length === 0) return [];
    const matched: HarDrainResult[] = [];
    for (let i = queue.length - 1; i >= 0; i--) {
      const hit = retry(queue[i].entry);
      if (hit === undefined) continue;
      matched.push({ entry: queue[i].entry, requestId: hit.requestId, hopIndex: hit.hopIndex });
      queue.splice(i, 1);
    }
    if (queue.length === 0) this.perTab.delete(tabId);
    // Restore caller-visible insertion order — we walked backward to
    // splice safely, so reverse the matches before returning.
    return matched.reverse();
  }

  /**
   * Drop entries whose `heldAtMs` is more than `HAR_FORWARD_HOLD_MS`
   * behind `nowMs`. Called from the correlator on each event tick.
   */
  gc(nowMs: number): void {
    const cutoff = nowMs - HAR_FORWARD_HOLD_MS;
    for (const [tabId, queue] of this.perTab) {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].heldAtMs < cutoff) {
          const [evicted] = queue.splice(i, 1);
          if (this.onDrop) this.onDrop({ tabId, reason: 'expired', entry: evicted.entry });
        }
      }
      if (queue.length === 0) this.perTab.delete(tabId);
    }
  }

  /** Drop all held entries for a tab (invariant 2 — lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    const queue = this.perTab.get(tabId);
    if (!queue) return;
    if (this.onDrop) {
      for (const held of queue) this.onDrop({ tabId, reason: 'tab-forgotten', entry: held.entry });
    }
    this.perTab.delete(tabId);
  }

  /** Total held entries across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const q of this.perTab.values()) n += q.length;
    return n;
  }
}
