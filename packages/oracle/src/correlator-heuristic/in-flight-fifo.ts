/**
 * Per-URL FIFO of in-flight webRequest observations awaiting their HAR
 * row. State is partitioned per tab in an `InFlightFifo` instance; the
 * correlator pops the closest-timestamp match per `(tabId, url, method)`
 * at HAR-arrival time.
 *
 * Sweep order, LRU eviction policy, and closest-timestamp + method-
 * gated matching are documented inline below — they explain *why* this
 * exact shape (rather than head-pop) is correct.
 */

/**
 * Max age for an in-flight `(requestId, t)` entry before we drop it as
 * stale.
 */
export const IN_FLIGHT_MAX_AGE_MS = 60_000;

/**
 * Tolerated skew between an in-flight entry's `t` (webRequest
 * `onBeforeRequest` timestamp) and the HAR's `startedDateTime` for the
 * SAME request. These are NOT the same clock under load: when the SW is
 * saturated, webRequest event timestamps lag the request's true start by
 * seconds (measured ~10s on a throttled 155-request page, near-constant
 * across the burst). The match window therefore equals the entry-
 * lifetime window {@link IN_FLIGHT_MAX_AGE_MS} and is applied
 * symmetrically: timestamp proximity only DISAMBIGUATES multiple
 * same-`(url, method)` candidates (they share the same skew, so the
 * closest is still the right one); it must never reject the *sole*
 * candidate over skew, which would drop the HAR entirely.
 */

/**
 * LRU cap on the in-flight URL map *per tab*. Each entry holds the FIFO
 * of pending `(requestId, t)` pairs awaiting their HAR row. URLs that
 * produce a HAR are popped to empty and removed; URLs that never do
 * (cancelled, served from bfcache, blocked before flight) sit here
 * until evicted. The cap bounds total memory at roughly
 * `MAX_IN_FLIGHT_URLS_PER_TAB * (URL string + a tiny queue) ≈ a couple
 * hundred KB` per tab even on pathologically noisy pages. The LRU keeps
 * freshly-active URLs.
 */
export const MAX_IN_FLIGHT_URLS_PER_TAB = 5_000;

interface InFlightEntry {
  requestId: string;
  /**
   * webRequest `Date.now()` at onBeforeRequest. Used to weed out stale
   * entries whose corresponding HAR never showed up (cancelled, served
   * from bfcache).
   */
  t: number;
  /**
   * HTTP method — disambiguates a cross-origin POST from its
   * internally-generated preflight OPTIONS, which share a URL but
   * arrive in opposite orders on the webRequest side (POST first) vs
   * the HAR side (OPTIONS first). Without this, the FIFO swaps
   * requestIds between the two.
   */
  method: string;
  /**
   * Redirect-hop index stamped at record time (H8/H9). Hop 0 is the
   * lifecycle's original request; hop N is the request after the Nth
   * redirect. The HAR for hop N matches by URL/timestamp/method and
   * inherits this index — reading `redirectHopCount` from the
   * lifecycle at HAR-attach time would race because HAR arrives
   * after webRequest has already moved on.
   */
  hopIndex: number;
}

/** Resolved join target for a popped FIFO entry — `{ requestId, hopIndex }`. */
export interface InFlightMatch {
  readonly requestId: string;
  readonly hopIndex: number;
}

/** Optional eviction hook — fires when a non-empty queue is dropped by the LRU cap. */
export type FifoEvictionLogger = (info: {
  readonly tabId: number;
  readonly url: string;
  readonly pendingCount: number;
}) => void;

export class InFlightFifo {
  /** `tabId → (url → queue of in-flight entries)`. */
  private readonly perTab = new Map<number, Map<string, InFlightEntry[]>>();
  private readonly onEviction: FifoEvictionLogger | undefined;

  constructor(options?: { readonly onEviction?: FifoEvictionLogger }) {
    this.onEviction = options?.onEviction;
  }

  /**
   * Record a webRequest `onBeforeRequest` observation. Sweeps stale
   * FIFO entries first, *before* moving the URL to the LRU tail — so
   * the iteration position reflects actual live in-flight requests
   * rather than a queue of long-cancelled ones still tying up the
   * slot. webRequest sometimes reports requests that never produce a
   * HAR entry (cancelled, BFCache restore, Chrome internal redirects);
   * without this sweep, stale heads would poison the FIFO and the next
   * HAR hit on the same URL would mis-attribute.
   */
  record(
    tabId: number,
    url: string,
    requestId: string,
    t: number,
    method: string,
    hopIndex: number,
  ): void {
    const tabMap = this.ensureTab(tabId);
    let queue = tabMap.get(url);
    if (queue) {
      const cutoff = t - IN_FLIGHT_MAX_AGE_MS;
      while (queue.length > 0 && queue[0].t < cutoff) queue.shift();
      // Touch-to-end via delete + re-set. JS Maps preserve insertion
      // order; re-inserting an existing key is the standard LRU idiom.
      tabMap.delete(url);
    } else {
      queue = [];
    }
    tabMap.set(url, queue);
    queue.push({ requestId, t, method, hopIndex });
    // Bound the per-tab URL count. URLs that never produce a HAR entry
    // stay in the map until evicted here; the iteration-order eviction
    // drops the least-recently-touched URL first. Eviction is silent in
    // the happy path (the queue we drop is empty or holds a long-
    // cancelled request) but the eviction hook can log it — any
    // non-empty eviction means we lost a join key for that request.
    while (tabMap.size > MAX_IN_FLIGHT_URLS_PER_TAB) {
      const oldest = tabMap.keys().next().value;
      if (oldest === undefined) break;
      const evictedQueue = tabMap.get(oldest);
      tabMap.delete(oldest);
      if (evictedQueue && evictedQueue.length > 0 && this.onEviction) {
        this.onEviction({ tabId, url: oldest, pendingCount: evictedQueue.length });
      }
    }
  }

