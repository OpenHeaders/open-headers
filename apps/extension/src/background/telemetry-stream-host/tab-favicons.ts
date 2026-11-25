/**
 * Tab favicons — the browser's icons as small `data:` URIs, each under
 * a key that names its bytes.
 *
 * The workbench renderer's CSP forbids remote images and the desktop
 * must never fetch from arbitrary sites itself, so the icon bytes come
 * from here. An asker that reads favicons by key gets the key in every
 * inventory snapshot and the bytes once ({@link faviconsFor}); one that
 * does not gets the bytes inline, as every snapshot always carried them.
 *
 * Resolved icons are kept for the worker's lifetime (`null` =
 * known-unfetchable). Source order:
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

import { TELEMETRY_FAVICONS_PER_PULL } from '@openheaders/core/protocol';

/** Bounds for the favicon → `data:` URI resolution below. */
const FAVICON_MAX_BYTES = 24 * 1024;
const FAVICON_FETCH_TIMEOUT_MS = 300;

/** How much of the icon's digest names it — 64 bits, as hex. */
const FAVICON_KEY_HEX_CHARS = 16;

/** One resolved icon: its bytes as a `data:` URI, and the key that names them. */
export interface TabFavicon {
  readonly key: string;
  readonly dataUri: string;
}

/** Page URL (or the tab's own icon URL) → its icon. */
const iconBySource = new Map<string, TabFavicon | null>();
/** Key → bytes, for the pull. The same icon on many pages is one entry. */
const dataUriByKey = new Map<string, string>();

async function keyed(dataUri: string): Promise<TabFavicon> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(dataUri));
  let hex = '';
  for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');
  const key = hex.slice(0, FAVICON_KEY_HEX_CHARS);
  dataUriByKey.set(key, dataUri);
  return { key, dataUri };
}

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

async function fetchFavicon(pageUrl: string, favIconUrl: string | undefined): Promise<TabFavicon | null> {
  const local = chromiumFaviconEndpoint(pageUrl);
  if (local !== null) {
    try {
      const fromCache = await fetchIconAsDataUri(local);
      if (fromCache !== null) return keyed(fromCache);
    } catch {
      // No `favicon` permission / non-Chromium — fall through.
    }
  }
  if (favIconUrl && (favIconUrl.startsWith('http://') || favIconUrl.startsWith('https://'))) {
    try {
      const fetched = await fetchIconAsDataUri(favIconUrl);
      return fetched !== null ? keyed(fetched) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** One tab's icon, or `undefined` while it is cold or when it has none. */
export async function resolveTabFavicon(
  pageUrl: string,
  favIconUrl: string | undefined,
): Promise<TabFavicon | undefined> {
  // A tab that hands over its icon's bytes is its own source.
  const inline = favIconUrl?.startsWith('data:') === true;
  if (inline && favIconUrl.length > FAVICON_MAX_BYTES * 2) return undefined;
  const source = inline ? favIconUrl : pageUrl || favIconUrl || '';
  if (source.length === 0) return undefined;
  const cached = iconBySource.get(source);
  if (cached !== undefined) return cached ?? undefined;
  if (inline) {
    const icon = await keyed(source);
    iconBySource.set(source, icon);
    return icon;
  }

  const fill = fetchFavicon(pageUrl, favIconUrl);
  void fill.then((resolved) => iconBySource.set(source, resolved));

  const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), FAVICON_FETCH_TIMEOUT_MS));
  const won = await Promise.race([fill, timeout]);
  return won ?? undefined;
}

/**
 * The bytes behind the first {@link TELEMETRY_FAVICONS_PER_PULL} of
 * `keys`: key → `data:` URI. A key this worker does not hold is left out.
 */
export function faviconsFor(keys: readonly unknown[]): Record<string, string> {
  const icons: Record<string, string> = {};
  for (const key of keys.slice(0, TELEMETRY_FAVICONS_PER_PULL)) {
    if (typeof key !== 'string') continue;
    const dataUri = dataUriByKey.get(key);
    if (dataUri !== undefined) icons[key] = dataUri;
  }
  return icons;
}
