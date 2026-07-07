/**
 * Pure helpers for the response Cookies tab — parse raw `Set-Cookie`
 * lines (captured verbatim at the wire by the executor's wire capture)
 * into name / value / attribute rows, and word the honest persistence
 * note for the credentials mode the request ran under.
 *
 * Parsing is display-oriented and forgiving: the wire line is the
 * source of truth (kept as `raw`), so a malformed line still renders —
 * nothing is dropped or corrected.
 */

import type { CredentialsMode } from '@openheaders/core/types';

export interface SetCookieAttribute {
  key: string;
  /** Absent for flag attributes (Secure, HttpOnly, Partitioned). */
  value?: string;
}

export interface ParsedSetCookie {
  name: string;
  value: string;
  attributes: SetCookieAttribute[];
  /** The wire line verbatim — what copy copies. */
  raw: string;
}

export function parseSetCookieLine(raw: string): ParsedSetCookie {
  const segments = raw.split(';');
  const pair = segments[0] ?? '';
  const eq = pair.indexOf('=');
  const name = (eq >= 0 ? pair.slice(0, eq) : pair).trim();
  const value = eq >= 0 ? pair.slice(eq + 1).trim() : '';
  const attributes: SetCookieAttribute[] = [];
  for (const segment of segments.slice(1)) {
    const trimmed = segment.trim();
    if (trimmed === '') continue;
    const attrEq = trimmed.indexOf('=');
    if (attrEq >= 0) {
      attributes.push({ key: trimmed.slice(0, attrEq).trim(), value: trimmed.slice(attrEq + 1).trim() });
    } else {
      attributes.push({ key: trimmed });
    }
  }
  return { name, value, attributes, raw };
}

export function parseSetCookieLines(lines: readonly string[]): ParsedSetCookie[] {
  return lines.map(parseSetCookieLine);
}

/** Columnar view of one cookie, derived at consume from the raw line —
 *  the shape the grid renders (one attribute per column, RFC defaults
 *  filled in explicitly). */
export interface CookieGridRow {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** `Expires` verbatim, else `Max-Age` as `Max-Age=n`, else `Session`. */
  expires: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  /** The wire line verbatim — what copy copies. */
  raw: string;
}

function attributeValue(cookie: ParsedSetCookie, key: string): string | undefined {
  const hit = cookie.attributes.find((a) => a.key.toLowerCase() === key.toLowerCase());
  return hit ? (hit.value ?? '') : undefined;
}

/**
 * Derive the grid columns for one parsed cookie. `requestHost` fills
 * the Domain column when the line carries no `Domain` attribute — per
 * RFC 6265 such a cookie is host-only, scoped to the request host.
 */
export function toCookieGridRow(cookie: ParsedSetCookie, requestHost: string): CookieGridRow {
  const maxAge = attributeValue(cookie, 'Max-Age');
  const expiresAttr = attributeValue(cookie, 'Expires');
  return {
    name: cookie.name,
    value: cookie.value,
    domain: attributeValue(cookie, 'Domain') || requestHost,
    path: attributeValue(cookie, 'Path') || '/',
    expires: expiresAttr || (maxAge !== undefined ? `Max-Age=${maxAge}` : 'Session'),
    httpOnly: attributeValue(cookie, 'HttpOnly') !== undefined,
    secure: attributeValue(cookie, 'Secure') !== undefined,
    sameSite: attributeValue(cookie, 'SameSite') || '—',
    raw: cookie.raw,
  };
}

/** Host of the response's final URL — the Domain fallback. */
export function hostOfUrl(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * Honest persistence line under the grid: what the browser DID with
 * these cookies, which depends on the send's cookie policy, not on the
 * response.
 */
export function cookiePersistenceNote(credentialsMode: CredentialsMode): string {
  if (credentialsMode === 'include') {
    return 'This request ran with credentials included, so the browser may have stored these cookies (subject to each cookie’s own attributes) and will send them on future credentialed requests.';
  }
  return 'The server sent these cookies, but this request ran with credentials omitted (the default), so the browser discarded them — nothing was stored.';
}
