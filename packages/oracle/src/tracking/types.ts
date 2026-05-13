import type { TrackedResourceType } from '@openheaders/core/types';

/**
 * Source attributing a single tracked-resource observation. Multiple
 * sources may co-attribute the same URL on a single tab — the set is
 * union-merged on each new observation.
 *
 *   `webRequest`   — Chrome's `webRequest.onBeforeRequest`. The most
 *                    authoritative signal: the network actually went
 *                    out and DNR/webRequest had a chance to modify it.
 *   `perfObserver` — Resource Timing entries observed by the in-page
 *                    perf-observer content script. Catches cached + SW-
 *                    shortcutted responses that webRequest misses.
 *   `dnrFeedback`  — `declarativeNetRequest.onRuleMatchedDebug` (optional
 *                    surface, only wired in packaged builds for now).
 */
export type ObservationSource = 'webRequest' | 'perfObserver' | 'dnrFeedback';

/**
 * Tracked resource stored per-tab — URL + metadata. Provenance is
 * tracked as a set because a single URL can be observed through
 * multiple signals (a network-fresh request fires webRequest AND
 * surfaces in the page's Resource Timing list on reload).
 */
export interface TrackedResource {
  /** Wall-clock ms at first observation. Stable across re-observations. */
  firstSeenTs: number;
  /** Wall-clock ms at most-recent observation. Updated on every sighting. */
  lastSeenTs: number;
  /** Back-compat alias for lastSeenTs — retained so existing tests pass. */
  timestamp: number;
  resourceType: TrackedResourceType;
  /** Non-empty set — every source that has seen this URL. */
  sources: Set<ObservationSource>;
  /**
   * True when the response was served from the renderer's memory cache
   * or HTTP cache without a fresh network round-trip. Drives the
   * "silent" verdict in the popup.
   */
  servedFromCache?: boolean;
}
