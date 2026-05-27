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
 * The internal Map is NOT exported — every call site goes through the
 * typed mutator/reader API below so the store stays the single owner
 * of the data invariants.
 */

import type { ObservationSource, TrackedResource, TrackedResourceType } from '@openheaders/core/types';

const tabsWithActiveRules: Map<number, Map<string, TrackedResource>> = new Map();

// ── Readers ──────────────────────────────────────────────────────

/**
 * Read the tracked-resource map for a single tab. Returns `undefined`
 * if the tab has no entries — callers must null-check rather than
 * receiving an empty Map.
 */
export function getTrackedResourceMap(tabId: number): Map<string, TrackedResource> | undefined {
  return tabsWithActiveRules.get(tabId);
}

export function hasTrackedTab(tabId: number): boolean {
  return tabsWithActiveRules.has(tabId);
}

export function hasTrackedResource(tabId: number, url: string): boolean {
  return tabsWithActiveRules.get(tabId)?.has(url) ?? false;
}

export function getTrackedTabCount(): number {
  return tabsWithActiveRules.size;
}

/**
 * Live iterator over the internal Map. Mutation during iteration is
 * unsafe — callers that mutate (e.g. revalidation) MUST materialize
 * the keys before iterating.
 */
export function iterateTrackedEntries(): IterableIterator<[number, Map<string, TrackedResource>]> {
  return tabsWithActiveRules.entries();
}

/**
 * Immutable, deeply-frozen snapshot. Use this when handing tracked
 * state to code that should never mutate it (test assertions, future
 * read-only consumers).
 */
export function snapshotTrackedTabs(): ReadonlyMap<number, ReadonlyMap<string, TrackedResource>> {
  const out = new Map<number, ReadonlyMap<string, TrackedResource>>();
  for (const [tabId, urlMap] of tabsWithActiveRules) {
    out.set(tabId, new Map(urlMap));
  }
  return out;
}

// ── Mutators ─────────────────────────────────────────────────────

/** Reset every tab's tracking state. Used on rule-flush and SW suspend. */
export function clearAllTracking(): void {
  tabsWithActiveRules.clear();
}

/** Drop a single tab. Returns true if anything was removed. */
export function dropTab(tabId: number): boolean {
  return tabsWithActiveRules.delete(tabId);
}

/**
 * Drop a single tracked URL from a tab. Cascades to a `dropTab` when
 * the URL was the tab's last entry. Returns true if anything was
 * removed.
 */
export function dropTrackedUrl(tabId: number, url: string): boolean {
  const urlMap = tabsWithActiveRules.get(tabId);
  if (!urlMap) return false;
  if (!urlMap.delete(url)) return false;
  if (urlMap.size === 0) tabsWithActiveRules.delete(tabId);
  return true;
}

/**
 * Replace the entire resource map for a tab. An empty `resources`
 * cascades to `dropTab` so the store never holds an empty inner Map.
 */
export function replaceTabResources(tabId: number, resources: Map<string, TrackedResource>): void {
  if (resources.size === 0) {
    tabsWithActiveRules.delete(tabId);
    return;
  }
  tabsWithActiveRules.set(tabId, resources);
}

/**
 * Move tracking from one tab id to another — used when chrome
 * replaces a tab (pre-render commit, navigation swap). No-op when
 * the source tab has no tracking. Returns true if a transfer
 * happened.
 */
export function transferTabTracking(fromTabId: number, toTabId: number): boolean {
  const urlMap = tabsWithActiveRules.get(fromTabId);
  if (!urlMap) return false;
  tabsWithActiveRules.set(toTabId, urlMap);
  tabsWithActiveRules.delete(fromTabId);
  return true;
}

/**
 * Merge a batch of previously-persisted resources into a tab's
 * tracked set. Existing URLs are preserved (fresh runtime data
 * wins); only previously-unseen URLs are inserted. Used by the
 * chrome.storage.session rehydration path on SW wake.
 */
export function mergeTrackedResources(tabId: number, entries: Iterable<[string, TrackedResource]>): void {
  let dest = tabsWithActiveRules.get(tabId);
  if (!dest) {
    dest = new Map();
    tabsWithActiveRules.set(tabId, dest);
  }
  for (const [url, res] of entries) {
    if (dest.has(url)) continue;
    dest.set(url, res);
  }
  if (dest.size === 0) tabsWithActiveRules.delete(tabId);
}

/**
 * Record or update a single resource for a tab. Pure state mutation:
 * no broadcasts, no persistence scheduling. The host-side
 * `addTrackedUrl` wraps this call with the chrome-coupled side
 * effects (`broadcast('trackedUrlsUpdated', ...)` and the debounced
 * session-storage flush).
 *
 * Returns `true` when the resource is newly inserted, `false` when
 * it merged into an existing record — the host uses this to decide
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
