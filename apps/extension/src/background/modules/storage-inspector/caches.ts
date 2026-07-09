/**
 * Cache Storage data plane — ONE plane, TWO transports (plan §3): the
 * RPC surface arbitrates per op between the CDP domain (attached tabs —
 * the one storage type with a working CDP read tier, §2.3) and the
 * injected `caches.*` plane. Transport choice rides the CURRENT attach
 * state via the cdp-tier seam and is invisible to the panel; any CDP
 * failure (detach mid-flight, unknown cache) degrades to injection
 * instead of erroring.
 *
 * The CDP domain addresses caches per security origin, derived SW-side
 * through the shared `frame-origin.ts` helper — never trusted from the
 * panel. Page/pageSize clamps live here so both transports see the same
 * bounds.
 */

import type {
  CacheEntryDocumentWire,
  CacheEntryResponsePreviewWire,
  CacheEntryWire,
  CacheStorageCacheWire,
} from '@openheaders/core/bridge';
import {
  deleteCacheEntryViaCdp,
  deleteCacheViaCdp,
  getCacheEntriesViaCdp,
  getCacheEntryDocumentViaCdp,
  getCacheEntryResponseViaCdp,
  listCachesViaCdp,
} from './cdp-plane-caches';
import { getAttachedStorageCdpSend } from './cdp-tier';
import { frameSecurityOrigin } from './frame-origin';
import {
  CACHE_PAGE_SIZE_DEFAULT,
  CACHE_PAGE_SIZE_MAX,
  CACHES_MAX,
  deleteCacheEntryInjected,
  deleteCacheInjected,
  getCacheEntriesInjected,
  getCacheEntryDocumentInjected,
  getCacheEntryResponseInjected,
  listCachesInjected,
} from './standard-plane-caches';

export async function listCacheStorageCaches(
  tabId: number,
  frameId: number,
): Promise<{ caches: CacheStorageCacheWire[] | null }> {
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await listCachesViaCdp(send, origin, CACHES_MAX);
      if (viaCdp !== null) return { caches: viaCdp };
    }
  }
  return listCachesInjected(tabId, frameId);
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
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await getCacheEntriesViaCdp(send, origin, cache, safePage, safePageSize);
      if (viaCdp !== null) return { entries: viaCdp.entries, ...(viaCdp.truncated ? { truncated: true } : {}) };
    }
  }
  return getCacheEntriesInjected(tabId, frameId, cache, safePage, safePageSize);
}

export async function getCacheStorageEntryResponse(
  tabId: number,
  frameId: number,
  cache: string,
  url: string,
  method: string,
): Promise<{ preview: CacheEntryResponsePreviewWire | null }> {
  if (typeof cache !== 'string' || typeof url !== 'string' || typeof method !== 'string') return { preview: null };
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await getCacheEntryResponseViaCdp(send, origin, cache, url, method);
      if (viaCdp !== null) return { preview: viaCdp };
    }
  }
  return getCacheEntryResponseInjected(tabId, frameId, cache, url, method);
}

export async function getCacheStorageEntryDocument(
  tabId: number,
  frameId: number,
  cache: string,
  url: string,
  method: string,
): Promise<{ document: CacheEntryDocumentWire | null }> {
  if (typeof cache !== 'string' || typeof url !== 'string' || typeof method !== 'string') return { document: null };
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await getCacheEntryDocumentViaCdp(send, origin, cache, url, method);
      if (viaCdp !== null) return { document: viaCdp };
    }
  }
  return getCacheEntryDocumentInjected(tabId, frameId, cache, url, method);
}

export async function deleteCacheStorageCache(tabId: number, frameId: number, cache: string): Promise<{ ok: boolean }> {
  if (typeof cache !== 'string') return { ok: false };
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await deleteCacheViaCdp(send, origin, cache);
      if (viaCdp !== null) return viaCdp;
    }
  }
  return deleteCacheInjected(tabId, frameId, cache);
}

export async function deleteCacheStorageEntry(
  tabId: number,
  frameId: number,
  cache: string,
  url: string,
  method: string,
): Promise<{ ok: boolean }> {
  if (typeof cache !== 'string' || typeof url !== 'string' || typeof method !== 'string') return { ok: false };
  const send = getAttachedStorageCdpSend(tabId);
  if (send) {
    const origin = await frameSecurityOrigin(tabId, frameId);
    if (origin !== null) {
      const viaCdp = await deleteCacheEntryViaCdp(send, origin, cache, url);
      if (viaCdp !== null) return viaCdp;
    }
  }
  return deleteCacheEntryInjected(tabId, frameId, cache, url, method);
}
