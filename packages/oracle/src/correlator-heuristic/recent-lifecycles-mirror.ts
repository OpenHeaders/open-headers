/**
 * Local "what we've emitted so far" mirror for the heuristic correlator,
 * partitioned by `tabId` so `forgetTab` is a single `.delete(tabId)`
 * and the cleanup never has to know how `(tabId, requestId)` would be
 * string-encoded. Matches the per-tab shape of every other mirror in
 * this directory (`InFlightFifo`, `BodyJoinMap`, `HarWaitingBuffer`,
 * `FinalizedRetention`, `CorsContextStore`, `HopCursor`).
 *
 * Pure data, no policy: no LRU, no caps, no eviction logger. Bounded
 * implicitly by the H7 backward-retention sweep (correlator's
 * `gcLateArrival` calls `forget` on each expired key) and by
 * `forgetTab` on tab detach.
 */
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';

export class RecentLifecyclesMirror {
  private readonly tabs = new Map<number, Map<string, RequestLifecycle>>();

  /** Record the latest emitted lifecycle for this `(tabId, requestId)`. */
  set(tabId: number, requestId: string, lifecycle: RequestLifecycle): void {
    let tabMirror = this.tabs.get(tabId);
    if (tabMirror === undefined) {
      tabMirror = new Map();
      this.tabs.set(tabId, tabMirror);
    }
    tabMirror.set(requestId, lifecycle);
  }

  /** Has this lifecycle been emitted on this tab? */
  has(tabId: number, requestId: string): boolean {
    return this.tabs.get(tabId)?.has(requestId) ?? false;
  }

  /**
   * Resolve the `requestId` of the lifecycle on this tab whose `(url, method)`
   * match and whose `startedAtMs` is closest to `nearMs` — the join a
   * page-relayed capture (response/request override) needs, since the page
   * never knows the webRequest requestId. The relay carries the request's
   * start instant, which co-arrives with the lifecycle's `startedAtMs`; the
   * closest-start pick disambiguates same-`(url, method)` repeats. The mirror
   * snapshot is the request-start lifecycle (set once at `started`), so url
   * and method are the hop-0 values — exactly what a page wrapper relays.
   * Returns `undefined` when no lifecycle matches (the request aged out of
   * retention, or it never reached the network — a `mock`-source rule).
   */
  findByUrlMethod(tabId: number, url: string, method: string, nearMs: number): string | undefined {
    const tabMirror = this.tabs.get(tabId);
    if (tabMirror === undefined) return undefined;
    let best: string | undefined;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const [requestId, lifecycle] of tabMirror) {
      if (lifecycle.url !== url || lifecycle.method !== method) continue;
      const delta = Math.abs(lifecycle.startedAtMs - nearMs);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = requestId;
      }
    }
    return best;
  }

  /** Drop a specific `(tabId, requestId)`. Empties the tab partition if it becomes empty. */
  forget(tabId: number, requestId: string): void {
    const tabMirror = this.tabs.get(tabId);
    if (tabMirror === undefined) return;
    tabMirror.delete(requestId);
    if (tabMirror.size === 0) this.tabs.delete(tabId);
  }

  /** Drop every entry for a tab (invariant 2). */
  forgetTab(tabId: number): void {
    this.tabs.delete(tabId);
  }

  /** Drop everything — used by `dispose`. */
  clear(): void {
    this.tabs.clear();
  }

  /** Total entries across all tabs — test helper. */
  size(): number {
    let total = 0;
    for (const tabMirror of this.tabs.values()) total += tabMirror.size;
    return total;
  }
}
