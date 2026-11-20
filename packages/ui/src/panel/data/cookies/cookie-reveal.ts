/**
 * Which Storage rows a `Cookie` / `Set-Cookie` header line points at —
 * the jar rows its "Show in Storage" gesture highlights. Pure: the
 * caller hands in the site jar read through the request's own URL.
 *
 * A `Cookie` header names what was SENT, so its rows are the jar
 * cookies of those names the browser attaches to that URL — one name
 * can be several rows (differing domain / path), all of them sent.
 * A `Set-Cookie` line names ONE cookie; where it left Domain or Path
 * out, every jar cookie of that name it could have produced qualifies —
 * a highlight can afford the ambiguity an Edit target can't.
 */

import { parseSetCookieLine, responseJarCandidates } from './cookie-enrich';
import { jarCookieRowKey, type SiteJarCookie } from './cookie-jar-cache';
import { readCookiePaste } from './cookie-paste';

export type CookieHeaderDirection = 'request' | 'response';

export interface CookieRevealTarget {
  /** Jar row keys ({@link jarCookieRowKey}) to highlight. */
  rows: readonly string[];
  /** The request's origin — the Storage scope to show them under, when
   *  the page has a frame on it. */
  origin: string;
}

export function isCookieHeader(name: string, direction: CookieHeaderDirection): boolean {
  return name.toLowerCase() === (direction === 'request' ? 'cookie' : 'set-cookie');
}

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function cookieRevealTarget(
  direction: CookieHeaderDirection,
  value: string,
  requestUrl: string,
  siteJar: readonly SiteJarCookie[],
): CookieRevealTarget {
  const origin = originOf(requestUrl);
  if (direction === 'response') {
    const row = parseSetCookieLine(value);
    return { rows: row === null ? [] : responseJarCandidates(siteJar, row).map(jarCookieRowKey), origin };
  }
  const names = new Set(readCookiePaste(`Cookie: ${value}`).map((cookie) => cookie.name));
  return { rows: siteJar.filter((c) => c.sendable && names.has(c.name)).map(jarCookieRowKey), origin };
}
