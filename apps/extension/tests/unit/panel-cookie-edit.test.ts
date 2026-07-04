import {
  type CookieEditFormValues,
  deleteKeyForRow,
  editCanonicalForRow,
  editFormsEqual,
  emptyEditForm,
  formToEdit,
  isEditFormValid,
  isJarEditableRow,
  rowToEditForm,
  rowToKey,
} from '@openheaders/ui/panel/data/cookies/cookie-edit';
import type { JarCookie } from '@openheaders/ui/panel/host-cookie-jar';
import type { CookieRow } from '@openheaders/ui/panel/data/cookies/cookie-model';
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