  /**
   * Find and consume the `requestId` whose `(url, method)` matches and
   * whose `t` is closest to `harTimestamp`. Returns `undefined` when
   * no candidate fits — the caller drops the HAR (see D1 in the H2/H3
   * design discussion: no URL+window fallback in oracle).
   *
   * Closest-timestamp match (with method gating). The queue's `t` is
   * when `onBeforeRequest` fired in this process; HAR's
   * `startedDateTime` is what Chrome stamped at the same point for the
   * same request. They co-arrive tightly per request, so the entry
   * whose `t` is closest to `harTimestamp` (within tolerance) is the
   * correct match — robust to:
   *
   *   - Out-of-order HAR delivery (e.g. two redirects to the same
   *     target URL; FIFO head-pop would pair them with the wrong queue
   *     entries when the later HAR arrives first).
   *   - Preflight-bearing POSTs (handled via the method gate, which
   *     also constrains the candidate pool before timestamp matching).
   *
   * The candidate window is symmetric at `IN_FLIGHT_MAX_AGE_MS` around
   * `harTimestamp` so webRequest↔HAR processing skew (seconds under load)
   * never rejects an otherwise-valid match; the closest-timestamp pick
   * still resolves genuine same-URL collisions within that window.
   */
  popMatching(
    tabId: number,
    url: string,
    harTimestamp: number,
    harMethod: string,
  ): InFlightMatch | undefined {
    const tabMap = this.perTab.get(tabId);
    if (!tabMap) return undefined;
    const queue = tabMap.get(url);
    if (!queue || queue.length === 0) return undefined;
    // Sweep entries that are too stale to belong to any future HAR.
    const lower = harTimestamp - IN_FLIGHT_MAX_AGE_MS;
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i].t < lower) queue.splice(i, 1);
    }
    if (queue.length === 0) {
      tabMap.delete(url);
      return undefined;
    }
    const upper = harTimestamp + IN_FLIGHT_MAX_AGE_MS;
    let bestIdx = -1;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      if (harMethod && entry.method !== harMethod) continue;
      if (entry.t > upper) continue;
      const delta = Math.abs(entry.t - harTimestamp);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) return undefined;
    const matched = queue[bestIdx];
    queue.splice(bestIdx, 1);
    if (queue.length === 0) tabMap.delete(url);
    return { requestId: matched.requestId, hopIndex: matched.hopIndex };
  }

  /** Drop all in-flight state for a tab (invariant 2 — lifecycles die with the tab). */
  forgetTab(tabId: number): void {
    this.perTab.delete(tabId);
  }

  /**
   * Non-mutating explanation of why `popMatching` would (or would not)
   * find a candidate for `(tabId, url, harTimestamp, harMethod)`.
   * Diagnostic-only — run BEFORE `popMatching` (which sweeps stale
   * entries) to capture the pre-sweep picture. `nearestDeltaMs` is the
   * signed `entry.t - harTimestamp` of the closest method-matching entry
   * (negative = in-flight observation older than the HAR start, positive
   * = newer); the bucket counts say which gate each candidate fails.
   */
  diagnoseMatch(
    tabId: number,
    url: string,
    harTimestamp: number,
    harMethod: string,
  ): {
    pending: number;
    methodMismatch: number;
    tooOld: number;
    tooNew: number;
    nearestDeltaMs: number | null;
  } {
    const queue = this.perTab.get(tabId)?.get(url);
    if (!queue || queue.length === 0) {
      return { pending: 0, methodMismatch: 0, tooOld: 0, tooNew: 0, nearestDeltaMs: null };
    }
    const lower = harTimestamp - IN_FLIGHT_MAX_AGE_MS;
    const upper = harTimestamp + IN_FLIGHT_MAX_AGE_MS;
    let methodMismatch = 0;
    let tooOld = 0;
    let tooNew = 0;
    let nearestDeltaMs: number | null = null;
    for (const entry of queue) {
      if (harMethod && entry.method !== harMethod) {
        methodMismatch++;
        continue;
      }
      if (entry.t < lower) tooOld++;
      else if (entry.t > upper) tooNew++;
      const delta = entry.t - harTimestamp;
      if (nearestDeltaMs === null || Math.abs(delta) < Math.abs(nearestDeltaMs)) {
        nearestDeltaMs = delta;
      }
    }
    return { pending: queue.length, methodMismatch, tooOld, tooNew, nearestDeltaMs };
  }

  /** Total tracked URLs across all tabs — test helper. */
  size(): number {
    let n = 0;
    for (const m of this.perTab.values()) n += m.size;
    return n;
  }

  private ensureTab(tabId: number): Map<string, InFlightEntry[]> {
    let tabMap = this.perTab.get(tabId);
    if (!tabMap) {
      tabMap = new Map();
      this.perTab.set(tabId, tabMap);
    }
    return tabMap;
  }
}
