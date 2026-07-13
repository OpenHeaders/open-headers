import {
  applyConflictFieldFromCanonical,
  type CookieEditFormValues,
  deleteKeyForRow,
  editCanonicalForRow,
  editFormConflictProjection,
  editFormConstraintError,
  editFormFromConflictText,
  editFormsEqual,
  emptyEditForm,
  formToEdit,
  isEditFormValid,
  isJarEditableRow,
  jarCookieToEditForm,
  jarCookieToKey,
  jarKeysSameCookie,
  mergeEditFormWithCanonical,
  rowToEditForm,
  rowToKey,
} from '@openheaders/ui/panel/data/cookies/cookie-edit';
import { type CookieRow, jarToRow } from '@openheaders/ui/panel/data/cookies/cookie-model';
import type { JarCookie } from '@openheaders/ui/panel/host-cookie-jar';
import { describe, expect, it } from 'vitest';

function makeRow(over: Partial<CookieRow> = {}): CookieRow {
  return {
    name: 'sid',
    value: 'abc',
    direction: 'request',
    attribution: 'request-jar',
    id: 'request:request-jar:openheaders.io/:sid',
    domain: 'openheaders.io',
    path: '/',
    hostOnly: true,
    httpOnly: true,
    secure: true,
    session: true,
    size: 7,
    ...over,
  };
}

describe('rowToEditForm', () => {
  it('maps a session jar cookie to canonical form values', () => {
    const form = rowToEditForm(makeRow({ sameSite: 'lax' }));
    expect(form).toEqual<CookieEditFormValues>({
      name: 'sid',
      value: 'abc',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      session: true,
    });
  });

  it('carries expirationDate and partitionKey, derives session=false', () => {
    const form = rowToEditForm(makeRow({ expirationDate: 4102444800, partitionKey: 'https://embed.openheaders.io' }));
    expect(form.session).toBe(false);
    expect(form.expirationDate).toBe(4102444800);
    expect(form.partitionKey).toBe('https://embed.openheaders.io');
  });

  it('normalises an unknown sameSite to unspecified', () => {
    expect(rowToEditForm(makeRow({ sameSite: undefined })).sameSite).toBe('unspecified');
  });
});

describe('emptyEditForm', () => {
  it('seeds domain + secure and defaults to a host-only session cookie', () => {
    const form = emptyEditForm({ domain: 'app.openheaders.io', secure: false });
    expect(form.domain).toBe('app.openheaders.io');
    expect(form.secure).toBe(false);
    expect(form.hostOnly).toBe(true);
    expect(form.session).toBe(true);
    expect(form.name).toBe('');
  });
});

describe('formToEdit', () => {
  it('trims name/domain/path and forwards expiration', () => {
    const edit = formToEdit({
      name: ' sid ',
      value: 'v',
      domain: ' openheaders.io ',
      path: ' /api ',
      hostOnly: false,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      session: false,
      expirationDate: 4102444800,
    });
    expect(edit.name).toBe('sid');
    expect(edit.domain).toBe('openheaders.io');
    expect(edit.path).toBe('/api');
    expect(edit.sameSite).toBe('strict');
    expect(edit.expirationDate).toBe(4102444800);
  });

  it('drops sameSite=unspecified and expirationDate for a session cookie', () => {
    const edit = formToEdit({
      name: 'sid',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: true,
      sameSite: 'unspecified',
      session: true,
      expirationDate: 4102444800,
    });
    expect(edit.sameSite).toBeUndefined();
    expect(edit.expirationDate).toBeUndefined();
  });

  it('defaults an empty path to /', () => {
    const edit = formToEdit({ ...emptyEditForm({ domain: 'openheaders.io' }), name: 'x', path: '' });
    expect(edit.path).toBe('/');
  });
});

describe('rowToKey', () => {
  it('extracts the delete identity incl. partitionKey', () => {
    expect(rowToKey(makeRow({ partitionKey: 'https://embed.openheaders.io' }))).toEqual({
      name: 'sid',
      domain: 'openheaders.io',
      path: '/',
      secure: true,
      partitionKey: 'https://embed.openheaders.io',
    });
  });

  it('a row derived from a jar cookie round-trips to the SAME identity (storeId carried)', () => {
    // Chrome jar entries always carry a storeId ('0'); a row-derived key
    // that drops it fails jarKeysSameCookie against the live jar entry —
    // the edit popover's live sync then falsely reports the cookie gone.
    const jar: JarCookie = {
      name: 'sid',
      value: 'abc',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
      session: true,
      storeId: '0',
    };
    const row = jarToRow(jar, 'request', 'request-jar');
    expect(rowToKey(row).storeId).toBe('0');
    expect(jarKeysSameCookie(deleteKeyForRow(row), jarCookieToKey(jar))).toBe(true);
    expect(editCanonicalForRow(row).storeId).toBe('0');
  });
});

