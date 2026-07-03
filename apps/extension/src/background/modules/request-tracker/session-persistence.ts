/**
 * Session persistence for the tracked-resource map.
 */

import { iterateTrackedEntries, mergeTrackedResources } from '@openheaders/oracle/tracking/tab-tracking-store';
import type { ObservationSource, TrackedResource, TrackedResourceType } from '@/types/browser';

// ── Session persistence ────────────────────────────────────────────
//
// MV3 terminates the service worker after ~30s of inactivity. The
// `tabsWithActiveRules` Map lives in module-level state that dies with
// the worker, so every wake would drop the subresource attribution we
// built up on prior requests — rules targeting cached subresources
// would disappear from the popup until the user reloaded the page.
//
// We persist to `chrome.storage.session` (scoped to the browser
// session, partitioned per profile, auto-cleaned on incognito close)
// with a debounced writer so noisy pages don't spam the store. On SW
// wake we rehydrate BEFORE any popup query could observe an empty map,
// then reconcile against the current tab set so closed-tab entries
// don't leak. The fire-bridge and perf-observer content scripts are
// already persisted across the SW's lifetime, so new observations
// after wake arrive naturally; session persistence only backfills what
// we learned before the worker slept.
//
// Bounds: we keep at most 500 URLs per tab in the persisted payload
// (LRU by lastSeenTs). This caps storage at ~5MB even with 50 active
// tabs — well under `chrome.storage.session`'s 10MB quota, with
// headroom for the rule-state observer and other consumers.

const SESSION_STORAGE_KEY = 'tabTracker.tabsWithActiveRules';
const PERSIST_DEBOUNCE_MS = 250;
const MAX_PERSISTED_URLS_PER_TAB = 500;

let persistTimer: ReturnType<typeof setTimeout> | null = null;

interface PersistedResource {
  firstSeenTs: number;
  lastSeenTs: number;
  resourceType: TrackedResourceType;
  sources: ObservationSource[];
  servedFromCache?: boolean;
}

type PersistedPayload = Record<string /* tabId */, Record<string /* url */, PersistedResource>>;

interface SessionStorageApi {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

function getSessionStorage(): SessionStorageApi | null {
  const c = globalThis as unknown as {
    chrome?: { storage?: { session?: SessionStorageApi } };
    browser?: { storage?: { session?: SessionStorageApi } };
  };
  return c.chrome?.storage?.session ?? c.browser?.storage?.session ?? null;
}

export function scheduleTabTrackingPersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistTabTracking();
  }, PERSIST_DEBOUNCE_MS);
}

async function persistTabTracking(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  const payload: PersistedPayload = {};
  for (const [tabId, urlMap] of iterateTrackedEntries()) {
    // LRU-bound the per-tab payload by lastSeenTs so a long-lived SPA
    // doesn't balloon the persisted blob past the storage quota.
    const entries = [...urlMap.entries()]
      .sort((a, b) => b[1].lastSeenTs - a[1].lastSeenTs)
      .slice(0, MAX_PERSISTED_URLS_PER_TAB);
    const tabPayload: Record<string, PersistedResource> = {};
    for (const [url, res] of entries) {
      tabPayload[url] = {
        firstSeenTs: res.firstSeenTs,
        lastSeenTs: res.lastSeenTs,
        resourceType: res.resourceType,
        sources: [...res.sources],
        servedFromCache: res.servedFromCache,
      };
    }
    payload[String(tabId)] = tabPayload;
  }
  try {
    await session.set({ [SESSION_STORAGE_KEY]: payload });
  } catch {
    /* Storage may be full or the API may be unavailable — non-fatal. */
  }
}

function isPersistedPayload(raw: unknown): raw is PersistedPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  for (const tabMap of Object.values(raw as Record<string, unknown>)) {
    if (!tabMap || typeof tabMap !== 'object') return false;
    for (const res of Object.values(tabMap as Record<string, unknown>)) {
      if (!res || typeof res !== 'object') return false;
      const r = res as Record<string, unknown>;
      if (typeof r.firstSeenTs !== 'number') return false;
      if (typeof r.lastSeenTs !== 'number') return false;
      if (typeof r.resourceType !== 'string') return false;
      if (!Array.isArray(r.sources)) return false;
    }
  }
  return true;
}

/**
 * Rehydrate `tabsWithActiveRules` from `chrome.storage.session`. Call
 * once at SW init, before anything else could observe an empty map.
 * Safe to call multiple times; subsequent calls merge with whatever
 * state was already built up since startup.
 *
 * Reconciliation happens lazily: we hydrate everything, and a periodic
 * tab cleanup (already scheduled by `setupPeriodicCleanup`) prunes
 * entries for tabs that were closed during the SW's sleep.
 */
export async function rehydrateTabTracking(): Promise<void> {
  const session = getSessionStorage();
  if (!session) return;
  try {
    const result = await session.get(SESSION_STORAGE_KEY);
    const raw = result[SESSION_STORAGE_KEY];
    if (!isPersistedPayload(raw)) return;
    for (const [tabIdStr, urlMap] of Object.entries(raw)) {
      const tabId = Number(tabIdStr);
      if (!Number.isFinite(tabId)) continue;
      const entries: Array<[string, TrackedResource]> = [];
      for (const [url, res] of Object.entries(urlMap)) {
        entries.push([
          url,
          {
            firstSeenTs: res.firstSeenTs,
            lastSeenTs: res.lastSeenTs,
            timestamp: res.lastSeenTs,
            resourceType: res.resourceType,
            sources: new Set<ObservationSource>(res.sources),
            servedFromCache: res.servedFromCache,
          },
        ]);
      }
      mergeTrackedResources(tabId, entries);
    }
  } catch {
    /* Bad payload — skip rehydration, the SW will rebuild from scratch. */
  }
}
