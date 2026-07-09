/**
 * CDP plane of the Cache Storage browser — the one storage type whose
 * CDP read domain works for extension debugger clients (probe-verified,
 * STORAGE_PANEL_PLAN.md §2.3): `CacheStorage.requestCacheNames` /
 * `requestEntries` (natively paged) / `deleteCache` / `deleteEntry`.
 *
 * Every op resolves `null` on any CDP failure (detached mid-flight,
 * unknown cache, command error) — the arbitration in `caches.ts` then
 * degrades to the injected plane, so a race never surfaces as an error.
 *
 * Caches are addressed by name on the wire; the CDP domain keys them by
 * `cacheId`, so ops resolve the id through `requestCacheNames` per call
 * — ids aren't stable across cache deletion/recreation, and caching
 * them would just re-derive this lookup's failure modes.
 */

import type {
  CacheEntryDocumentWire,
  CacheEntryResponsePreviewWire,
  CacheEntryWire,
  CacheStorageCacheWire,
} from '@openheaders/core/bridge';
import {
  CACHE_BODY_DOCUMENT_MAX,
  CACHE_BODY_PREVIEW_MAX,
  CACHE_HEADERS_PREVIEW_MAX,
  CACHE_PAGE_SIZE_MAX,
} from './standard-plane-caches';

export type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<unknown>;

interface RawCdpCache {
  cacheId: string;
  cacheName: string;
}

interface RawCdpHeader {
  name: string;
  value: string;
}

interface RawCdpCacheEntry {
  requestURL: string;
  requestMethod: string;
  requestHeaders?: RawCdpHeader[];
  /** Storage wall time in epoch SECONDS (converted to ms on the wire). */
  responseTime?: number;
  responseStatus?: number;
  responseStatusText?: string;
  responseHeaders?: RawCdpHeader[];
}

/** Content types whose body preview ships as text instead of base64. */
const TEXTUAL_CONTENT_TYPE = /^text\/|json|javascript|xml|svg|x-www-form-urlencoded/i;

async function requestCaches(send: CdpSend, securityOrigin: string): Promise<RawCdpCache[] | null> {
  try {
    const res = (await send('CacheStorage.requestCacheNames', { securityOrigin })) as
      | { caches?: RawCdpCache[] }
      | undefined;
    return Array.isArray(res?.caches) ? res.caches : null;
  } catch {
    return null;
  }
}

async function resolveCacheId(send: CdpSend, securityOrigin: string, cache: string): Promise<string | null> {
  const caches = await requestCaches(send, securityOrigin);
  return caches?.find((c) => c.cacheName === cache)?.cacheId ?? null;
}

export async function listCachesViaCdp(
  send: CdpSend,
  securityOrigin: string,
  maxCaches: number,
): Promise<CacheStorageCacheWire[] | null> {
  const caches = await requestCaches(send, securityOrigin);
  if (caches === null) return null;
  return caches.slice(0, maxCaches).map((c) => ({ name: c.cacheName }));
}

export async function getCacheEntriesViaCdp(
  send: CdpSend,
  securityOrigin: string,
  cache: string,
  page: number,
  pageSize: number,
): Promise<{ entries: CacheEntryWire[]; truncated: boolean } | null> {
  const cacheId = await resolveCacheId(send, securityOrigin, cache);
  if (cacheId === null) return null;
  try {
    const skipCount = page * pageSize;
    const res = (await send('CacheStorage.requestEntries', { cacheId, skipCount, pageSize })) as
      | { cacheDataEntries?: RawCdpCacheEntry[]; returnCount?: number }
      | undefined;
    if (!Array.isArray(res?.cacheDataEntries)) return null;
    const entries = res.cacheDataEntries.map((entry) => {
      const joined = (entry.requestHeaders ?? []).map((h) => `${h.name}: ${h.value}`).join(', ');
      const headersPreview =
        joined.length > CACHE_HEADERS_PREVIEW_MAX ? `${joined.slice(0, CACHE_HEADERS_PREVIEW_MAX)}…` : joined;
      const lengthHeader = (entry.responseHeaders ?? []).find((h) => h.name.toLowerCase() === 'content-length');
      const contentLength = lengthHeader === undefined ? Number.NaN : Number(lengthHeader.value);
      return {
        url: entry.requestURL,
        method: entry.requestMethod,
        ...(headersPreview.length > 0 ? { headersPreview } : {}),
        ...(Number.isFinite(contentLength) && contentLength >= 0 ? { contentLength } : {}),
        ...(typeof entry.responseTime === 'number' && entry.responseTime > 0
          ? { responseTimeMs: Math.round(entry.responseTime * 1000) }
          : {}),
      };
    });
    // `returnCount` is the total matching the query, not the page.
    const total = typeof res.returnCount === 'number' ? res.returnCount : skipCount + entries.length;
    return { entries, truncated: skipCount + entries.length < total };
  } catch {
    return null;
  }
}

/**
 * One cache entry's stored-response preview: the entry's status line and
 * response headers come from `requestEntries` (path-filtered on the
 * URL), the body from `requestCachedResponse` — which returns the WHOLE
 * body base64-encoded, so it is decoded and re-capped here before it
 * ever rides the bridge. `null` on any miss (entry not found, command
 * error) — the arbitration degrades to the injected `cache.match`.
 */
