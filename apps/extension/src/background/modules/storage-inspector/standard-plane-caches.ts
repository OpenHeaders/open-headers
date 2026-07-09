/**
 * Standard-plane Cache Storage READS and DELETES — `chrome.scripting`
 * injection into the scope's frame. Cache Storage also has a full CDP
 * tier (STORAGE_PANEL_PLAN.md §2.3 — the one storage type whose read
 * domain works for extension debugger clients); the arbitration in
 * `caches.ts` picks injection for detached tabs, so the panel never
 * sees the difference.
 *
 * `caches` exists in SECURE CONTEXTS only — a non-secure scope reads
 * `null`, which the panel renders as an explanatory empty state, never
 * an error.
 *
 * Payload discipline: the entry list is derived from the cache's
 * `Request` keys — bounded url/method/header-preview strings, paged with
 * a clamped page size — plus one headers-only `cache.match` per page row
 * for the size column's `content-length` header (bodies stay untouched;
 * the page clamp bounds the match count). A stored response's BODY
 * preview is the separate lazy fetch below, byte-capped and serialized
 * in-page (text for textual content types, base64 otherwise). The time
 * column has no injected leg at all — the Cache API doesn't expose a
 * stored response's wall time; only the CDP transport carries it.
 *
 * `caches.open()` CREATES a missing cache, so every entry read is
 * guarded by `caches.has()` first — a cache deleted since enumeration
 * reads as gone instead of resurrecting empty (same ghost discipline as
 * the IDB plane's abort-upgrade open).
 */

import type {
  CacheEntryDocumentWire,
  CacheEntryResponsePreviewWire,
  CacheEntryWire,
  CacheStorageCacheWire,
} from '@openheaders/core/bridge';
import { runInFrame } from './standard-plane';

/** Cache-count cap per enumeration (an origin rarely has more). */
export const CACHES_MAX = 100;
/** Page-size clamp for entry reads. */
export const CACHE_PAGE_SIZE_MAX = 200;
export const CACHE_PAGE_SIZE_DEFAULT = 50;
/** Per-entry request-headers preview cap (chars). */
export const CACHE_HEADERS_PREVIEW_MAX = 512;
/** Stored-response body preview cap (bytes) for the lazy fetch. */
export const CACHE_BODY_PREVIEW_MAX = 16 * 1024;
/** Stored-response body cap (bytes) for the editor-tab document read. */
export const CACHE_BODY_DOCUMENT_MAX = 1024 * 1024;

interface InjectedCacheEntry {
  url: string;
  method: string;
  headersPreview?: string;
  contentLength?: number;
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
    const entries = await Promise.all(
      slice.slice(0, pageSize).map(async (request) => {
        const pairs: string[] = [];
        request.headers.forEach((value, name) => {
          pairs.push(`${name}: ${value}`);
        });
        const joined = pairs.join(', ');
        const headersPreview = joined.length > headersPreviewMax ? `${joined.slice(0, headersPreviewMax)}…` : joined;
        // Headers-only match for the content-length column — the body is
        // never read; an unmatchable or header-less response omits it.
        let contentLength = Number.NaN;
        try {
          const response = await opened.match(request, { ignoreMethod: request.method !== 'GET' });
          contentLength = Number(response?.headers.get('content-length') ?? Number.NaN);
        } catch {
          // Column stays absent.
        }
        return {
          url: request.url,
          method: request.method,
          ...(headersPreview.length > 0 ? { headersPreview } : {}),
          ...(Number.isFinite(contentLength) && contentLength >= 0 ? { contentLength } : {}),
        };
      }),
    );
    return { entries, truncated };
  } catch {
    return { entries: null, truncated: false };
  }
}

export async function readCacheEntryResponseInPage(
  cache: string,
  url: string,
  method: string,
  headersPreviewMax: number,
  bodyPreviewMax: number,
): Promise<{ preview: CacheEntryResponsePreviewWire | null }> {
  if (typeof caches === 'undefined') return { preview: null };
  try {
    // Same ghost guard as the reads — open() creates a missing cache.
    if (!(await caches.has(cache))) return { preview: null };
    const opened = await caches.open(cache);
    const response = await opened.match(url, { ignoreMethod: method !== 'GET' });
    if (!response) return { preview: null };
    const pairs: string[] = [];
    response.headers.forEach((value, name) => {
      pairs.push(`${name}: ${value}`);
    });
    const joined = pairs.join(', ');
    const headersPreview = joined.length > headersPreviewMax ? `${joined.slice(0, headersPreviewMax)}…` : joined;
    const contentType = response.headers.get('content-type') ?? '';
    const textual = /^text\/|json|javascript|xml|svg|x-www-form-urlencoded/i.test(contentType);
    const blob = await response.blob();
    const bodyLength = blob.size;
    const bodyTruncated = blob.size > bodyPreviewMax;
    const bytes = new Uint8Array(await blob.slice(0, bodyPreviewMax).arrayBuffer());
    let bodyPreview: string;
    if (textual) {
      bodyPreview = new TextDecoder().decode(bytes);
    } else {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      bodyPreview = btoa(binary);
    }
    return {
      preview: {
        status: response.status,
        statusText: response.statusText,
        ...(headersPreview.length > 0 ? { headersPreview } : {}),
        bodyPreview,
        ...(textual ? {} : { bodyBase64: true }),
        bodyLength,
        ...(bodyTruncated ? { bodyTruncated: true } : {}),
      },
    };
  } catch {
    return { preview: null };
  }
}