describe('editFormsEqual (isDirty derivation)', () => {
  const base = rowToEditForm(makeRow({ sameSite: 'lax' }));

  it('is true for an unchanged copy', () => {
    expect(editFormsEqual(base, { ...base })).toBe(true);
  });

  it('is false when a field changes', () => {
    expect(editFormsEqual(base, { ...base, value: 'other' })).toBe(false);
    expect(editFormsEqual(base, { ...base, httpOnly: false })).toBe(false);
  });

  it('ignores expirationDate drift while both are session cookies', () => {
    expect(editFormsEqual({ ...base, expirationDate: 1 }, { ...base, expirationDate: 2 })).toBe(true);
  });

  it('compares expirationDate when persistent', () => {
    const a: CookieEditFormValues = { ...base, session: false, expirationDate: 1 };
    const b: CookieEditFormValues = { ...base, session: false, expirationDate: 2 };
    expect(editFormsEqual(a, b)).toBe(false);
  });
});

describe('isJarEditableRow', () => {
  it('allows jar-backed request rows and filtered-out jar cookies', () => {
    expect(isJarEditableRow(makeRow({ attribution: 'request-jar' }))).toBe(true);
    expect(isJarEditableRow(makeRow({ attribution: 'filtered-out' }))).toBe(true);
  });

  it('rejects jar-less response Set-Cookie lines and jar-less request rows', () => {
    expect(isJarEditableRow(makeRow({ attribution: 'response-set', direction: 'response' }))).toBe(false);
    expect(isJarEditableRow(makeRow({ attribution: 'request-har' }))).toBe(false);
  });

  it('allows a response row joined to its jar entry', () => {
    expect(
      isJarEditableRow(makeRow({ attribution: 'response-set', direction: 'response', jarCookie: makeJarCookie() })),
    ).toBe(true);
  });
});

function makeJarCookie(over: Partial<JarCookie> = {}): JarCookie {
  return {
    name: 'sid',
    value: 'live-value',
    domain: '.openheaders.io',
    path: '/account',
    hostOnly: false,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    session: false,
    expirationDate: 4102444800,
    ...over,
  };
}

describe('editCanonicalForRow / deleteKeyForRow', () => {
  it('edits and deletes the JOINED jar entry for a response row, not the parsed line', () => {
    // Set-Cookie line omitted Domain/Path — the jar entry carries the truth.
    const row = makeRow({
      attribution: 'response-set',
      direction: 'response',
      domain: undefined,
      path: undefined,
      value: 'header-value',
      jarCookie: makeJarCookie(),
    });
    const form = editCanonicalForRow(row);
    expect(form.domain).toBe('.openheaders.io');
    expect(form.path).toBe('/account');
    expect(form.value).toBe('live-value');
    expect(form.session).toBe(false);
    expect(deleteKeyForRow(row)).toEqual({
      name: 'sid',
      domain: '.openheaders.io',
      path: '/account',
      secure: true,
    });
  });

  it('falls back to the row itself for jar-less rows', () => {
    const row = makeRow({ sameSite: 'lax' });
    expect(editCanonicalForRow(row)).toEqual(rowToEditForm(row));
    expect(deleteKeyForRow(row)).toEqual(rowToKey(row));
  });

  it('opens on the LIVE jar value for a request row whose jar moved since the request', () => {
    const row = makeRow({ value: 'sent-value', jarCookie: makeJarCookie({ value: 'live-value' }) });
    expect(editCanonicalForRow(row).value).toBe('live-value');
  });
});

describe('jarCookieToEditForm / jarCookieToKey (Storage tool window)', () => {
  it('maps a jar cookie to canonical form values with the same derivation rules as rows', () => {
    const form = jarCookieToEditForm(makeJarCookie());
    expect(form).toEqual<CookieEditFormValues>({
      name: 'sid',
      value: 'live-value',
      domain: '.openheaders.io',
      path: '/account',
      hostOnly: false,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      session: false,
      expirationDate: 4102444800,
    });
  });

  it('derives session=true and normalises sameSite when the jar entry has neither', () => {
    const form = jarCookieToEditForm(makeJarCookie({ expirationDate: undefined, session: true, sameSite: undefined }));
    expect(form.session).toBe(true);
    expect(form.expirationDate).toBeUndefined();
    expect(form.sameSite).toBe('unspecified');
  });

  it('carries partitionKey and storeId through form and key', () => {
    const jar = makeJarCookie({ partitionKey: 'https://embed.openheaders.io', storeId: '1' });
    expect(jarCookieToEditForm(jar).partitionKey).toBe('https://embed.openheaders.io');
    expect(jarCookieToEditForm(jar).storeId).toBe('1');
    expect(jarCookieToKey(jar)).toEqual({
      name: 'sid',
      domain: '.openheaders.io',
      path: '/account',
      secure: true,
      partitionKey: 'https://embed.openheaders.io',
      storeId: '1',
    });
  });

  it('builds the delete identity from name + domain + path + secure', () => {
    expect(jarCookieToKey(makeJarCookie())).toEqual({
      name: 'sid',
      domain: '.openheaders.io',
      path: '/account',
      secure: true,
    });
  });
});