export async function getCacheEntryResponseViaCdp(
  send: CdpSend,
  securityOrigin: string,
  cache: string,
  url: string,
  method: string,
): Promise<CacheEntryResponsePreviewWire | null> {
  const cacheId = await resolveCacheId(send, securityOrigin, cache);
  if (cacheId === null) return null;
  try {
    const res = (await send('CacheStorage.requestEntries', {
      cacheId,
      skipCount: 0,
      pageSize: CACHE_PAGE_SIZE_MAX,
      pathFilter: url,
    })) as { cacheDataEntries?: RawCdpCacheEntry[] } | undefined;
    const entry = res?.cacheDataEntries?.find((e) => e.requestURL === url && e.requestMethod === method);
    if (!entry || typeof entry.responseStatus !== 'number') return null;
    const body = (await send('CacheStorage.requestCachedResponse', {
      cacheId,
      requestURL: url,
      requestHeaders: entry.requestHeaders ?? [],
    })) as { response?: { body?: string } } | undefined;
    if (typeof body?.response?.body !== 'string') return null;
    const bytes = atob(body.response.body);
    const bodyTruncated = bytes.length > CACHE_BODY_PREVIEW_MAX;
    const slice = bytes.slice(0, CACHE_BODY_PREVIEW_MAX);
    const joined = (entry.responseHeaders ?? []).map((h) => `${h.name}: ${h.value}`).join(', ');
    const headersPreview =
      joined.length > CACHE_HEADERS_PREVIEW_MAX ? `${joined.slice(0, CACHE_HEADERS_PREVIEW_MAX)}…` : joined;
    const contentType = (entry.responseHeaders ?? []).find((h) => h.name.toLowerCase() === 'content-type')?.value ?? '';
    const textual = TEXTUAL_CONTENT_TYPE.test(contentType);
    const bodyPreview = textual
      ? new TextDecoder().decode(Uint8Array.from(slice, (c) => c.charCodeAt(0)))
      : btoa(slice);
    return {
      status: entry.responseStatus,
      statusText: entry.responseStatusText ?? '',
      ...(headersPreview.length > 0 ? { headersPreview } : {}),
      bodyPreview,
      ...(textual ? {} : { bodyBase64: true }),
      bodyLength: bytes.length,
      ...(bodyTruncated ? { bodyTruncated: true } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * One cache entry's stored response as a full editor document — same
 * two-command resolve as the preview, but the header pairs ship
 * structured and the body rides the document cap. `null` on any miss —
 * the arbitration degrades to the injected read.
 */
export async function getCacheEntryDocumentViaCdp(
  send: CdpSend,
  securityOrigin: string,
  cache: string,
  url: string,
  method: string,
): Promise<CacheEntryDocumentWire | null> {
  const cacheId = await resolveCacheId(send, securityOrigin, cache);
  if (cacheId === null) return null;
  try {
    const res = (await send('CacheStorage.requestEntries', {
      cacheId,
      skipCount: 0,
      pageSize: CACHE_PAGE_SIZE_MAX,
      pathFilter: url,
    })) as { cacheDataEntries?: RawCdpCacheEntry[] } | undefined;
    const entry = res?.cacheDataEntries?.find((e) => e.requestURL === url && e.requestMethod === method);
    if (!entry || typeof entry.responseStatus !== 'number') return null;
    const bodyRes = (await send('CacheStorage.requestCachedResponse', {
      cacheId,
      requestURL: url,
      requestHeaders: entry.requestHeaders ?? [],
    })) as { response?: { body?: string } } | undefined;
    if (typeof bodyRes?.response?.body !== 'string') return null;
    const bytes = atob(bodyRes.response.body);
    const bodyTruncated = bytes.length > CACHE_BODY_DOCUMENT_MAX;
    const slice = bytes.slice(0, CACHE_BODY_DOCUMENT_MAX);
    const headers = (entry.responseHeaders ?? []).map((h) => ({ name: h.name, value: h.value }));
    const contentType = (entry.responseHeaders ?? []).find((h) => h.name.toLowerCase() === 'content-type')?.value ?? '';
    const textual = TEXTUAL_CONTENT_TYPE.test(contentType);
    const body = textual ? new TextDecoder().decode(Uint8Array.from(slice, (c) => c.charCodeAt(0))) : btoa(slice);
    return {
      status: entry.responseStatus,
      statusText: entry.responseStatusText ?? '',
      headers,
      body,
      ...(textual ? {} : { bodyBase64: true }),
      bodyLength: bytes.length,
      ...(bodyTruncated ? { bodyTruncated: true } : {}),
    };
  } catch {
    return null;
  }
}

export async function deleteCacheViaCdp(
  send: CdpSend,
  securityOrigin: string,
  cache: string,
): Promise<{ ok: boolean } | null> {
  const cacheId = await resolveCacheId(send, securityOrigin, cache);
  if (cacheId === null) return null;
  try {
    await send('CacheStorage.deleteCache', { cacheId });
    return { ok: true };
  } catch {
    return null;
  }
}

export async function deleteCacheEntryViaCdp(
  send: CdpSend,
  securityOrigin: string,
  cache: string,
  url: string,
): Promise<{ ok: boolean } | null> {
  const cacheId = await resolveCacheId(send, securityOrigin, cache);
  if (cacheId === null) return null;
  try {
    await send('CacheStorage.deleteEntry', { cacheId, request: url });
    return { ok: true };
  } catch {
    return null;
  }
}
