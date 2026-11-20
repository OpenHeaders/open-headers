import { type CookieEditFormValues, emptyEditForm } from '@openheaders/ui/panel/data/cookies/cookie-edit';
import type { SiteJarCookie } from '@openheaders/ui/panel/data/cookies/cookie-jar-cache';
import {
  applyPastedCookie,
  fillChangedNothing,
  fillFromPaste,
  isEditFormExpired,
  pasteFillState,
  planPastedCookies,
  readCookiePaste,
  stackPasteFill,
  undoFill,
  undoFillField,
} from '@openheaders/ui/panel/data/cookies/cookie-paste';
import { describe, expect, it } from 'vitest';

const NOW = Date.UTC(2026, 10, 20, 17, 0, 0);
const NOW_SEC = NOW / 1000;

function blankForm(over: Partial<CookieEditFormValues> = {}): CookieEditFormValues {
  return { ...emptyEditForm({ domain: 'app.openheaders.io', secure: true }), ...over };
}

function readOne(text: string) {
  const cookies = readCookiePaste(text, NOW);
  expect(cookies).toHaveLength(1);
  return cookies[0];
}

describe('readCookiePaste — telling the two headers apart', () => {
  it('reads a line whose every later part is a known attribute as one Set-Cookie', () => {
    const pasted = readOne(
      'ui_eligible=true; domain=openheaders.io; path=/; expires=Sat, 20 Nov 2027 17:00:49 GMT; secure; HttpOnly; SameSite=Lax',
    );
    expect(pasted.name).toBe('ui_eligible');
    expect(pasted.value).toBe('true');
    expect(pasted.stated).toMatchObject({
      domain: 'openheaders.io',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      expirationDate: Date.UTC(2027, 10, 20, 17, 0, 49) / 1000,
    });
    expect(pasted.ignored).toEqual([]);
  });

  it('reads a line with any non-attribute part as a Cookie header of several cookies', () => {
    const cookies = readCookiePaste('_device_id=6e5d2bdc; _octo=GH1.1.437676022; cpu_bucket=xlg; logged_in=yes', NOW);
    expect(cookies.map((c) => c.name)).toEqual(['_device_id', '_octo', 'cpu_bucket', 'logged_in']);
    expect(cookies.every((c) => c.stated === undefined)).toBe(true);
  });

  it('reads a lone pair as a name and a value, stating nothing else', () => {
    const pasted = readOne('session=abc123');
    expect(pasted).toEqual({ name: 'session', value: 'abc123', ignored: [] });
  });

  it('lets a leading header name decide outright, colon- or tab-separated, any casing', () => {
    expect(readOne('Set-Cookie: session=abc123').stated).toBeDefined();
    expect(readOne('set-cookie\tsession=abc123; Path=/api').stated?.path).toBe('/api');
    // `path` is a cookie NAME here — the prefix says this is a Cookie header.
    expect(readCookiePaste('Cookie: session=abc123; path=/api', NOW).map((c) => c.name)).toEqual(['session', 'path']);
  });

  it('reads a run of Set-Cookie lines as several cookies', () => {
    const cookies = readCookiePaste('Set-Cookie: a=1; Path=/\r\nSet-Cookie: b=2; Secure\n\n', NOW);
    expect(cookies.map((c) => c.name)).toEqual(['a', 'b']);
    expect(cookies[1].stated?.secure).toBe(true);
  });

  it('returns nothing for text that holds no pair', () => {
    expect(readCookiePaste('', NOW)).toEqual([]);
    expect(readCookiePaste('   \n  ', NOW)).toEqual([]);
    expect(readCookiePaste('just some words', NOW)).toEqual([]);
    expect(readCookiePaste('=value-without-a-name', NOW)).toEqual([]);
    expect(readCookiePaste('Set-Cookie: nameless', NOW)).toEqual([]);
  });
});