describe('isEditFormValid', () => {
  it('requires name and domain', () => {
    expect(isEditFormValid(emptyEditForm({ domain: 'openheaders.io' }))).toBe(false);
    expect(isEditFormValid({ ...emptyEditForm({ domain: 'openheaders.io' }), name: 'x' })).toBe(true);
    expect(isEditFormValid({ ...emptyEditForm({ domain: '' }), name: 'x' })).toBe(false);
  });

  it('requires an expirationDate when not a session cookie', () => {
    const form = { ...emptyEditForm({ domain: 'openheaders.io' }), name: 'x', session: false };
    expect(isEditFormValid(form)).toBe(false);
    expect(isEditFormValid({ ...form, expirationDate: 4102444800 })).toBe(true);
  });
});

describe('editFormConstraintError (PB2 pre-validation)', () => {
  const base = { ...emptyEditForm({ domain: 'openheaders.io', secure: true }), name: 'sid' };

  it('passes an unconstrained cookie', () => {
    expect(editFormConstraintError(base)).toBeNull();
  });

  it('__Host- requires Secure, no Domain attribute and path /', () => {
    const host = { ...base, name: '__Host-sid', hostOnly: true, path: '/', secure: true };
    expect(editFormConstraintError(host)).toBeNull();
    expect(editFormConstraintError({ ...host, secure: false })).toMatch(/Secure/);
    expect(editFormConstraintError({ ...host, hostOnly: false })).toMatch(/Domain/);
    expect(editFormConstraintError({ ...host, path: '/api' })).toMatch(/path/);
  });

  it('__Secure- requires Secure', () => {
    expect(editFormConstraintError({ ...base, name: '__Secure-sid', secure: true })).toBeNull();
    expect(editFormConstraintError({ ...base, name: '__Secure-sid', secure: false })).toMatch(/Secure/);
  });

  it('SameSite=None requires Secure', () => {
    const none = { ...base, sameSite: 'no_restriction' as const };
    expect(editFormConstraintError({ ...none, secure: true })).toBeNull();
    expect(editFormConstraintError({ ...none, secure: false })).toMatch(/Secure/);
  });
});

describe('mergeEditFormWithCanonical', () => {
  const baseline: CookieEditFormValues = {
    ...emptyEditForm({ domain: 'openheaders.io' }),
    name: 'sid',
    value: 'abc',
  };

  it('re-seeds a clean form wholesale', () => {
    const next = { ...baseline, value: 'rotated', httpOnly: true };
    expect(mergeEditFormWithCanonical(baseline, baseline, next)).toEqual(next);
  });

  it('catches up untouched fields and keeps touched drafts', () => {
    const form = { ...baseline, name: 'sid-draft' };
    const next = { ...baseline, value: 'rotated' };
    expect(mergeEditFormWithCanonical(baseline, form, next)).toEqual({
      ...baseline,
      name: 'sid-draft',
      value: 'rotated',
    });
  });

  it('never overwrites a touched field even when the canonical moved on the same field', () => {
    const form = { ...baseline, value: 'my-draft' };
    const next = { ...baseline, value: 'theirs' };
    expect(mergeEditFormWithCanonical(baseline, form, next).value).toBe('my-draft');
  });

  it('carries optional-field transitions (expiration appearing) into untouched forms', () => {
    const next = { ...baseline, session: false, expirationDate: 4102444800 };
    const merged = mergeEditFormWithCanonical(baseline, baseline, next);
    expect(merged.session).toBe(false);
    expect(merged.expirationDate).toBe(4102444800);
  });
});

