/**
 * Reading a pasted cookie for the Add cookie form — pure; the one
 * function that looks at the jar ({@link planPastedCookies}) is handed it.
 *
 * Two header shapes arrive on the clipboard: a `Set-Cookie` value (ONE
 * cookie plus the attributes it states) and a `Cookie` value (names and
 * values only, usually several). A leading header name decides the
 * shape outright; without one the text is a `Set-Cookie` when every
 * part after the first is a known attribute, a `Cookie` header as soon
 * as one part isn't.
 *
 * Parts split on `;` only — an `Expires` date carries a comma — and a
 * pair splits on its FIRST `=`, so a value may hold more of them.
 * Values pass through verbatim: no percent-decoding, quotes kept.
 */

import { type CookieEditFormValues, jarCookieToEditForm, normalizeSameSite, predictedJarKey } from './cookie-edit';
import { parseSetCookieLine } from './cookie-enrich';
import type { SiteJarCookie } from './cookie-jar-cache';
import type { CookieRow } from './cookie-model';

export interface PastedCookie {
  name: string;
  value: string;
  /** The parsed line when the text was a `Set-Cookie` — everything the
   *  form takes from it. Absent for a bare name and value. */
  stated?: CookieRow;
  /** Attributes the line carried that the form has no use for (or
   *  couldn't read), as written. */
  ignored: string[];
}

const HEADER_PREFIX = /^(set-cookie|cookie)\s*[:\t]\s*/i;
const APPLIED_ATTRIBUTES = new Set(['domain', 'path', 'expires', 'max-age', 'secure', 'httponly', 'samesite']);
const KNOWN_ATTRIBUTES = new Set([...APPLIED_ATTRIBUTES, 'partitioned', 'priority']);
const SAME_SITE_VALUES = new Set(['none', 'lax', 'strict']);

function attributeName(part: string): string {
  const eq = part.indexOf('=');
  return (eq >= 0 ? part.slice(0, eq) : part).trim().toLowerCase();
}

function attributeValue(part: string): string {
  const eq = part.indexOf('=');
  return eq >= 0 ? part.slice(eq + 1).trim() : '';
}

function readPair(part: string): { name: string; value: string } | null {
  const eq = part.indexOf('=');
  if (eq <= 0) return null;
  const name = part.slice(0, eq).trim();
  return name === '' ? null : { name, value: part.slice(eq + 1).trim() };
}

function isIgnored(part: string, row: CookieRow): boolean {
  const name = attributeName(part);
  if (!APPLIED_ATTRIBUTES.has(name)) return true;
  if (name === 'expires') return row.expirationDate === undefined;
  if (name === 'max-age') return row.maxAge === undefined;
  if (name === 'samesite') return !SAME_SITE_VALUES.has(attributeValue(part).toLowerCase());
  return false;
}

function readLine(line: string, now: number): PastedCookie[] {
  const prefix = HEADER_PREFIX.exec(line);
  const header = prefix?.[1].toLowerCase();
  const parts = (prefix ? line.slice(prefix[0].length) : line)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0 || readPair(parts[0]) === null) return [];

  const rest = parts.slice(1);
  const isSetCookie =
    header === 'set-cookie' ||
    (header === undefined && rest.length > 0 && rest.every((part) => KNOWN_ATTRIBUTES.has(attributeName(part))));

  if (isSetCookie) {
    const row = parseSetCookieLine(parts.join('; '), now);
    if (row === null) return [];
    return [
      { name: row.name, value: row.value.trim(), stated: row, ignored: rest.filter((part) => isIgnored(part, row)) },
    ];
  }

  // A `Cookie` header — one name is sent once per matching jar entry,
  // most specific first, so a repeat keeps its first value.
  const cookies: PastedCookie[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const pair = readPair(part);
    if (pair === null || seen.has(pair.name)) continue;
    seen.add(pair.name);
    cookies.push({ ...pair, ignored: [] });
  }
  return cookies;
}

/**
 * Every cookie the pasted text holds — empty when none could be read,
 * one for a `Set-Cookie` line or a single pair, several for a `Cookie`
 * header or a run of lines.
 */
export function readCookiePaste(text: string, now: number = Date.now()): PastedCookie[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => readLine(line, now));
}

/**
 * The form after a paste. The paste overwrites exactly what it states:
 * a `Set-Cookie` line states the whole cookie, so an attribute it
 * leaves out lands on its spec default (session, flags off) — except
 * Domain, where "left out" means host-only on the host the form already
 * names. A bare pair states a name and a value and nothing else.
 */
export function applyPastedCookie(form: CookieEditFormValues, pasted: PastedCookie): CookieEditFormValues {
  const { stated } = pasted;
  if (stated === undefined) return { ...form, name: pasted.name, value: pasted.value };

  const domain = (stated.domain ?? '').trim().replace(/^\./, '');
  const next: CookieEditFormValues = {
    ...form,
    name: pasted.name,
    value: pasted.value,
    domain: domain === '' ? form.domain : domain,
    hostOnly: domain === '',
    path: stated.path?.trim() || '/',
    httpOnly: stated.httpOnly === true,
    secure: stated.secure === true,
    sameSite: normalizeSameSite(stated.sameSite),
    session: stated.expirationDate === undefined,
  };
  if (stated.expirationDate === undefined) delete next.expirationDate;
  else next.expirationDate = stated.expirationDate;
  return next;
}

export interface PastePlanRow {
  pasted: PastedCookie;
  /** What Save writes for this cookie. */
  form: CookieEditFormValues;
  /** The write lands on a cookie the jar already holds. */
  replaces: boolean;
}

/** The jar cookie a `Cookie` header's value for this name came from —
 *  the browser sends the most specific first (longest path, then
 *  host-only), and a repeated name kept its first value. */
function heldCookie(name: string, jar: readonly SiteJarCookie[]): SiteJarCookie | undefined {
  return jar
    .filter((c) => c.sendable && c.name === name)
    .sort((a, b) => b.path.length - a.path.length || Number(b.hostOnly) - Number(a.hostOnly))[0];
}

/**
 * What saving a pasted batch writes, one row per cookie.
 *
 * A `Cookie` header carries names and values only. A name the jar
 * already holds keeps that cookie's identity and attributes and takes
 * just the new value — writing it under the shared attributes instead
 * would add a second cookie of the same name beside the first. A name
 * the jar doesn't hold is a new cookie under `shared`. A `Set-Cookie`
 * line states its own attributes and is written as stated.
 */
export function planPastedCookies(
  cookies: readonly PastedCookie[],
  shared: CookieEditFormValues,
  jar: readonly SiteJarCookie[],
): PastePlanRow[] {
  return cookies.map((pasted) => {
    const held = pasted.stated === undefined ? heldCookie(pasted.name, jar) : undefined;
    const form =
      held !== undefined ? { ...jarCookieToEditForm(held), value: pasted.value } : applyPastedCookie(shared, pasted);
    const key = predictedJarKey(form);
    const replaces = jar.some(
      (c) =>
        c.name === key.name &&
        c.domain === key.domain &&
        (c.path || '/') === key.path &&
        (c.partitionKey ?? '') === (key.partitionKey ?? ''),
    );
    return { pasted, form, replaces };
  });
}

/** Whether Save would write a cookie the browser drops on arrival. */
export function isEditFormExpired(form: CookieEditFormValues, now: number = Date.now()): boolean {
  return !form.session && form.expirationDate !== undefined && form.expirationDate * 1000 <= now;
}