describe('readCookiePaste — splitting', () => {
  it('splits a pair on its first = only and keeps the value verbatim', () => {
    const pasted = readOne('_dd_s_v2=id=7d88a208&created=1795193345493&expire=1795194944359&c=0');
    expect(pasted.name).toBe('_dd_s_v2');
    expect(pasted.value).toBe('id=7d88a208&created=1795193345493&expire=1795194944359&c=0');
  });

  it('never percent-decodes or unquotes a value', () => {
    expect(readOne('tz=Europe%2FMadrid; Path=/').value).toBe('Europe%2FMadrid');
    expect(readOne('theme="dark mode"').value).toBe('"dark mode"');
  });

  it('never splits on the comma inside an Expires date', () => {
    const pasted = readOne('session=abc123; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/');
    expect(pasted.stated?.expirationDate).toBe(Date.UTC(2026, 9, 21, 7, 28, 0) / 1000);
    expect(pasted.stated?.path).toBe('/');
  });

  it('tolerates stray whitespace and a trailing semicolon', () => {
    const pasted = readOne('  session = abc123 ;  Secure ; ');
    expect(pasted.name).toBe('session');
    expect(pasted.value).toBe('abc123');
    expect(pasted.stated?.secure).toBe(true);
  });

  it('keeps the first value of a name a Cookie header repeats, and skips valueless parts', () => {
    const cookies = readCookiePaste('tz=Europe%2FMadrid; user=john.doe; tz=Europe%2FBerlin; stray', NOW);
    expect(cookies).toEqual([
      { name: 'tz', value: 'Europe%2FMadrid', ignored: [] },
      { name: 'user', value: 'john.doe', ignored: [] },
    ]);
  });
});

describe('readCookiePaste — what a Set-Cookie line leaves unapplied', () => {
  it('lists attributes the form has no control for, as written', () => {
    expect(readOne('session=abc123; Path=/; Partitioned; Priority=High').ignored).toEqual([
      'Partitioned',
      'Priority=High',
    ]);
  });

  it('lists an unknown attribute only when a header name forced the Set-Cookie reading', () => {
    expect(readOne('Set-Cookie: session=abc123; Path=/; Version=1').ignored).toEqual(['Version=1']);
  });

  it('lists an Expires, Max-Age or SameSite it could not read', () => {
    expect(readOne('session=abc123; Expires=not-a-date').ignored).toEqual(['Expires=not-a-date']);
    expect(readOne('session=abc123; Max-Age=soon').ignored).toEqual(['Max-Age=soon']);
    expect(readOne('session=abc123; SameSite=Sometimes').ignored).toEqual(['SameSite=Sometimes']);
  });

  it('does not list an Expires that a readable Max-Age superseded', () => {
    const pasted = readOne('session=abc123; Expires=not-a-date; Max-Age=3600');
    expect(pasted.ignored).toEqual([]);
    expect(pasted.stated?.expirationDate).toBe(NOW_SEC + 3600);
  });
});

describe('applyPastedCookie', () => {
  it('a bare pair overwrites Name and Value and nothing else', () => {
    const form = blankForm({ path: '/api', httpOnly: true, sameSite: 'strict' });
    expect(applyPastedCookie(form, readOne('session=abc123'))).toEqual({ ...form, name: 'session', value: 'abc123' });
  });

  it('a Set-Cookie line states the whole cookie — what it leaves out lands on the spec default', () => {
    const form = blankForm({ name: 'draft', path: '/api', httpOnly: true, secure: true, sameSite: 'strict' });
    expect(applyPastedCookie(form, readOne('Set-Cookie: session=abc123'))).toEqual<CookieEditFormValues>({
      name: 'session',
      value: 'abc123',
      domain: 'app.openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: false,
      sameSite: 'unspecified',
      session: true,
    });
  });

  it('a Domain attribute makes a domain cookie, leading dot dropped', () => {
    const next = applyPastedCookie(blankForm(), readOne('session=abc123; Domain=.openheaders.io; Secure'));
    expect(next.domain).toBe('openheaders.io');
    expect(next.hostOnly).toBe(false);
  });

  it('no Domain attribute stays host-only on the host the form already names', () => {
    const next = applyPastedCookie(
      blankForm({ domain: 'staging.openheaders.io', hostOnly: false }),
      readOne('a=1; Path=/'),
    );
    expect(next.domain).toBe('staging.openheaders.io');
    expect(next.hostOnly).toBe(true);
  });

  it('carries every stated attribute onto the form', () => {
    const next = applyPastedCookie(
      blankForm(),
      readOne('session=abc123; Path=/account; Max-Age=3600; Secure; HttpOnly; SameSite=None'),
    );
    expect(next).toMatchObject({
      path: '/account',
      secure: true,
      httpOnly: true,
      sameSite: 'no_restriction',
      session: false,
      expirationDate: NOW_SEC + 3600,
    });
  });

  it('drops a date the form held when the pasted cookie is a session cookie', () => {
    const next = applyPastedCookie(blankForm({ session: false, expirationDate: NOW_SEC + 60 }), readOne('a=1; Path=/'));
    expect(next.session).toBe(true);
    expect('expirationDate' in next).toBe(false);
  });

  it('never carries the Partitioned marker into the form', () => {
    const next = applyPastedCookie(blankForm(), readOne('session=abc123; Secure; Partitioned'));
    expect(next.partitionKey).toBeUndefined();
  });
});