describe('editFormConflictProjection', () => {
  const form: CookieEditFormValues = {
    ...emptyEditForm({ domain: 'openheaders.io' }),
    name: 'sid',
    value: 'abc',
    httpOnly: true,
    sameSite: 'no_restriction',
  };

  it('projects text fields raw and flags/enums to their display vocabulary', () => {
    const proj = editFormConflictProjection(form);
    expect(proj.name).toBe('sid');
    expect(proj.value).toBe('abc');
    expect(proj.domain).toBe('openheaders.io');
    expect(proj.path).toBe('/');
    expect(proj.httpOnly).toBe('On');
    expect(proj.secure).toBe('On');
    expect(proj.hostOnly).toBe('On');
    expect(proj.sameSite).toBe('None (cross-site)');
    expect(proj.expires).toBe('Session');
  });

  it('folds session + expirationDate into ONE expires leaf', () => {
    const dated = editFormConflictProjection({ ...form, session: false, expirationDate: 4102444800 });
    expect(dated.expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(dated.expires).not.toBe(editFormConflictProjection(form).expires);
  });
});

describe('applyConflictFieldFromCanonical', () => {
  const form: CookieEditFormValues = {
    ...emptyEditForm({ domain: 'openheaders.io' }),
    name: 'sid',
    value: 'my-draft',
  };

  it('writes one scalar field from the canonical, leaving the rest of the drafts', () => {
    const canonical = { ...form, value: 'theirs', domain: 'other.openheaders.io' };
    const next = applyConflictFieldFromCanonical(form, 'value', canonical);
    expect(next.value).toBe('theirs');
    expect(next.domain).toBe('openheaders.io');
    expect(next.name).toBe('sid');
  });

  it('writes flags typed, not stringified', () => {
    const canonical = { ...form, httpOnly: true };
    expect(applyConflictFieldFromCanonical({ ...form, httpOnly: false }, 'httpOnly', canonical).httpOnly).toBe(true);
  });

  it('expires carries the session/expirationDate pair both directions', () => {
    const dated = { ...form, session: false, expirationDate: 4102444800 };
    const toDated = applyConflictFieldFromCanonical(form, 'expires', dated);
    expect(toDated.session).toBe(false);
    expect(toDated.expirationDate).toBe(4102444800);
    const toSession = applyConflictFieldFromCanonical(dated, 'expires', form);
    expect(toSession.session).toBe(true);
    expect(toSession.expirationDate).toBeUndefined();
  });
});

describe('editFormFromConflictText (merge-dialog parse-back)', () => {
  const form: CookieEditFormValues = {
    ...emptyEditForm({ domain: 'openheaders.io' }),
    name: 'sid',
    value: 'my-draft',
    partitionKey: 'https://openheaders.io',
    storeId: '1',
  };

  function textOf(values: CookieEditFormValues): string {
    return JSON.stringify(editFormConflictProjection(values), null, 2);
  }

  it('round-trips its own projection, session and dated', () => {
    expect(editFormFromConflictText(form, textOf(form))).toEqual(form);
    const dated = { ...form, session: false, expirationDate: 4102444800 };
    expect(editFormFromConflictText(form, textOf(dated))).toEqual(dated);
  });

  it('parses the display vocabulary back to typed fields', () => {
    const merged = editFormFromConflictText(
      form,
      textOf({ ...form, value: 'theirs', httpOnly: true, secure: false, sameSite: 'strict' }),
    );
    expect(merged.value).toBe('theirs');
    expect(merged.httpOnly).toBe(true);
    expect(merged.secure).toBe(false);
    expect(merged.sameSite).toBe('strict');
  });

  it('a Session expires drops a stale expirationDate', () => {
    const dated = { ...form, session: false, expirationDate: 4102444800 };
    const merged = editFormFromConflictText(dated, textOf(form));
    expect(merged.session).toBe(true);
    expect(merged.expirationDate).toBeUndefined();
  });

  it('carries non-projected fields (partitionKey, storeId) from the form', () => {
    const merged = editFormFromConflictText(form, textOf({ ...form, value: 'theirs' }));
    expect(merged.partitionKey).toBe('https://openheaders.io');
    expect(merged.storeId).toBe('1');
  });

  it('throws honest messages on malformed input', () => {
    expect(() => editFormFromConflictText(form, 'not json')).toThrow(/valid JSON/);
    expect(() => editFormFromConflictText(form, '[]')).toThrow(/JSON object/);
    const proj = editFormConflictProjection(form) as Record<string, string>;
    const { name: _dropped, ...missing } = proj;
    expect(() => editFormFromConflictText(form, JSON.stringify(missing))).toThrow(/"name"/);
    expect(() => editFormFromConflictText(form, JSON.stringify({ ...proj, httpOnly: 'yes' }))).toThrow(/"On" or "Off"/);
    expect(() => editFormFromConflictText(form, JSON.stringify({ ...proj, sameSite: 'Laxish' }))).toThrow(/sameSite/);
    expect(() => editFormFromConflictText(form, JSON.stringify({ ...proj, expires: 'someday' }))).toThrow(/expires/);
  });
});
