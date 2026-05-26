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