describe('isEditFormExpired', () => {
  it('is true for a dated cookie at or before now, false for a session or future one', () => {
    const expired = applyPastedCookie(blankForm(), readOne('session=abc123; Max-Age=0'));
    expect(isEditFormExpired(expired, NOW)).toBe(true);
    expect(isEditFormExpired(blankForm({ session: false, expirationDate: NOW_SEC + 1 }), NOW)).toBe(false);
    expect(isEditFormExpired(blankForm(), NOW)).toBe(false);
  });
});

describe('planPastedCookies', () => {
  function jarCookie(over: Partial<SiteJarCookie> = {}): SiteJarCookie {
    return {
      name: 'session',
      value: 'abc123',
      domain: 'app.openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      session: true,
      sendable: true,
      // Chrome jar entries always carry a storeId — a row's "replaces"
      // verdict must survive it.
      storeId: '0',
      ...over,
    };
  }

  it('writes a name the jar does not hold as a new cookie under the shared attributes', () => {
    const shared = blankForm({ name: 'draft', value: 'ignored', path: '/account', sameSite: 'strict' });
    const [row] = planPastedCookies(readCookiePaste('user=john.doe; tz=Europe%2FMadrid', NOW), shared, []);
    expect(row.form).toEqual({ ...shared, name: 'user', value: 'john.doe' });
    expect(row.replaces).toBe(false);
  });

  it('keeps the identity and attributes of a cookie the jar already holds — only the value changes', () => {
    const held = jarCookie({ domain: '.openheaders.io', hostOnly: false, path: '/account', httpOnly: true });
    const shared = blankForm({ httpOnly: false, sameSite: 'lax' });
    const [row] = planPastedCookies(readCookiePaste('session=rotated; user=john.doe', NOW), shared, [held]);
    expect(row.form).toMatchObject({
      name: 'session',
      value: 'rotated',
      domain: '.openheaders.io',
      path: '/account',
      hostOnly: false,
      httpOnly: true,
      sameSite: 'strict',
      storeId: '0',
    });
    expect(row.replaces).toBe(true);
  });

  it('takes the most specific of several held cookies of one name — longest path, then host-only', () => {
    const wide = jarCookie({ domain: '.openheaders.io', hostOnly: false });
    const host = jarCookie();
    const deep = jarCookie({ domain: '.openheaders.io', hostOnly: false, path: '/account' });
    const plan = (jar: SiteJarCookie[]) =>
      planPastedCookies(readCookiePaste('session=rotated; user=john.doe', NOW), blankForm(), jar)[0].form;
    expect(plan([wide, host])).toMatchObject({ domain: 'app.openheaders.io', hostOnly: true });
    expect(plan([wide, host, deep])).toMatchObject({ domain: '.openheaders.io', path: '/account' });
  });

  it('never adopts a same-named cookie the browser would not send to this scope', () => {
    const elsewhere = jarCookie({ domain: 'docs.openheaders.io', sendable: false });
    const [row] = planPastedCookies(readCookiePaste('session=rotated; user=john.doe', NOW), blankForm(), [elsewhere]);
    expect(row.form).toMatchObject({ domain: 'app.openheaders.io', hostOnly: true, httpOnly: false });
    expect(row.replaces).toBe(false);
  });

  it('writes a Set-Cookie line as stated, and says when that lands on a held cookie', () => {
    const held = jarCookie({ domain: '.openheaders.io', hostOnly: false });
    const cookies = readCookiePaste(
      'Set-Cookie: session=rotated; Domain=openheaders.io; Path=/\nSet-Cookie: theme=dark; Path=/account',
      NOW,
    );
    const [session, theme] = planPastedCookies(cookies, blankForm(), [held]);
    expect(session.form).toMatchObject({ domain: 'openheaders.io', hostOnly: false, httpOnly: false, secure: false });
    expect(session.replaces).toBe(true);
    expect(theme.form).toMatchObject({ domain: 'app.openheaders.io', hostOnly: true, path: '/account' });
    expect(theme.replaces).toBe(false);
  });
});

