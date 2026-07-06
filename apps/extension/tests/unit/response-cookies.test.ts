/**
 * Response Cookies tab helpers — raw Set-Cookie parsing, the honest
 * persistence note, and the cookie-attributes doc corpus.
 */

import { getCookieAttributeInfoContent } from '@openheaders/ui/shared/info-popover/data/cookie-attributes';
import {
  cookiePersistenceNote,
  parseSetCookieLine,
  parseSetCookieLines,
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
