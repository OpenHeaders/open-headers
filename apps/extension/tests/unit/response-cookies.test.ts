/**
 * Response Cookies tab helpers — raw Set-Cookie parsing, the honest
 * persistence note, and the cookie-attributes doc corpus.
 */

import { getCookieAttributeInfoContent } from '@openheaders/ui/shared/info-popover/data/cookie-attributes';
import {
  cookiePersistenceNote,
  hostOfUrl,
  parseSetCookieLine,
  parseSetCookieLines,
  toCookieGridRow,
} from '@openheaders/ui/workbench/components/request-editor/response/response-cookies';
import { describe, expect, it } from 'vitest';

describe('parseSetCookieLine', () => {
  it('parses name, value and attributes', () => {
    const parsed = parseSetCookieLine('session=abc123; Path=/; HttpOnly; SameSite=Lax');
    expect(parsed.name).toBe('session');
    expect(parsed.value).toBe('abc123');
    expect(parsed.attributes).toEqual([
      { key: 'Path', value: '/' },
      { key: 'HttpOnly' },
      { key: 'SameSite', value: 'Lax' },
    ]);
    expect(parsed.raw).toBe('session=abc123; Path=/; HttpOnly; SameSite=Lax');
  });

  it('keeps = characters inside the value', () => {
    const parsed = parseSetCookieLine('token=a=b=c; Secure');
    expect(parsed.value).toBe('a=b=c');
    expect(parsed.attributes).toEqual([{ key: 'Secure' }]);
  });

  it('handles an empty value and a bare pair', () => {
    expect(parseSetCookieLine('cleared=; Max-Age=0')).toMatchObject({ name: 'cleared', value: '' });
    expect(parseSetCookieLine('flagonly')).toMatchObject({ name: 'flagonly', value: '', attributes: [] });
  });

  it('skips empty attribute segments', () => {
    expect(parseSetCookieLine('a=b; ; Path=/').attributes).toEqual([{ key: 'Path', value: '/' }]);
  });

  it('parses a list preserving order', () => {
    const parsed = parseSetCookieLines(['a=1', 'b=2; Secure']);
    expect(parsed.map((c) => c.name)).toEqual(['a', 'b']);
  });
});

describe('cookiePersistenceNote', () => {
  it('says discarded under omit and possibly stored under include', () => {
    expect(cookiePersistenceNote('omit')).toContain('discarded');
    expect(cookiePersistenceNote('include')).toContain('stored');
  });
});

describe('toCookieGridRow', () => {
  it('fills RFC defaults: host-only Domain, root Path, Session expiry', () => {
    const row = toCookieGridRow(parseSetCookieLine('oh_cred=present; SameSite=None; Secure'), 'api.openheaders.io');
    expect(row).toEqual({
      name: 'oh_cred',
      value: 'present',
      domain: 'api.openheaders.io',
      path: '/',
      expires: 'Session',
      httpOnly: false,
      secure: true,
      sameSite: 'None',
      raw: 'oh_cred=present; SameSite=None; Secure',
    });
  });

  it('keeps explicit attributes verbatim, case-insensitively', () => {
    const row = toCookieGridRow(
      parseSetCookieLine('sid=1; domain=.openheaders.io; path=/app; expires=Wed, 08 Jul 2026 00:00:00 GMT; httponly'),
      'api.openheaders.io',
    );
    expect(row.domain).toBe('.openheaders.io');
    expect(row.path).toBe('/app');
    expect(row.expires).toBe('Wed, 08 Jul 2026 00:00:00 GMT');
    expect(row.httpOnly).toBe(true);
    expect(row.secure).toBe(false);
    expect(row.sameSite).toBe('—');
  });

  it('reports Max-Age when Expires is absent', () => {
    const row = toCookieGridRow(parseSetCookieLine('sid=1; Max-Age=3600'), 'openheaders.io');
    expect(row.expires).toBe('Max-Age=3600');
  });
});

describe('hostOfUrl', () => {
  it('returns the host name without port (cookie domains have no port), empty for an unparseable URL', () => {
    expect(hostOfUrl('https://api.openheaders.io:8443/v1/users')).toBe('api.openheaders.io');
    expect(hostOfUrl('http://127.0.0.1:3000/api/redirect')).toBe('127.0.0.1');
    expect(hostOfUrl('not a url')).toBe('');
  });
});

describe('getCookieAttributeInfoContent', () => {
  it('returns curated copy case-insensitively', () => {
    expect(getCookieAttributeInfoContent('httponly').title).toBe('HttpOnly');
    expect(getCookieAttributeInfoContent('SameSite').summary).toContain('cross-site');
    expect(getCookieAttributeInfoContent('max-age').title).toBe('Max-Age');
  });

  it('returns an honest fallback for unknown attributes', () => {
    const content = getCookieAttributeInfoContent('X-Custom-Ext');
    expect(content.title).toBe('X-Custom-Ext');
    expect(content.summary).toContain('not documented');
  });
});
