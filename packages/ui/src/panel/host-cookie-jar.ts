/**
 * Public installation seam for the DevTools panel's cookie-jar fetcher.
 *
 * Hosts (extension, web app, electron) call `setCookieJarFetcher(fn)`
 * once at boot to register their platform-specific path for fetching
 * the cookies the browser jar holds for a given URL. Without an
 * installed fetcher the cache silently returns null and the cookies tab
 * falls back to the sparse HAR data (name + value only for request
 * cookies).
 *
 * Mirrors `host-source-map-fetcher.ts` — same shape, same lifecycle.
 */

export {
  invalidateJarCache,
  setCookieJarFetcher,
} from './data/cookie-jar-cache';
export type { CookieJarFetcher, JarCookie } from './data/cookie-jar-cache';
