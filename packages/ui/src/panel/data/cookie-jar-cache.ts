/**
 * In-memory cache for jar lookups, plus the host-installation seam.
 *
 * The Cookies tab needs cookie attributes (Domain, Path, Expires,
 * HttpOnly, Secure, SameSite, Partition) that the HAR `request.cookies`
 * array doesn't carry — HAR is only name+value for request cookies.
 * Chrome's DevTools cookies tab joins against the browser's cookie jar;
 * we replicate that.
 *
 * Lifecycle per URL:
 *
 *   1. View asks `getJarCookiesForUrl(url)` for the first time.
 *   2. Cache returns `null` immediately and kicks off the lookup in
 *      the background (entry → `pending`).
 *   3. When the lookup settles, the entry transitions to `resolved` and
 *      every subscribed listener is notified — the view re-renders and
 *      `getJarCookiesForUrl` now returns the array (or `null` if the
 *      lookup failed or no fetcher is installed).
 *
 * Mirrors `source-map-cache.ts` deliberately so hosts have one shape to
 * follow for "renderer asks for platform-specific data" capabilities.
 *
 * **Host-installed fetcher.** The panel page runs under `default-src
 * 'self'` CSP and doesn't have `chrome.cookies` reachable from the
 * renderer anyway. Hosts wire their own fetch path via
 * `setCookieJarFetcher` — for the browser extension that's an SW-side
 * bridge RPC that calls `chrome.cookies.getAll({ url })`. Hosts that
 * don't install one get null lookups silently (the view falls back to
 * the sparse HAR data).
 */

/**
 * Cross-browser jar cookie shape — a superset of the fields the four
 * supported MV3 APIs report. Stays decoupled from `chrome.cookies.Cookie`
 * so the desktop host (no chrome.cookies) can implement it without a
 * type-only dependency on the extension namespace.
 */
export interface JarCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Unix seconds. `undefined` ⇒ session cookie. */
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  /** `no_restriction` | `lax` | `strict` | `unspecified`. */
  sameSite?: string;
  session: boolean;
  /** Top-level site for partitioned cookies (CHIPS). */
  partitionKey?: string;
  storeId?: string;
}

export type CookieJarFetcher = (url: string) => Promise<readonly JarCookie[] | null>;

let installedFetcher: CookieJarFetcher | null = null;

export function setCookieJarFetcher(fn: CookieJarFetcher | null): void {
  installedFetcher = fn;
  // Invalidate everything on re-install so a host swap doesn't return
  // stale entries.
  cache.clear();
  notify();
}

type CacheEntry =
  | { kind: 'pending'; promise: Promise<readonly JarCookie[] | null> }
  | { kind: 'resolved'; cookies: readonly JarCookie[] | null };

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // A listener crashing must not stop others.
    }
  }
}

async function fetchInternal(url: string): Promise<readonly JarCookie[] | null> {
  if (!installedFetcher) return null;
  try {
    return await installedFetcher(url);
  } catch {
    return null;
  }
}

/**
 * Synchronous accessor. Returns the cached jar cookies when present;
 * returns `null` (and silently triggers a fetch) otherwise. Subscribers
 * are notified when the pending fetch completes.
 *
 * Keying on the full URL is intentional — host / path / scheme all
 * affect which cookies the jar reports, and the result is small enough
 * that per-URL caching is cheap.
 */
export function getJarCookiesForUrl(url: string): readonly JarCookie[] | null {
  if (!url) return null;
  const entry = cache.get(url);
  if (entry) {
    return entry.kind === 'resolved' ? entry.cookies : null;
  }
  const promise = fetchInternal(url);
  cache.set(url, { kind: 'pending', promise });
  promise.then((cookies) => {
    cache.set(url, { kind: 'resolved', cookies });
    notify();
  });
  return null;
}

/** Module-singleton subscribe API — re-renders on completed lookups. */
export function subscribeCookieJar(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Invalidate a single URL (or everything when omitted). Hosts call this
 * when `cookies.onChanged` fires so the next read picks up the new
 * jar state instead of a stale snapshot.
 */
export function invalidateJarCache(url?: string): void {
  if (url) cache.delete(url);
  else cache.clear();
  notify();
}

// ── Test hooks ──────────────────────────────────────────────────────

export function __resetCookieJarCacheForTests(): void {
  cache.clear();
  listeners.clear();
  installedFetcher = null;
}

export function __seedCookieJarForTests(url: string, cookies: readonly JarCookie[] | null): void {
  cache.set(url, { kind: 'resolved', cookies });
}
