/**
 * Tab-tracking state mirror — the per-tab set of tracked resource URLs
 * accumulated from chrome.webRequest, the in-page perf-observer, and
 * (optionally) DNR feedback. Lives in oracle so the FE-thin-subscriber
 * invariant holds: any UI reading "which URLs has this tab seen" reads
 * through oracle's snapshot, not through the host's chrome bindings.
 *
 * What stays in the host app: the chrome.webRequest binding, the
 * chrome.storage.session persistence loop, the tab-listeners that
 * react to tab close/replace/navigate events, and the `broadcast`
 * fan-out call. Those are platform-specific and remain in
 * `apps/extension/src/background/modules/request-tracker.ts`.
 *
 * The Map is exported by identity so the host can keep its current
 * direct-mutation call sites (`tabsWithActiveRules.set(...)`,
 * `tabsWithActiveRules.delete(...)`); migration to method-only access
 * happens incrementally as the host shrinks.
 */

import type { TrackedResourceType } from '@openheaders/core/types';
import type { ObservationSource, TrackedResource } from './types';

/**
 * Map<tabId, Map<normalizedUrl, TrackedResource>> — per-tab attribution
 * of every URL the tab has touched that matched a rule.
 *
 * The host owns lifecycle (set/clear/delete on chrome.tabs events).
 * Oracle owns the data shape and the invariants — every entry exposes
 * the `TrackedResource` contract regardless of how the host populated
 * it.
 */
export const tabsWithActiveRules: Map<number, Map<string, TrackedResource>> = new Map();

/** Reset every tab's tracking state. Used by the host on rule-flush. */
export function clearAllTracking(): void {
  tabsWithActiveRules.clear();
}

/**
 * Read the tracked-resource map for a single tab. Returns `undefined`
 * if the tab has no entries — callers must null-check rather than
 * receiving an empty Map that would still report `.has(...) === false`
 * (this matches the historical pre-split semantics).
 */
export function getTrackedResourceMap(tabId: number): Map<string, TrackedResource> | undefined {
  return tabsWithActiveRules.get(tabId);
}

/** Number of tabs with at least one tracked resource. */
export function getTrackedTabCount(): number {
  return tabsWithActiveRules.size;
}

/**
 * Low-level setter — records or updates a single resource for a tab.
 * Pure state mutation: no broadcasts, no persistence scheduling. The
 * host-side `addTrackedUrl` wraps this call with the chrome-coupled
 * side effects (`broadcast('trackedUrlsUpdated', ...)` and the
 * debounced session-storage flush).
 *
 * Returns `true` when the resource is newly inserted, `false` when it
 * merged into an existing record — the host uses this to decide
 * whether to broadcast (re-observations don't broadcast).
 */
export function setTrackedResource(
  tabId: number,
  url: string,
  resourceType: TrackedResourceType,
  source: ObservationSource,
  servedFromCache: boolean,
): boolean {
  let urlMap = tabsWithActiveRules.get(tabId);
  if (!urlMap) {
    urlMap = new Map();
    tabsWithActiveRules.set(tabId, urlMap);
  }
  const now = Date.now();
  const existing = urlMap.get(url);
  if (existing) {
    existing.sources.add(source);
    existing.lastSeenTs = now;
    existing.timestamp = now;
    if (!servedFromCache) existing.servedFromCache = false;
    return false;
  }
  urlMap.set(url, {
    firstSeenTs: now,
    lastSeenTs: now,
    timestamp: now,
    resourceType,
    sources: new Set<ObservationSource>([source]),
    servedFromCache,
  });
  return true;
}