describe('fillFromPaste', () => {
  it('keeps the form as it stood, and names Name and Value as what a pair decided', () => {
    const form = blankForm({ name: 'draft' });
    const fill = fillFromPaste(form, readOne('session=abc123'), NOW);
    expect(fill.before).toBe(form);
    expect(fill.after).toEqual({ ...form, name: 'session', value: 'abc123' });
    expect(fill.fields).toEqual(['name', 'value']);
    expect(fill.fromSetCookie).toBe(false);
  });

  it('names every field for a Set-Cookie line that states a Domain', () => {
    const fill = fillFromPaste(blankForm(), readOne('session=abc123; Domain=openheaders.io; Secure'), NOW);
    expect(fill.fields).toEqual([
      'name',
      'value',
      'domain',
      'path',
      'expires',
      'sameSite',
      'httpOnly',
      'secure',
      'hostOnly',
    ]);
    expect(fill.fromSetCookie).toBe(true);
  });

  it('leaves Domain out when the line did — the host the form named still stands', () => {
    const fill = fillFromPaste(blankForm(), readOne('session=abc123; Path=/; Secure'), NOW);
    expect(fill.fields).not.toContain('domain');
    expect(fill.fields).toContain('hostOnly');
  });

  it('carries what the line left unapplied and whether its expiry is already past', () => {
    const fill = fillFromPaste(blankForm(), readOne('session=abc123; Max-Age=0; Priority=High'), NOW);
    expect(fill.ignored).toEqual(['Priority=High']);
    expect(fill.expired).toBe(true);
  });
});

describe('a fill, field by field', () => {
  const hand = () => blankForm({ name: 'draft', path: '/api', sameSite: 'strict' });
  const pasted = () => fillFromPaste(hand(), readOne('session=abc123; Path=/account; Secure'), NOW);

  it('holds every field it decided until that field is edited', () => {
    const fill = pasted();
    expect(pasteFillState(fill, fill.after).held).toEqual(fill.fields);
    const edited = { ...fill.after, value: 'rotated' };
    expect(pasteFillState(fill, edited).held).not.toContain('value');
    expect(pasteFillState(fill, edited).live).toBe(true);
  });

  it('offers back only what it replaced — a blank text field has nothing to return to', () => {
    const fill = pasted();
    // name 'draft' → 'session', path '/api' → '/account', sameSite strict → unspecified.
    expect(pasteFillState(fill, fill.after).restorable).toEqual(['name', 'path', 'sameSite']);
  });

  it('is over once nothing it changed is left in the form', () => {
    const fill = pasted();
    const moved = { ...fill.after, name: 'renamed', value: 'rotated', path: '/', sameSite: 'lax' as const };
    expect(pasteFillState(fill, moved).live).toBe(false);
  });

  it('takes one field back and leaves the others', () => {
    const fill = pasted();
    expect(undoFillField(fill.after, fill, 'path')).toEqual({ ...fill.after, path: '/api' });
  });

  it('takes an expiry back as one thing — the date and the session switch together', () => {
    const dated = blankForm({ session: false, expirationDate: NOW_SEC + 60 });
    const fill = fillFromPaste(dated, readOne('session=abc123; Path=/'), NOW);
    expect(fill.after.session).toBe(true);
    const back = undoFillField(fill.after, fill, 'expires');
    expect(back.session).toBe(false);
    expect(back.expirationDate).toBe(NOW_SEC + 60);
  });

  it('takes everything still held back, keeping a field edited since', () => {
    const fill = pasted();
    const edited = { ...fill.after, value: 'kept-by-hand' };
    expect(undoFill(edited, fill)).toEqual({ ...hand(), value: 'kept-by-hand' });
  });

  it('knows a paste that changed nothing', () => {
    const fill = pasted();
    expect(fillChangedNothing(fill)).toBe(false);
    expect(fillChangedNothing(fillFromPaste(fill.after, readOne('session=abc123; Path=/account; Secure'), NOW))).toBe(
      true,
    );
  });

  it('a paste on a standing fill keeps the hand-left form as the way back, and the earlier marks', () => {
    const first = pasted();
    const second = stackPasteFill(fillFromPaste(first.after, readOne('token=def456'), NOW), first);
    expect(second.before).toEqual(hand());
    expect(second.after).toMatchObject({ name: 'token', value: 'def456', path: '/account' });
    expect(second.fields).toEqual(first.fields);
    expect(pasteFillState(second, second.after).restorable).toEqual(['name', 'path', 'sameSite']);
  });
});
