/**
 * Runtime-local cookie jar — the store behind the per-request
 * `cookieJar` opt-in on node runtimes. One jar per key (the workspace
 * id, so sessions never bleed across workspaces), held in this
 * process's memory only: never persisted, never synced, gone when the
 * process exits. Cookies are session credentials — the same line that
 * keeps vault material out of synced YAML keeps them off disk.
 *
 * Matching is a pragmatic RFC 6265 subset, sized for API-session
 * workflows rather than full browser fidelity:
 *   - **Domain**: a `Domain` attribute must be a suffix of the setting
 *     host (leading dot ignored, case-insensitive) or the cookie is
 *     rejected; without one the cookie is host-only (exact match).
 *     No public-suffix list — the suffix check is the whole gate.
 *   - **Path**: `Path` attribute or the URL's default path; attach
 *     uses the spec's path-match (equal, or prefix at a `/` boundary).
 *   - **Expiry**: `Max-Age` wins over `Expires`; a zero/negative
 *     `Max-Age` or past `Expires` deletes the stored cookie. Neither →
 *     a session cookie (the jar is session-scoped anyway).
 *   - **Secure**: attached over `https:` only.
 *   - Not modeled: `SameSite` (no navigation context here), `HttpOnly`
 *     (no script plane reads the jar), per-domain count limits.
 *
 * Replacement identity is (name, domain, path), per the spec. The jar
 * is bounded — past {@link MAX_COOKIES_PER_JAR} the expired entries go
 * first, then the oldest stored.
 */

import type { CookieJarEntryWire } from '@openheaders/core/bridge';

/** Parsed `Set-Cookie` fields the jar consumes — the transport maps
 *  undici's `getSetCookies` records down to this plain shape. */
export interface SetCookieInput {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
}

interface StoredCookie {
  name: string;
  value: string;
  /** Lowercase, no leading dot. */
  domain: string;
  /** True when no `Domain` attribute was set — exact-host match only. */
  hostOnly: boolean;
  path: string;
  secure: boolean;
  /** Epoch ms; `undefined` = session cookie (lives as long as the jar). */
  expiresAt?: number;
  /** Insertion tick for attach ordering + oldest-first eviction. */
  storedAt: number;
}

/** Ceiling on cookies held per jar — a runaway Set-Cookie source must
 *  not grow the always-on process without bound. */
const MAX_COOKIES_PER_JAR = 512;

/** Host `host` domain-matches cookie domain `domain` (RFC 6265 §5.1.3,
 *  minus the IP-address carve-out). Both already lowercase. */
function domainMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Request path `requestPath` path-matches cookie path `cookiePath`
 *  (RFC 6265 §5.1.4): equal, or a prefix that ends at a `/` boundary. */
function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true;
  if (!requestPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith('/') || requestPath[cookiePath.length] === '/';
}

/** Default cookie path for a request URL (RFC 6265 §5.1.4): the URL's
 *  path up to but not including its rightmost `/`, else `/`. */
function defaultPath(urlPath: string): string {
  if (!urlPath.startsWith('/')) return '/';
  const lastSlash = urlPath.lastIndexOf('/');
  return lastSlash > 0 ? urlPath.slice(0, lastSlash) : '/';
}

