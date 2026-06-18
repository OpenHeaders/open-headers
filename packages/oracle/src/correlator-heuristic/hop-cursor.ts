/**
 * Per-`(tabId, requestId)` redirect-hop cursor used by H8/H9.
 *
 * A lifecycle's `redirectHopCount` at HAR-attach time does **not**
 * identify which hop the HAR belongs to — HAR arrives ~500ms behind, by
 * which time the lifecycle may already have advanced one or two more
 * hops. The hop-index a HAR needs is therefore stamped at the moment
 * the matching URL is *recorded* into {@link InFlightFifo}, not when
 * the HAR is consumed.
 *
 * This cursor tracks the bridging state between an `onBeforeRedirect`
 * (when we know the next hop's URL but not yet its outgoing method —
 * 303 redirects rewrite POST→GET) and the following `onSendHeaders`
 * (when the outgoing method is known and the new hop's FIFO record can
 * be inserted with the correct hop index).
 *
 * Posture matches the rest of the heuristic correlator's per-tab maps:
 * partitioned by tab, cleared by `forgetTab`, individual entries
 * `forget`-able when their lifecycle reaches a terminal phase.
 *
 * Bounded membership: capped per tab, oldest-entry eviction via Map
 * insertion order on overflow. Optional drop logger mirrors
 * {@link FifoEvictionLogger} / {@link HarWaitingDropLogger} shapes for
 * eventual telemetry parity.
 */

import { MAX_HOP_CURSORS_PER_TAB } from './hop-cursor-constants';

interface HopCursorEntry {
  /**
   * Current hop index for the lifecycle. `0` at `started`; bumps by 1
   * on every `onBeforeRedirect`.
   */
  hopIndex: number;
  /**
   * Method captured at `onBeforeRequest` (hop 0). On a redirect, the
   * next hop's method may differ (303 rewrites to GET); the cursor
   * keeps the *current* method so a stale value never leaks into the
   * FIFO record at `onSendHeaders` time.
   */
  method: string;
  /**
   * `true` between `onBeforeRedirect` and the matching `onBeforeRequest`:
   * the new hop's index is known but its FIFO record is still owed.
   * `false` otherwise.
   */
  pendingRecord: boolean;
  /**
   * The current hop's URL, captured at `onBeforeRequest`. A declarativeNetRequest
   * `redirect`/`query-param` rule rewrites the URL in place — webRequest fires
   * NO `onBeforeRedirect`, it just reports a different URL at `onSendHeaders`
   * than at `onBeforeRequest`. The correlator compares `onSendHeaders`' URL
   * against this to detect that rewrite and synthesize the internal-redirect
   * hop (see {@link currentUrl}).
   */
  url: string;
}

/** Optional drop hook — fires when an entry is evicted by the per-tab cap. */
export type HopCursorDropReason = 'lru' | 'tab-forgotten';

export type HopCursorDropLogger = (info: {
  readonly tabId: number;
  readonly requestId: string;
  readonly reason: HopCursorDropReason;
}) => void;

export class HopCursor {
  private readonly perTab = new Map<number, Map<string, HopCursorEntry>>();
  private readonly onDrop: HopCursorDropLogger | undefined;

  constructor(options?: { readonly onDrop?: HopCursorDropLogger }) {
    this.onDrop = options?.onDrop;
  }

  /**
   * Begin tracking a fresh lifecycle at hop 0. The FIFO record for
   * hop 0 happens inline in the correlator's `onBeforeRequest` handler
   * — `pendingRecord` is therefore `false` here.
   */
  start(tabId: number, requestId: string, method: string, url = ''): void {
    const tabMap = this.ensureTab(tabId);
    // Insertion-order LRU touch: delete-and-reinsert on restart so the
    // cursor sits at the tail (matches `InFlightFifo` posture). A
    // duplicate `start` is a correlator-side bug, but normalising the
    // order keeps the bounded buffer honest.
    if (tabMap.has(requestId)) tabMap.delete(requestId);
    tabMap.set(requestId, { hopIndex: 0, method, pendingRecord: false, url });
    this.evictIfOver(tabId, tabMap);
  }

