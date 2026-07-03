/**
 * Hook for the Cookies tab — synchronously returns the jar cookies for
 * a URL when the cache has them, kicks off a background fetch when it
 * doesn't, and re-renders the consumer when the fetch settles.
 *
 * Mirrors `use-resolved-frames.ts` so both tabs follow the same
 * pattern for "renderer asks for platform-specific data".
 */

import { useEffect, useReducer } from 'react';
import { getJarCookiesForUrl, type JarCookie, subscribeCookieJar } from './cookie-jar-cache';

export function useCookieJar(url: string): readonly JarCookie[] | null {
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribeCookieJar(force), [force]);
  return getJarCookiesForUrl(url);
}