export class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();

  /** Monotonic insertion counter — steadier than a timestamp for
   *  same-millisecond ordering. */
  private tick = 0;

  /**
   * Store the parsed `Set-Cookie` records a response at `url` carried.
   * Returns the names actually stored (rejected and deleted-by-expiry
   * records are excluded) so the send can report what it wrote.
   */
  store(url: string, incoming: ReadonlyArray<SetCookieInput>): string[] {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const stored: string[] = [];
    for (const cookie of incoming) {
      if (!cookie.name) continue;
      let domain = host;
      let hostOnly = true;
      if (cookie.domain !== undefined && cookie.domain !== '') {
        const candidate = cookie.domain.replace(/^\./, '').toLowerCase();
        // A Domain the setting host doesn't fall under is a cookie for
        // someone else — reject it outright.
        if (candidate === '' || !domainMatches(host, candidate)) continue;
        domain = candidate;
        hostOnly = false;
      }
      const path =
        cookie.path !== undefined && cookie.path.startsWith('/') ? cookie.path : defaultPath(parsed.pathname);
      const key = `${cookie.name}|${domain}|${path}`;
      // Max-Age wins over Expires; a non-positive Max-Age or a past
      // Expires is the spec's deletion idiom.
      let expiresAt: number | undefined;
      if (cookie.maxAge !== undefined) {
        if (cookie.maxAge <= 0) {
          this.cookies.delete(key);
          continue;
        }
        expiresAt = Date.now() + cookie.maxAge * 1000;
      } else if (cookie.expires !== undefined) {
        expiresAt = cookie.expires.getTime();
        if (expiresAt <= Date.now()) {
          this.cookies.delete(key);
          continue;
        }
      }
      this.cookies.set(key, {
        name: cookie.name,
        value: cookie.value,
        domain,
        hostOnly,
        path,
        secure: cookie.secure === true,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        storedAt: this.tick++,
      });
      stored.push(cookie.name);
      this.enforceBound();
    }
    return stored;
  }

  /**
   * The `Cookie` header value for a send to `url`, or `undefined` when
   * nothing matches. Longer paths come first, ties by earliest stored —
   * the spec's serialization order.
   */
  cookieHeaderFor(url: string): string | undefined {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const secureChannel = parsed.protocol === 'https:';
    const now = Date.now();
    const matches: StoredCookie[] = [];
    for (const [key, cookie] of this.cookies) {
      if (cookie.expiresAt !== undefined && cookie.expiresAt <= now) {
        this.cookies.delete(key);
        continue;
      }
      if (cookie.hostOnly ? host !== cookie.domain : !domainMatches(host, cookie.domain)) continue;
      if (!pathMatches(parsed.pathname, cookie.path)) continue;
      if (cookie.secure && !secureChannel) continue;
      matches.push(cookie);
    }
    if (matches.length === 0) return undefined;
    matches.sort((a, b) => b.path.length - a.path.length || a.storedAt - b.storedAt);
    return matches.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  clear(): void {
    this.cookies.clear();
  }

  /**
   * Drop one entry by its replacement identity (name, domain, path) —
   * per-entry management beside `clear`. Runs the same lazy expiry
   * sweep an attach does; a miss is a quiet no-op.
   */
  delete(name: string, domain: string, path: string): void {
    const now = Date.now();
    for (const [key, cookie] of this.cookies) {
      if (cookie.expiresAt !== undefined && cookie.expiresAt <= now) this.cookies.delete(key);
    }
    this.cookies.delete(`${name}|${domain}|${path}`);
  }

  /**
   * The jar's live entries for the inspection surface, in storage
   * order, with the same lazy expiry sweep an attach runs. Cookie
   * VALUES stay behind by construction — they are session credentials
   * and only the attach path may read them.
   */
  list(): CookieJarEntryWire[] {
    const now = Date.now();
    const entries: CookieJarEntryWire[] = [];
    for (const [key, cookie] of this.cookies) {
      if (cookie.expiresAt !== undefined && cookie.expiresAt <= now) {
        this.cookies.delete(key);
        continue;
      }
      entries.push({
        name: cookie.name,
        domain: cookie.domain,
        hostOnly: cookie.hostOnly,
        path: cookie.path,
        secure: cookie.secure,
        ...(cookie.expiresAt !== undefined ? { expiresAt: cookie.expiresAt } : {}),
      });
    }
    return entries;
  }

  /** Drop expired entries first, then the oldest stored, until the jar
   *  fits its bound again. */
  private enforceBound(): void {
    if (this.cookies.size <= MAX_COOKIES_PER_JAR) return;
    const now = Date.now();
    for (const [key, cookie] of this.cookies) {
      if (cookie.expiresAt !== undefined && cookie.expiresAt <= now) this.cookies.delete(key);
    }
    while (this.cookies.size > MAX_COOKIES_PER_JAR) {
      let oldestKey: string | undefined;
      let oldestTick = Number.POSITIVE_INFINITY;
      for (const [key, cookie] of this.cookies) {
        if (cookie.storedAt < oldestTick) {
          oldestTick = cookie.storedAt;
          oldestKey = key;
        }
      }
      if (oldestKey === undefined) return;
      this.cookies.delete(oldestKey);
    }
  }
}

/** Jars by key (the workspace id) — created on first use, retained for
 *  the process lifetime like the transport's dispatcher cache. */
const jars = new Map<string, CookieJar>();

export function cookieJarFor(key: string): CookieJar {
  let jar = jars.get(key);
  if (!jar) {
    jar = new CookieJar();
    jars.set(key, jar);
  }
  return jar;
}

/** The jar under `key` if one was ever minted — the inspection surface
 *  reads through this so a lookup never creates an empty jar. */
export function peekCookieJar(key: string): CookieJar | undefined {
  return jars.get(key);
}

/** Drop every jar — test isolation only. */
export function resetCookieJars(): void {
  jars.clear();
}
