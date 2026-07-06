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
