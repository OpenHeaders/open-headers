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

/**
 * Editable cookie fields the Cookies tab sends when adding or updating a
 * cookie. `session` is derived (no `expirationDate` ⇒ session) and the
 * writer honours `hostOnly` by dropping the Domain attribute, so neither
 * is a separate input.
 */
export interface JarCookieEdit {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
  partitionKey?: string;
  storeId?: string;
}

/** Identity fields the writer needs to delete a single jar cookie. */
export interface JarCookieKey {
  name: string;
  domain: string;
  path: string;
  secure: boolean;
  partitionKey?: string;
  storeId?: string;
}

/**
 * Host-installed write path, paired with {@link CookieJarFetcher}. The
 * extension wires an SW-side bridge RPC that calls `chrome.cookies.set` /
 * `chrome.cookies.remove`. `set` resolves the resulting jar cookie (or
 * `null` on failure); `remove` resolves whether a cookie was deleted.
 */
export interface CookieJarWriter {
  set(edit: JarCookieEdit): Promise<JarCookie | null>;
  remove(key: JarCookieKey): Promise<boolean>;
}

let installedFetcher: CookieJarFetcher | null = null;
let installedWriter: CookieJarWriter | null = null;

export function setCookieJarFetcher(fn: CookieJarFetcher | null): void {
  installedFetcher = fn;
  // Invalidate everything on re-install so a host swap doesn't return
  // stale entries.
  cache.clear();
  notify();
}

export function setCookieJarWriter(fn: CookieJarWriter | null): void {
  installedWriter = fn;
}

/** Whether a host has wired a write path — the tab hides edit affordances
 *  when it hasn't (e.g. a host with read-only jar access). */
export function isCookieJarWritable(): boolean {
  return installedWriter !== null;
}

/**
 * Add or update a jar cookie, then invalidate every cached lookup so the
 * next read reflects the write. Returns the resulting cookie, or `null`
 * when no writer is installed or the write failed.
 */
export async function writeJarCookie(edit: JarCookieEdit): Promise<JarCookie | null> {
  if (!installedWriter) return null;
  let result: JarCookie | null = null;
  try {
    result = await installedWriter.set(edit);
  } catch {
    result = null;
  }
  // A cookie write can affect any URL's jar (domain cookies fan out to
  // subdomains), so clear the whole cache rather than guess a key.
  invalidateJarCache();
  return result;
}

/**
 * Delete a jar cookie, then invalidate every cached lookup. Returns
 * whether a cookie was removed.
 */
export async function removeJarCookie(key: JarCookieKey): Promise<boolean> {
  if (!installedWriter) return false;
  let ok = false;
  try {
    ok = await installedWriter.remove(key);
  } catch {
    ok = false;
  }
  invalidateJarCache();
  return ok;
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
  installedWriter = null;
}

export function __seedCookieJarForTests(url: string, cookies: readonly JarCookie[] | null): void {
  cache.set(url, { kind: 'resolved', cookies });
}
