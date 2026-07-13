/**
 * Pure helpers for the response Cookies tab — locate the snapshot's raw
 * `Set-Cookie` lines, parse them into name / value / attribute rows,
 * and word the honest persistence note for what the runtime actually
 * did with the cookies.
 *
 * The lines live in one of two places, one per runtime: browser
 * runtimes capture them at the wire-interception layer (`fetch()`
 * strips Set-Cookie as a forbidden response header) onto
 * `snapshot.wire.setCookieHeaders`; node runtimes expose them directly
 * in `snapshot.headers` (undici withholds nothing). Persistence differs
 * the same way — the browser's cookie store under the send's
 * credentials mode vs the opt-in workspace cookie jar, attributed by
 * `cookiesCaptured` on the snapshot.
 *
 * Parsing is display-oriented and forgiving: the wire line is the
 * source of truth (kept as `raw`), so a malformed line still renders —
 * nothing is dropped or corrected.
 */

import type { CredentialsMode, ExecutedRequestSnapshot } from '@openheaders/core/types';
import type { Translate } from '@openheaders/ui/context/LocaleContext';

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
 * The snapshot's raw `Set-Cookie` lines, wherever its runtime put them:
 * the browser wire capture when one exists (fetch strips the header
 * from the snapshot's list, so the capture is the only witness), else
 * the header rows themselves (node runtimes carry the lines verbatim,
 * one row per cookie). Empty when the response set no cookies.
 */
export function setCookieLinesOf(response: ExecutedRequestSnapshot): string[] {
  const wireLines = response.wire?.setCookieHeaders;
  if (wireLines && wireLines.length > 0) return [...wireLines];
  return response.headers.filter((h) => h.key.toLowerCase() === 'set-cookie').map((h) => h.value);
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

/** Host name of the response's final URL — the Domain fallback. No
 *  port: cookie domains scope by host name only (RFC 6265). */
export function hostOfUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Honest persistence line under the grid: what the browser DID with
 * these cookies, which depends on the send's cookie policy, not on the
 * response.
 */
export function cookiePersistenceNote(credentialsMode: CredentialsMode, t: Translate): string {
  if (credentialsMode === 'include') {
    return t('workbench.editors.request.response.cookies.noteCredentialsInclude');
  }
  return t('workbench.editors.request.response.cookies.noteCredentialsOmit');
}

/**
 * The node-runtime counterpart: what the workspace cookie jar did,
 * read from the snapshot's own attribution (`cookiesCaptured` — the
 * names the jar stored across every hop of the chain), never from live
 * jar state. `rowNames` are the cookie names visible in the grid — a
 * captured name missing from them arrived on an intermediate redirect
 * hop, whose Set-Cookie lines the snapshot's headers (final hop only)
 * don't carry, and the note says so.
 */
export function jarPersistenceNote(
  cookiesCaptured: readonly string[] | undefined,
  rowNames: readonly string[],
  t: Translate,
): string {
  if (cookiesCaptured === undefined || cookiesCaptured.length === 0) {
    return t('workbench.editors.request.response.cookies.noteJarOff');
  }
  const names = cookiesCaptured.join(', ');
  const midChain = cookiesCaptured.some((name) => !rowNames.includes(name));
  return midChain
    ? t('workbench.editors.request.response.cookies.noteJarStoredMidChain', { names })
    : t('workbench.editors.request.response.cookies.noteJarStored', { names });
}

/**
 * The persistence note for a snapshot, whichever runtime produced it —
 * a wire capture carries the browser's credentials mode; without one
 * the send ran on a node runtime, where storage is the opt-in cookie
 * jar attributed on the snapshot itself.
 */
export function persistenceNoteFor(
  response: ExecutedRequestSnapshot,
  rowNames: readonly string[],
  t: Translate,
): string {
  if (response.wire) return cookiePersistenceNote(response.wire.credentialsMode, t);
  return jarPersistenceNote(response.cookiesCaptured, rowNames, t);
}
