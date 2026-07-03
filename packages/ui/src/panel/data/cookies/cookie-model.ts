/**
 * Shared cookie types for the Cookies tab.
 *
 * The HAR shape (`request.cookies[]`) only carries name + value for
 * request cookies. Set-Cookie response headers carry everything by
 * spec. We enrich request cookies against the browser jar (when a
 * host-installed fetcher is wired) so both directions have a uniform
 * `CookieRow` shape.
 */

import type { JarCookie } from './cookie-jar-cache';

export type CookieDirection = 'request' | 'response';

/**
 * Where the per-row data came from. Used by the filter grammar and
 * by chips that say "Sent but not in this Set-Cookie" / "Set but
 * blocked from being sent" / "Jar attribute".
 */
export type CookieAttributionKind =
  // Sent on the request, attributes joined from the browser jar.
  | 'request-jar'
  // Sent on the request, no jar match (jar fetcher absent or cleared).
  | 'request-har'
  // Set-Cookie line on this response.
  | 'response-set'
  // Jar cookie that would normally be sent on this URL but wasn't —
  // surfaced when "show filtered out" is on.
  | 'filtered-out';

export type CookieSameSite = 'no_restriction' | 'lax' | 'strict' | 'unspecified';

export interface CookieRow {
  name: string;
  value: string;
  direction: CookieDirection;
  attribution: CookieAttributionKind;
  /** Stable per-row id — name + a disambiguator for repeat names with
   *  different paths/domains. */
  id: string;
  domain?: string;
  path?: string;
  /** Unix seconds. `undefined` ⇒ session cookie. */
  expirationDate?: number;
  /** Raw `Expires=` value as it appeared in the Set-Cookie line, when
   *  we couldn't parse it. Falls back to the formatter. */
  expiresRaw?: string;
  /** Raw `Max-Age=` value as it appeared, kept for display when
   *  expirationDate isn't derivable. */
  maxAge?: number;
  hostOnly?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: CookieSameSite | string;
  session?: boolean;
  partitionKey?: string;
  /** Cookie size in bytes (name + '=' + value), matches what browsers
   *  cap per-cookie. */
  size: number;
  /** `High` / `Medium` / `Low` if the server sent a `Priority=` attribute.
   *  Non-standard but Chrome shows it. */
  priority?: string;
  /** Why this jar cookie wasn't sent — only set when `attribution`
   *  is `filtered-out`. */
  filteredReason?: string;
  /** This cookie was added/edited from the panel this session — drives
   *  the grey status square and makes the Value cell show the live jar
   *  value instead of the request-carried one. */
  edited?: boolean;
  /** The value the request actually carried, kept for the tooltip when
   *  `value` is showing the (edited) live-jar value instead. */
  sentValue?: string;
}

export interface CookieFootprint {
  sent: number;
  set: number;
  filteredOut: number;
  problems: number;
  ruleModified: number;
}

export function jarToRow(c: JarCookie, direction: CookieDirection, attribution: CookieAttributionKind): CookieRow {
  return {
    name: c.name,
    value: c.value,
    direction,
    attribution,
    id: `${direction}:${attribution}:${c.domain}${c.path}:${c.name}`,
    domain: c.domain,
    path: c.path,
    ...(c.expirationDate != null ? { expirationDate: c.expirationDate } : {}),
    hostOnly: c.hostOnly,
    httpOnly: c.httpOnly,
    secure: c.secure,
    ...(c.sameSite ? { sameSite: c.sameSite } : {}),
    session: c.session,
    ...(c.partitionKey ? { partitionKey: c.partitionKey } : {}),
    size: c.name.length + 1 + c.value.length,
  };
}
