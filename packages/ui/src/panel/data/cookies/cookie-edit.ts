/**
 * Pure form-model helpers for the Cookies tab's add / edit modal.
 *
 * The modal edits a {@link CookieEditFormValues} — a flat, fully-defined
 * shape (no optional-vs-absent ambiguity beyond `expirationDate`) so the
 * `isDirty` check is a plain structural compare against the canonical
 * snapshot the modal opened with. Nothing here touches the browser jar;
 * the seam in `cookie-jar-cache` does the write.
 */

import type { JarCookieEdit, JarCookieKey } from './cookie-jar-cache';
import { jarToRow, type CookieRow } from './cookie-model';

export type CookieSameSiteValue = 'unspecified' | 'no_restriction' | 'lax' | 'strict';

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

/** Identity for delete — domain / path / secure rebuild the URL SW-side. */
export function rowToKey(row: CookieRow): JarCookieKey {
  return {
    name: row.name,
    domain: row.domain ?? '',
    path: row.path || '/',
    secure: !!row.secure,
    ...(row.partitionKey ? { partitionKey: row.partitionKey } : {}),
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
