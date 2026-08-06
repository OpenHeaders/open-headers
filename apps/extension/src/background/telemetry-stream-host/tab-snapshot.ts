/**
 * Tab-inventory snapshot assembly — shared by the request/response
 * inventory read (`oh.telemetry.tabs.list`) and the push-based
 * inventory watch (`tab-inventory.ts`). One assembly path so both
 * planes report byte-identical snapshots.
 *
 * Favicon bytes ride the snapshot as small `data:` URIs: the workbench
 * renderer's CSP forbids remote images and the desktop must never fetch
 * from arbitrary sites itself.
 */

import type { BrowserTabWire, TelemetryBrowserIdentity, TelemetryDebugState } from '@openheaders/core/protocol';
import { browserName, platformName } from '../self-host-label';

/** Bounds for the favicon → `data:` URI resolution below. */
const FAVICON_MAX_BYTES = 24 * 1024;
const FAVICON_FETCH_TIMEOUT_MS = 300;

/**
 * Favicon bytes → small `data:` URI, cached for the worker's lifetime
 * (`null` = known-unfetchable). Source order:
 *
 *   1. Chromium's `_favicon` extension endpoint (the `favicon`
 *      permission) — the browser's OWN favicon cache, keyed by page
 *      URL: zero network, the exact icon the tab strip shows.
 *   2. The tab's `favIconUrl` with `cache: 'force-cache'` (Firefox has
 *      no `_favicon`) — normally answered from the HTTP cache; the
 *      network is touched only for a genuinely cold icon.
 *
 * A resolution that misses the timeout keeps filling the cache in the
 * background — the icon appears on the next inventory snapshot instead
 * of stalling the reply window.
 */
const faviconCache = new Map<string, string | null>();

async function fetchIconAsDataUri(url: string): Promise<string | null> {
  const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
  if (!response.ok) return null;
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0 || bytes.byteLength > FAVICON_MAX_BYTES) return null;
  const contentType = response.headers.get('content-type') ?? 'image/png';
  if (!contentType.startsWith('image/')) return null;
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return `data:${contentType};base64,${btoa(binary)}`;
}

/** The `_favicon` cache endpoint URL, or null where unsupported. */
function chromiumFaviconEndpoint(pageUrl: string): string | null {
  try {
    const base = chrome.runtime.getURL('/_favicon/');
    return `${base}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
  } catch {
    return null;
  }
}

async function resolveFavicon(pageUrl: string, favIconUrl: string | undefined): Promise<string | undefined> {
  if (favIconUrl?.startsWith('data:')) {
    return favIconUrl.length <= FAVICON_MAX_BYTES * 2 ? favIconUrl : undefined;
  }
  const cacheKey = pageUrl || favIconUrl || '';
  if (cacheKey.length === 0) return undefined;
  const cached = faviconCache.get(cacheKey);
  if (cached !== undefined) return cached ?? undefined;

  const fill = (async (): Promise<string | null> => {
    const local = chromiumFaviconEndpoint(pageUrl);
    if (local !== null) {
      try {
        const fromCache = await fetchIconAsDataUri(local);
        if (fromCache !== null) return fromCache;
      } catch {
        // No `favicon` permission / non-Chromium — fall through.
      }
    }
    if (favIconUrl && (favIconUrl.startsWith('http://') || favIconUrl.startsWith('https://'))) {
      try {
        return await fetchIconAsDataUri(favIconUrl);
      } catch {
        return null;
      }
    }
    return null;
  })();
  void fill.then((resolved) => faviconCache.set(cacheKey, resolved));

  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), FAVICON_FETCH_TIMEOUT_MS));
  const won = await Promise.race([fill, timeout]);
  return won ?? undefined;
}

export async function queryBrowserTabs(): Promise<BrowserTabWire[]> {
  const raw = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    try {
      chrome.tabs.query({}, (tabList: chrome.tabs.Tab[]) => resolve(tabList ?? []));
    } catch {
      resolve([]);
    }
  });
  return Promise.all(
    raw
      .filter((tab) => typeof tab.id === 'number' && tab.id >= 0)
      .map(async (tab) => {
        const favIconUrl = await resolveFavicon(tab.url ?? '', tab.favIconUrl);
        return {
          tabId: tab.id as number,
          windowId: tab.windowId ?? -1,
          title: tab.title ?? '',
          url: tab.url ?? '',
          active: tab.active === true,
          ...(favIconUrl !== undefined ? { favIconUrl } : {}),
        };
      }),
  );
}

/** This browser's display identity for the inventory snapshot. */
export function browserIdentity(): TelemetryBrowserIdentity {
  return { name: browserName(), platform: platformName() };
}

/** The reported posture where the browser cannot drive CDP at all. */
export const DEBUG_UNAVAILABLE: TelemetryDebugState = {
  available: false,
  enabled: false,
  attachedTabs: [],
  pinnedTabs: [],
};
