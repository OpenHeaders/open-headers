/**
 * Correlation seam (`@openheaders/core/request-lifecycle`).
 *
 * Two strategies satisfy this interface:
 *
 *  - **Heuristic correlator** (ships): owns `chrome.webRequest.*`
 *    subscriptions + HAR closest-timestamp join + CORS classification.
 *    Lives in the extension SW. Sole `chrome.webRequest.*` subscriber
 *    in the entire extension (invariant 7).
 *
 *  - **CDP correlator** (typechecks + unit-tests, never ships): owns a
 *    mocked CDP event source. Exists to enforce that the interface is
 *    real — if both implementations can't satisfy the contract, the
 *    contract is wrong. Throws on real-Chrome instantiation.
 *
 * Both emit a totally-ordered stream of `RequestLifecycleUpdate` per
 * `(tabId, requestId)` (invariant 8). The heuristic uses a per-key
 * in-window buffer (`LATE_ARRIVAL_WINDOW_MS`) to reconcile out-of-order
 * source events; HAR body attachment is exempt from the ordering
 * invariant because body delivery is async by design.
 */

import type { RequestLifecycleUpdate } from './types';

/** Returned by `subscribe` — call to remove the listener. */
export type Unsubscribe = () => void;

/** Listener invoked once per emitted update. */
export type RequestLifecycleListener = (update: RequestLifecycleUpdate) => void;

export interface RequestCorrelator {
  /**
   * Begin observation for a tab. Idempotent — calling twice for the
   * same `tabId` is a no-op. The correlator decides internally how to
   * wire its event source; callers do not pass listeners through here.
   */
  attachTab(tabId: number): void;

  /**
   * Stop observation. Flushes any buffered late updates that are still
   * inside the late-arrival window; updates that arrive after detach
   * are dropped with a `warn` log.
   */
  detachTab(tabId: number): void;

  /**
   * Subscribe to ordered lifecycle updates across all attached tabs.
   * Multiple subscribers receive every update; in production the
   * lifecycle host attaches the store as the sole consumer here, and
   * downstream consumers (panel forwarder, tab-telemetry projection,
   * rule-engine driver) subscribe to the store instead. The seam stays
   * multi-subscriber so tests and future consumers can opt into
   * correlator-level ordering without store reduction.
   *
   * The returned function removes the listener. Subscribers are
   * notified synchronously in subscription order.
   */
  subscribe(listener: RequestLifecycleListener): Unsubscribe;
}