export async function readCacheEntryDocumentInPage(
  cache: string,
  url: string,
  method: string,
  bodyMax: number,
): Promise<{ document: CacheEntryDocumentWire | null }> {
  if (typeof caches === 'undefined') return { document: null };
  try {
    // Same ghost guard as the reads — open() creates a missing cache.
    if (!(await caches.has(cache))) return { document: null };
    const opened = await caches.open(cache);
    const response = await opened.match(url, { ignoreMethod: method !== 'GET' });
    if (!response) return { document: null };
    const headers: Array<{ name: string; value: string }> = [];
    response.headers.forEach((value, name) => {
      headers.push({ name, value });
    });
    const contentType = response.headers.get('content-type') ?? '';
    const textual = /^text\/|json|javascript|xml|svg|x-www-form-urlencoded/i.test(contentType);
    const blob = await response.blob();
    const bodyLength = blob.size;
    const bodyTruncated = blob.size > bodyMax;
    const bytes = new Uint8Array(await blob.slice(0, bodyMax).arrayBuffer());
    let body: string;
    if (textual) {
      body = new TextDecoder().decode(bytes);
    } else {
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      body = btoa(binary);
    }
    return {
      document: {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        ...(textual ? {} : { bodyBase64: true }),
        bodyLength,
        ...(bodyTruncated ? { bodyTruncated: true } : {}),
      },
    };
  } catch {
    return { document: null };
  }
}

export async function deleteCacheInPage(cache: string): Promise<{ ok: boolean }> {
  if (typeof caches === 'undefined') return { ok: false };
  try {
    return { ok: await caches.delete(cache) };
  } catch {
    return { ok: false };
  }
}

export async function deleteCacheEntryInPage(cache: string, url: string, method: string): Promise<{ ok: boolean }> {
  if (typeof caches === 'undefined') return { ok: false };
  try {
    // Same ghost guard as the reads — open() creates a missing cache.
    if (!(await caches.has(cache))) return { ok: false };
    const opened = await caches.open(cache);
    // URL strings are the only match key both transports share; a
    // non-GET entry needs the method check relaxed to match at all.
    return { ok: await opened.delete(url, { ignoreMethod: method !== 'GET' }) };
  } catch {
    return { ok: false };
  }
}

export async function listCachesInjected(
  tabId: number,
  frameId: number,
): Promise<{ caches: CacheStorageCacheWire[] | null }> {
  const result = await runInFrame(tabId, frameId, listCachesInPage, [CACHES_MAX]);
  if (!result || !Array.isArray(result.caches)) return { caches: null };
  return { caches: result.caches.map((c) => ({ name: c.name })) };
}

export async function getCacheEntriesInjected(
  tabId: number,
  frameId: number,
  cache: string,
  page: number,
  pageSize: number,
): Promise<{ entries: CacheEntryWire[] | null; truncated?: boolean }> {
  const result = await runInFrame(tabId, frameId, readCacheEntriesInPage, [
    cache,
    page,
    pageSize,
    CACHE_HEADERS_PREVIEW_MAX,
  ]);
  if (!result || !Array.isArray(result.entries)) return { entries: null };
  return { entries: result.entries, ...(result.truncated ? { truncated: true } : {}) };
}

export async function getCacheEntryResponseInjected(
  tabId: number,
  frameId: number,
  cache: string,
  url: string,
  method: string,
): Promise<{ preview: CacheEntryResponsePreviewWire | null }> {
  const result = await runInFrame(tabId, frameId, readCacheEntryResponseInPage, [
    cache,
    url,
    method,
    CACHE_HEADERS_PREVIEW_MAX,
    CACHE_BODY_PREVIEW_MAX,
  ]);
  if (!result || typeof result.preview?.bodyPreview !== 'string') return { preview: null };
  return { preview: result.preview };
}

export async function getCacheEntryDocumentInjected(
  tabId: number,
  frameId: number,
  cache: string,
  url: string,
  method: string,
): Promise<{ document: CacheEntryDocumentWire | null }> {
  const result = await runInFrame(tabId, frameId, readCacheEntryDocumentInPage, [
    cache,
    url,
    method,
    CACHE_BODY_DOCUMENT_MAX,
  ]);
  if (!result || typeof result.document?.body !== 'string') return { document: null };
  return { document: result.document };
}

export async function deleteCacheInjected(tabId: number, frameId: number, cache: string): Promise<{ ok: boolean }> {
  const result = await runInFrame(tabId, frameId, deleteCacheInPage, [cache]);
  return { ok: result?.ok === true };
}

export async function deleteCacheEntryInjected(
  tabId: number,
  frameId: number,
  cache: string,
  url: string,
  method: string,
): Promise<{ ok: boolean }> {
  const result = await runInFrame(tabId, frameId, deleteCacheEntryInPage, [cache, url, method]);
  return { ok: result?.ok === true };
}
