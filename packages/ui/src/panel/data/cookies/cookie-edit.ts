/**
 * Pure form-model helpers for the Cookies tab's add / edit modal.
 *
 * The modal edits a {@link CookieEditFormValues} — a flat, fully-defined
 * shape (no optional-vs-absent ambiguity beyond `expirationDate`) so the
 * `isDirty` check is a plain structural compare against the canonical
 * snapshot the modal opened with. Nothing here touches the browser jar;
 * the seam in `cookie-jar-cache` does the write.
 */

import type { JarCookie, JarCookieEdit, JarCookieKey } from './cookie-jar-cache';
import { type CookieRow, jarToRow } from './cookie-model';

export type CookieSameSiteValue = 'unspecified' | 'no_restriction' | 'lax' | 'strict';

/** Display vocabulary for the SameSite enum — the edit grid's options
 *  and the conflict chips read the same labels. */
export const COOKIE_SAME_SITE_LABELS: Record<CookieSameSiteValue, string> = {
  unspecified: 'Unspecified',
  no_restriction: 'None (cross-site)',
  lax: 'Lax',
  strict: 'Strict',
};

export interface CookieEditFormValues {
  name: string;
  value: string;
  domain: string;
  path: string;
  /** Host-only ⇒ the writer omits the Domain attribute. */
  hostOnly: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite: CookieSameSiteValue;
  /** `true` ⇒ session cookie (no expiration). */
  session: boolean;
  /** Unix seconds; meaningful only when `session` is false. */
  expirationDate?: number;
  /** Carried through unchanged so editing a partitioned cookie keeps its
   *  partition; not surfaced as an input in v1. */
  partitionKey?: string;
  storeId?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Unix seconds → `datetime-local` value in the user's local zone. Both
 *  the edit grid's date input and the Expires conflict projection use
 *  this rendering, so the two can never disagree on what a date "is". */
export function expirationToLocalInput(sec: number | undefined): string {
  if (sec == null) return '';
  const d = new Date(sec * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function expirationFromLocalInput(s: string): number | undefined {
  if (!s) return undefined;
  const ms = new Date(s).getTime();
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

function normalizeSameSite(raw: string | undefined): CookieSameSiteValue {
  switch (raw) {
    case 'no_restriction':
    case 'lax':
    case 'strict':
      return raw;
    default:
      return 'unspecified';
  }
}

/** Canonical form values for an existing row — the modal's "before". */
export function rowToEditForm(row: CookieRow): CookieEditFormValues {
  return {
    name: row.name,
    value: row.value,
    domain: row.domain ?? '',
    path: row.path || '/',
    hostOnly: !!row.hostOnly,
    httpOnly: !!row.httpOnly,
    secure: !!row.secure,
    sameSite: normalizeSameSite(row.sameSite ? String(row.sameSite) : undefined),
    session: row.expirationDate == null,
    ...(row.expirationDate != null ? { expirationDate: row.expirationDate } : {}),
    ...(row.partitionKey ? { partitionKey: row.partitionKey } : {}),
    ...(row.storeId ? { storeId: row.storeId } : {}),
  };
}

/** Canonical form values for a jar cookie edited outside a request
 *  context (the Storage tool window's Cookies section) — same derivation
 *  rules as {@link rowToEditForm}, straight off the jar entry. */
export function jarCookieToEditForm(c: JarCookie): CookieEditFormValues {
  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path || '/',
    hostOnly: c.hostOnly,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: normalizeSameSite(c.sameSite),
    session: c.expirationDate == null,
    ...(c.expirationDate != null ? { expirationDate: c.expirationDate } : {}),
    ...(c.partitionKey ? { partitionKey: c.partitionKey } : {}),
    ...(c.storeId ? { storeId: c.storeId } : {}),
  };
}

/** Identity a jar cookie's Delete gesture removes. */
export function jarCookieToKey(c: JarCookie): JarCookieKey {
  return {
    name: c.name,
    domain: c.domain,
    path: c.path || '/',
    secure: c.secure,
    ...(c.partitionKey ? { partitionKey: c.partitionKey } : {}),
    ...(c.storeId ? { storeId: c.storeId } : {}),
  };
}

/** Blank form for adding a cookie, seeded from the inspected request. */
export function emptyEditForm(seed: { domain?: string; secure?: boolean } = {}): CookieEditFormValues {
  return {
    name: '',
    value: '',
    domain: seed.domain ?? '',
    path: '/',
    hostOnly: true,
    httpOnly: false,
    secure: seed.secure ?? true,
    sameSite: 'lax',
    session: true,
  };
}

/** The write payload — session drops `expirationDate`, unspecified drops
 *  `sameSite` so the browser sets the cookie without the attribute. */
export function formToEdit(v: CookieEditFormValues): JarCookieEdit {
  return {
    name: v.name.trim(),
    value: v.value,
    domain: v.domain.trim(),
    path: v.path.trim() || '/',
    hostOnly: v.hostOnly,
    httpOnly: v.httpOnly,
    secure: v.secure,
    ...(v.sameSite !== 'unspecified' ? { sameSite: v.sameSite } : {}),
    ...(!v.session && v.expirationDate != null ? { expirationDate: v.expirationDate } : {}),
    ...(v.partitionKey ? { partitionKey: v.partitionKey } : {}),
    ...(v.storeId ? { storeId: v.storeId } : {}),
  };
}

/**
 * The jar identity a Save of this form will land on. Mirrors the
 * writer's rules: a host-only cookie is pinned to the bare host (any
 * leading dot dropped), a domain cookie is stored with a leading dot
 * (the browser prepends one when the attribute lacks it).
 */
export function predictedJarKey(v: CookieEditFormValues): JarCookieKey {
  const domain = v.domain.trim();
  const stored = v.hostOnly ? domain.replace(/^\./, '') : domain.startsWith('.') ? domain : `.${domain}`;
  return {
    name: v.name.trim(),
    domain: stored,
    path: v.path.trim() || '/',
    secure: v.secure,
    ...(v.partitionKey ? { partitionKey: v.partitionKey } : {}),
    ...(v.storeId ? { storeId: v.storeId } : {}),
  };
}

/** Identity equality the jar dedupes on (name · domain · path ·
 *  partition · store) — `secure` only rebuilds the write URL and never
 *  distinguishes two cookies. */
export function jarKeysSameCookie(a: JarCookieKey, b: JarCookieKey): boolean {
  return (
    a.name === b.name &&
    a.domain === b.domain &&
    a.path === b.path &&
    (a.partitionKey ?? '') === (b.partitionKey ?? '') &&
    (a.storeId ?? '') === (b.storeId ?? '')
  );
}

/** Identity for delete — domain / path / secure rebuild the URL SW-side. */
export function rowToKey(row: CookieRow): JarCookieKey {
  return {
    name: row.name,
    domain: row.domain ?? '',
    path: row.path || '/',
    secure: !!row.secure,
    ...(row.partitionKey ? { partitionKey: row.partitionKey } : {}),
    ...(row.storeId ? { storeId: row.storeId } : {}),
  };
}

/** Structural equality — the modal's `isDirty` derives from this, never
 *  an imperative flag. */
export function editFormsEqual(a: CookieEditFormValues, b: CookieEditFormValues): boolean {
  return (
    a.name === b.name &&
    a.value === b.value &&
    a.domain === b.domain &&
    a.path === b.path &&
    a.hostOnly === b.hostOnly &&
    a.httpOnly === b.httpOnly &&
    a.secure === b.secure &&
    a.sameSite === b.sameSite &&
    a.session === b.session &&
    (a.session ? true : a.expirationDate === b.expirationDate) &&
    a.partitionKey === b.partitionKey &&
    a.storeId === b.storeId
  );
}

const EDIT_FORM_FIELDS: ReadonlyArray<keyof CookieEditFormValues> = [
  'name',
  'value',
  'domain',
  'path',
  'hostOnly',
  'httpOnly',
  'secure',
  'sameSite',
  'session',
  'expirationDate',
  'partitionKey',
  'storeId',
];

/**
 * Per-field catch-up of a live canonical into an open form — the free
 * tier of the document-sync model. A field the user hasn't touched
 * (form === baseline) silently adopts the new canonical value; a
 * touched field keeps the draft (a genuine conflict stays pending for
 * the conflict tier to surface). A fully clean form falls out as a
 * whole re-seed. Never overwrites a user edit.
 */
export function mergeEditFormWithCanonical(
  baseline: CookieEditFormValues,
  form: CookieEditFormValues,
  next: CookieEditFormValues,
): CookieEditFormValues {
  const merged = { ...form };
  for (const field of EDIT_FORM_FIELDS) {
    if (form[field] === baseline[field]) {
      mergeField(merged, field, next);
    }
  }
  return merged;
}

function mergeField<K extends keyof CookieEditFormValues>(
  out: CookieEditFormValues,
  field: K,
  next: CookieEditFormValues,
): void {
  out[field] = next[field];
}

/**
 * The flat field vocabulary the conflict tier compares and anchors
 * chips on. `session` + `expirationDate` fold into one `expires` leaf —
 * they are one user-facing control, and a Session↔date flip plus a
 * date change must read as ONE conflict, not two.
 */
export const COOKIE_CONFLICT_FIELDS = [
  'name',
  'value',
  'domain',
  'path',
  'expires',
  'sameSite',
  'httpOnly',
  'secure',
  'hostOnly',
] as const;

export type CookieConflictField = (typeof COOKIE_CONFLICT_FIELDS)[number];

function expiresDisplay(v: CookieEditFormValues): string {
  return v.session ? 'Session' : expirationToLocalInput(v.expirationDate);
}

/**
 * Project the form onto the conflict vocabulary — display-comparable
 * strings, so the same projection drives both the three-way comparison
 * and the chip popover's base/theirs rendering.
 */
export function editFormConflictProjection(v: CookieEditFormValues): Record<CookieConflictField, string> {
  return {
    name: v.name,
    value: v.value,
    domain: v.domain,
    path: v.path,
    expires: expiresDisplay(v),
    sameSite: COOKIE_SAME_SITE_LABELS[v.sameSite],
    httpOnly: v.httpOnly ? 'On' : 'Off',
    secure: v.secure ? 'On' : 'Off',
    hostOnly: v.hostOnly ? 'On' : 'Off',
  };
}

/**
 * Inverse of {@link editFormConflictProjection} — parses the review
 * dialog's merged JSON result back onto the form. The panes render the
 * display vocabulary ('On'/'Off', sameSite labels, 'Session' or a
 * datetime-local value), so the parse accepts exactly that vocabulary
 * and throws an honest message on anything else; the merge modal
 * renders the thrown message inline and stays open.
 */
export function editFormFromConflictText(form: CookieEditFormValues, text: string): CookieEditFormValues {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('The merged result isn’t valid JSON — fix the syntax and complete the merge again.');
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('The merged result must be a JSON object with the cookie’s fields.');
  }
  const record = parsed as Record<string, unknown>;
  const fieldText = (field: CookieConflictField): string => {
    const value = record[field];
    if (typeof value !== 'string') throw new Error(`"${field}" must be present as a string.`);
    return value;
  };
  const fieldFlag = (field: 'httpOnly' | 'secure' | 'hostOnly'): boolean => {
    const value = fieldText(field);
    if (value !== 'On' && value !== 'Off') throw new Error(`"${field}" must be "On" or "Off".`);
    return value === 'On';
  };
  const sameSiteText = fieldText('sameSite');
  const sameSite = (Object.keys(COOKIE_SAME_SITE_LABELS) as CookieSameSiteValue[]).find(
    (value) => COOKIE_SAME_SITE_LABELS[value] === sameSiteText,
  );
  if (sameSite === undefined) {
    const labels = Object.values(COOKIE_SAME_SITE_LABELS)
      .map((l) => `"${l}"`)
      .join(', ');
    throw new Error(`"sameSite" must be one of ${labels}.`);
  }
  const expiresText = fieldText('expires');
  const next: CookieEditFormValues = {
    ...form,
    name: fieldText('name'),
    value: fieldText('value'),
    domain: fieldText('domain'),
    path: fieldText('path'),
    sameSite,
    httpOnly: fieldFlag('httpOnly'),
    secure: fieldFlag('secure'),
    hostOnly: fieldFlag('hostOnly'),
    session: expiresText === 'Session',
  };
  if (expiresText === 'Session') {
    delete next.expirationDate;
    return next;
  }
  const expiration = expirationFromLocalInput(expiresText);
  if (expiration === undefined) {
    throw new Error('"expires" must be "Session" or a date like 2026-07-09T14:30.');
  }
  next.expirationDate = expiration;
  return next;
}

/** Take-theirs write: the canonical's value at one conflict field into
 *  the form. `expires` carries the session/expirationDate pair. */
export function applyConflictFieldFromCanonical(
  form: CookieEditFormValues,
  field: CookieConflictField,
  canonical: CookieEditFormValues,
): CookieEditFormValues {
  if (field === 'expires') {
    const next = { ...form, session: canonical.session };
    if (canonical.expirationDate != null) next.expirationDate = canonical.expirationDate;
    else delete next.expirationDate;
    return next;
  }
  const next = { ...form };
  mergeField(next, field, canonical);
  return next;
}

/** Add affordances and per-row Edit/Delete only make sense for cookies
 *  that actually live in the browser jar — request rows joined from the
 *  jar, jar cookies shown as filtered-out, and response Set-Cookie rows
 *  whose jar entry was found (`jarCookie`, joined in cookie-enrich).
 *  Jar-less rows have nothing to write. */
export function isJarEditableRow(row: CookieRow): boolean {
  return row.attribution === 'request-jar' || row.attribution === 'filtered-out' || row.jarCookie != null;
}

/** The jar-truth row behind an editable row — response rows edit their
 *  joined jar entry (the header line omits attributes the jar defaulted:
 *  host-only domain, default path, …); jar-backed request rows ARE the
 *  jar entry already. */
function jarTruthRow(row: CookieRow): CookieRow {
  return row.jarCookie ? jarToRow(row.jarCookie, row.direction, row.attribution) : row;
}

/** Canonical form values the Edit popover opens with. */
export function editCanonicalForRow(row: CookieRow): CookieEditFormValues {
  return rowToEditForm(jarTruthRow(row));
}

/** Identity the Delete gesture removes. */
export function deleteKeyForRow(row: CookieRow): JarCookieKey {
  return rowToKey(jarTruthRow(row));
}

/** Whether the form is complete enough to write. */
export function isEditFormValid(v: CookieEditFormValues): boolean {
  if (v.name.trim() === '' || v.domain.trim() === '') return false;
  if (!v.session && v.expirationDate == null) return false;
  return true;
}
