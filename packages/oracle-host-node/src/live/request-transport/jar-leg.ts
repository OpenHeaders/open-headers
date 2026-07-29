/**
 * The cookie jar's per-hop legs — attach the jar's `Cookie`
 * contribution to an outgoing hop and store an answering hop's
 * `Set-Cookie` values. The jar itself (matching, expiry, isolation per
 * key) lives in `cookie-jar.ts`; this module is the transport-side
 * policy of when the jar speaks and what the send reports about it.
 */

import type { TransportHeader } from '@openheaders/oracle/live/request-exec/transport';
import { getSetCookies, type Headers } from 'undici';
import type { CookieJar, SetCookieInput } from '../cookie-jar';
import type { HopState } from './seam';

/** What the jar did during one send — reported on the response so the
 *  executed-run snapshot can record it. */
export interface JarActivity {
  /** `Cookie` header value attached to the FIRST hop, when any. */
  cookieHeaderAttached?: string;
  /** Names stored from `Set-Cookie` across the chain, arrival order. */
  cookiesCaptured: string[];
}

/**
 * A hop's headers with the jar's `Cookie` contribution appended — or
 * untouched when the jar matches nothing for this URL, or when the hop
 * already carries a Cookie header (a user-set header always wins; the
 * jar only fills the gap).
 */
export function withJarCookie(
  jar: CookieJar,
  hop: HopState,
): { headers: ReadonlyArray<TransportHeader>; attached?: string } {
  if (hop.headers.some((h) => h.key.toLowerCase() === 'cookie')) return { headers: hop.headers };
  const value = jar.cookieHeaderFor(hop.url);
  if (value === undefined) return { headers: hop.headers };
  return { headers: [...hop.headers, { key: 'Cookie', value }], attached: value };
}

/**
 * Store a hop response's `Set-Cookie` values into the jar, returning
 * the names stored. undici's `getSetCookies` does the attribute
 * parsing (fetch `Headers` would otherwise join multiple `Set-Cookie`
 * values into one unsplittable string); the jar owns matching and
 * expiry.
 */
export function captureJarCookies(jar: CookieJar, url: string, headers: Headers): string[] {
  const incoming: SetCookieInput[] = getSetCookies(headers).map((c) => ({
    name: c.name,
    value: c.value,
    ...(c.domain !== undefined && c.domain !== null ? { domain: c.domain } : {}),
    ...(c.path !== undefined && c.path !== null ? { path: c.path } : {}),
    ...(c.expires !== undefined && c.expires !== null
      ? { expires: c.expires instanceof Date ? c.expires : new Date(c.expires) }
      : {}),
    ...(c.maxAge !== undefined && c.maxAge !== null ? { maxAge: c.maxAge } : {}),
    ...(c.secure !== undefined && c.secure !== null ? { secure: c.secure } : {}),
  }));
  if (incoming.length === 0) return [];
  return jar.store(url, incoming);
}