  /**
   * Record that an `onBeforeRedirect` fired (a server redirect, OR the
   * synthetic one the correlator emits for a DNR in-place rewrite). The hop
   * index increments eagerly so subsequent reads see the new hop; the FIFO
   * record is deferred to `consumePendingRecord` at the next hop-bearing
   * event (the target's `onBeforeRequest` for a server redirect, or the
   * rewriting `onSendHeaders` for a DNR rewrite).
   *
   * No-op if the cursor was never started (defensive — a redirect
   * event for an unattached lifecycle should never reach here, but the
   * absence of cursor state is not load-bearing).
   */
  noteRedirect(tabId: number, requestId: string): void {
    const entry = this.perTab.get(tabId)?.get(requestId);
    if (!entry) return;
    entry.hopIndex += 1;
    entry.pendingRecord = true;
  }

  /**
   * The current hop's URL (as last recorded at `onBeforeRequest` /
   * `onSendHeaders`), or `undefined` if untracked. The correlator compares
   * `onSendHeaders`' URL against this to spot a DNR in-place rewrite (no
   * `onBeforeRedirect`, URL changed) and synthesize the redirect hop.
   */
  currentUrl(tabId: number, requestId: string): string | undefined {
    return this.perTab.get(tabId)?.get(requestId)?.url;
  }

  /**
   * Consume the pending hop record at the hop-bearing event after an
   * `onBeforeRedirect`. Returns the new hop's `{ hopIndex, method }` so the
   * correlator can record it into {@link InFlightFifo}, updating the stored
   * method + URL to what's actually being sent (303 rewrites POST→GET; a DNR
   * rewrite changes the URL). Returns `undefined` if no redirect is pending —
   * a fresh hop's event has nothing owed.
   */
  consumePendingRecord(
    tabId: number,
    requestId: string,
    method: string,
    url?: string,
  ): { hopIndex: number; method: string } | undefined {
    const entry = this.perTab.get(tabId)?.get(requestId);
    if (!entry?.pendingRecord) return undefined;
    entry.method = method;
    if (url !== undefined) entry.url = url;
    entry.pendingRecord = false;
    return { hopIndex: entry.hopIndex, method };
  }

  /** Drop a single lifecycle's cursor — terminal phase or explicit clean-up. */
  forget(tabId: number, requestId: string): void {
    const tabMap = this.perTab.get(tabId);
    if (!tabMap) return;
    tabMap.delete(requestId);
    if (tabMap.size === 0) this.perTab.delete(tabId);
  }

  /** Drop all cursors for a tab (invariant 2 — lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    const tabMap = this.perTab.get(tabId);
    if (!tabMap) return;
    if (this.onDrop) {
      for (const requestId of tabMap.keys()) {
        this.onDrop({ tabId, requestId, reason: 'tab-forgotten' });
      }
    }
    this.perTab.delete(tabId);
  }

  /** Total tracked cursors across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  /** Read current hop index without mutation — test / inspection helper. */
  currentHopIndex(tabId: number, requestId: string): number | undefined {
    return this.perTab.get(tabId)?.get(requestId)?.hopIndex;
  }

  private ensureTab(tabId: number): Map<string, HopCursorEntry> {
    let tabMap = this.perTab.get(tabId);
    if (!tabMap) {
      tabMap = new Map();
      this.perTab.set(tabId, tabMap);
    }
    return tabMap;
  }

  private evictIfOver(tabId: number, tabMap: Map<string, HopCursorEntry>): void {
    while (tabMap.size > MAX_HOP_CURSORS_PER_TAB) {
      const oldest = tabMap.keys().next().value;
      if (oldest === undefined) break;
      tabMap.delete(oldest);
      if (this.onDrop) this.onDrop({ tabId, requestId: oldest, reason: 'lru' });
    }
  }
}
