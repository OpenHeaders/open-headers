/**
 * Standard-plane Cache Storage READS — `chrome.scripting` injection into
 * the scope's frame. Cache Storage also has a full CDP tier
 * (STORAGE_PANEL_PLAN.md §2.3 — the one storage type whose read domain
 * works for extension debugger clients); injection is the transport for
 * detached tabs, chosen SW-side so the panel never sees the difference.
 *
 * `caches` exists in SECURE CONTEXTS only — a non-secure scope reads
 * `null`, which the panel renders as an explanatory empty state, never
 * an error.
 *
 * Payload discipline: the entry list is derived from the cache's
 * `Request` keys only — bounded url/method/header-preview strings, paged
 * with a clamped page size. The list NEVER calls `cache.match`; a stored
 * response's preview is a separate lazy fetch (slice 5 tail / polish).
 *
 * `caches.open()` CREATES a missing cache, so every entry read is
 * guarded by `caches.has()` first — a cache deleted since enumeration
 * reads as gone instead of resurrecting empty (same ghost discipline as
 * the IDB plane's abort-upgrade open).
 */

import type { CacheEntryWire, CacheStorageCacheWire } from '@openheaders/core/bridge';
import { runInFrame } from './standard-plane';

/** Cache-count cap per enumeration (an origin rarely has more). */
export const CACHES_MAX = 100;
/** Page-size clamp for entry reads. */
export const CACHE_PAGE_SIZE_MAX = 200;
export const CACHE_PAGE_SIZE_DEFAULT = 50;
/** Per-entry request-headers preview cap (chars). */
export const CACHE_HEADERS_PREVIEW_MAX = 512;

interface InjectedCacheEntry {
  url: string;
  method: string;
  headersPreview?: string;
}

/**
 * The injected funcs run INSIDE the target frame and are serialized by
 * `chrome.scripting` — self-contained by necessity (caps arrive as
 * args). Exported so tests can exercise enumeration, paging and preview
 * rules directly against a stubbed `caches` global.
 */
export async function listCachesInPage(maxCaches: number): Promise<{ caches: Array<{ name: string }> | null }> {
  if (typeof caches === 'undefined') return { caches: null };
  try {
    const names = await caches.keys();
    return { caches: names.slice(0, maxCaches).map((name) => ({ name })) };
  } catch {
    return { caches: null };
  }
}

export async function readCacheEntriesInPage(
  cache: string,
  page: number,
  pageSize: number,
  headersPreviewMax: number,
): Promise<{ entries: InjectedCacheEntry[] | null; truncated: boolean }> {
  if (typeof caches === 'undefined') return { entries: null, truncated: false };
  try {
    // `open()` creates a missing cache — check existence first so a
    // cache deleted since enumeration reads as gone, not resurrected.
    if (!(await caches.has(cache))) return { entries: null, truncated: false };
    const opened = await caches.open(cache);
    const requests = await opened.keys();
    // One-past probe: an extra key beyond the page ⇒ more exist.
    const start = page * pageSize;
    const slice = requests.slice(start, start + pageSize + 1);
    const truncated = slice.length > pageSize;
    const entries = slice.slice(0, pageSize).map((request) => {
      const pairs: string[] = [];
      request.headers.forEach((value, name) => {
        pairs.push(`${name}: ${value}`);
      });
      const joined = pairs.join(', ');
      const headersPreview = joined.length > headersPreviewMax ? `${joined.slice(0, headersPreviewMax)}…` : joined;
      return {
        url: request.url,
        method: request.method,
        ...(headersPreview.length > 0 ? { headersPreview } : {}),
      };
    });
    return { entries, truncated };
  } catch {
    return { entries: null, truncated: false };
  }
}

export async function listCacheStorageCaches(
  tabId: number,
  frameId: number,
): Promise<{ caches: CacheStorageCacheWire[] | null }> {
  const result = await runInFrame(tabId, frameId, listCachesInPage, [CACHES_MAX]);
  if (!result || !Array.isArray(result.caches)) return { caches: null };
  return { caches: result.caches.map((c) => ({ name: c.name })) };
}

export async function getCacheStorageEntries(
  tabId: number,
  frameId: number,
  cache: string,
  page: number,
  pageSize: number,
): Promise<{ entries: CacheEntryWire[] | null; truncated?: boolean }> {
  if (typeof cache !== 'string') return { entries: null };
  const safePage = Number.isInteger(page) && page > 0 ? page : 0;
  const safePageSize =
    Number.isInteger(pageSize) && pageSize > 0 ? Math.min(pageSize, CACHE_PAGE_SIZE_MAX) : CACHE_PAGE_SIZE_DEFAULT;
  const result = await runInFrame(tabId, frameId, readCacheEntriesInPage, [
    cache,
    safePage,
    safePageSize,
    CACHE_HEADERS_PREVIEW_MAX,
  ]);
  if (!result || !Array.isArray(result.entries)) return { entries: null };
  return { entries: result.entries, ...(result.truncated ? { truncated: true } : {}) };
}
