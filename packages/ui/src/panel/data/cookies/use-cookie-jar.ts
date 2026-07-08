/**
 * Hook for the Cookies tab — synchronously returns the jar cookies for
 * a URL when the cache has them, kicks off a background fetch when it
 * doesn't, and re-renders the consumer when the fetch settles.
 *
 * Mirrors `use-resolved-frames.ts` so both tabs follow the same
 * pattern for "renderer asks for platform-specific data".
 */

import { useEffect, useReducer, useRef } from 'react';
import {
  getJarCookiesForUrl,
  getSiteJarCookiesForUrl,
  type JarCookie,
  type SiteJarCookie,
  subscribeCookieJar,
} from './cookie-jar-cache';

export function useCookieJar(url: string): readonly JarCookie[] | null {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeCookieJar(force), [force]);
  return getJarCookiesForUrl(url);
}

function jarCookiesEqual(a: readonly JarCookie[], b: readonly JarCookie[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((c, i) => {
    const o = b[i];
    return (
      c.name === o.name &&
      c.value === o.value &&
      c.domain === o.domain &&
      c.path === o.path &&
      c.expirationDate === o.expirationDate &&
      c.hostOnly === o.hostOnly &&
      c.httpOnly === o.httpOnly &&
      c.secure === o.secure &&
      c.sameSite === o.sameSite &&
      c.session === o.session &&
      c.partitionKey === o.partitionKey &&
      c.storeId === o.storeId
    );
  });
}

/**
 * Poll-friendly variant for surfaces that refresh by invalidating the
 * jar cache on a cadence (the Storage tool window's Cookies section).
 * An invalidation makes the raw lookup `null` for the round-trip of the
 * refetch — this hook keeps the last resolved list rendered through
 * that gap, and keeps the ARRAY IDENTITY stable when a refetch returns
 * structurally identical data, so polled consumers don't re-render (or
 * cascade effects) on every tick.
 */
export function useCookieJarSticky(url: string): readonly JarCookie[] | null {
  const live = useCookieJar(url);
  const heldRef = useRef<{ url: string; cookies: readonly JarCookie[] } | null>(null);
  const held = heldRef.current;
  if (live !== null) {
    if (!(held && held.url === url && jarCookiesEqual(held.cookies, live))) {
      heldRef.current = { url, cookies: live };
    }
    return heldRef.current?.cookies ?? live;
  }
  return held && held.url === url ? held.cookies : null;
}

function siteJarCookiesEqual(a: readonly SiteJarCookie[], b: readonly SiteJarCookie[]): boolean {
  return jarCookiesEqual(a, b) && a.every((c, i) => c.sendable === b[i].sendable);
}

/**
 * Site-scoped twin of {@link useCookieJarSticky} — the Storage tool
 * window's Cookies section reads the site-wide jar (with per-row
 * `sendable`) through the same hold-through-invalidation and stable-
 * identity discipline.
 */
export function useSiteCookieJarSticky(url: string): readonly SiteJarCookie[] | null {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeCookieJar(force), [force]);
  const live = getSiteJarCookiesForUrl(url);
  const heldRef = useRef<{ url: string; cookies: readonly SiteJarCookie[] } | null>(null);
  const held = heldRef.current;
  if (live !== null) {
    if (!(held && held.url === url && siteJarCookiesEqual(held.cookies, live))) {
      heldRef.current = { url, cookies: live };
    }
    return heldRef.current?.cookies ?? live;
  }
  return held && held.url === url ? held.cookies : null;
}
