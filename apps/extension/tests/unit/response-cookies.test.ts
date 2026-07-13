/**
 * Response Cookies tab helpers — raw Set-Cookie parsing, locating the
 * lines per runtime, the honest persistence notes, and the
 * cookie-attributes doc corpus.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';
import { getCookieAttributeInfoContent } from '@openheaders/ui/shared/info-popover/data/cookie-attributes';
import {
  cookiePersistenceNote,
  hostOfUrl,
  jarPersistenceNote,
  parseSetCookieLine,
  parseSetCookieLines,
  persistenceNoteFor,
  setCookieLinesOf,
  toCookieGridRow,
} from '@openheaders/ui/workbench/components/request-editor/response/response-cookies';
import { describe, expect, it } from 'vitest';

function makeSnapshot(overrides: Partial<ExecutedRequestSnapshot> = {}): ExecutedRequestSnapshot {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://api.openheaders.io/v1/login',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body: '{}',
    bodyTruncated: false,
    bodyBytes: 2,
    durationMs: 12,
    error: null,
    ...overrides,
  };
}

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

describe('setCookieLinesOf', () => {
  it('reads the browser wire capture when one carries lines', () => {
    const snapshot = makeSnapshot({
      wire: { credentialsMode: 'omit', setCookieHeaders: ['session=abc; Path=/', 'theme=dark'] },
    });
    expect(setCookieLinesOf(snapshot)).toEqual(['session=abc; Path=/', 'theme=dark']);
  });

  it('reads set-cookie header rows case-insensitively on node snapshots (no wire capture)', () => {
    const snapshot = makeSnapshot({
      headers: [
        { key: 'content-type', value: 'application/json' },
        { key: 'set-cookie', value: 'session=abc; Path=/; HttpOnly' },
        { key: 'Set-Cookie', value: 'theme=dark; Max-Age=3600' },
      ],
    });
    expect(setCookieLinesOf(snapshot)).toEqual(['session=abc; Path=/; HttpOnly', 'theme=dark; Max-Age=3600']);
  });

  it('returns empty when neither source has cookies', () => {
    expect(setCookieLinesOf(makeSnapshot())).toEqual([]);
    expect(setCookieLinesOf(makeSnapshot({ wire: { credentialsMode: 'include' } }))).toEqual([]);
  });
});

describe('cookiePersistenceNote', () => {
  it('says discarded under omit and possibly stored under include', () => {
    expect(cookiePersistenceNote('omit')).toContain('discarded');
    expect(cookiePersistenceNote('include')).toContain('stored');
  });
});

describe('jarPersistenceNote', () => {
  it('says not stored when the snapshot carries no capture attribution', () => {
    expect(jarPersistenceNote(undefined, ['session'])).toContain('not stored');
    expect(jarPersistenceNote([], ['session'])).toContain('not stored');
  });

  it('names the stored cookies when the jar captured them', () => {
    const note = jarPersistenceNote(['session', 'theme'], ['session', 'theme']);
    expect(note).toContain('session, theme');
    expect(note).not.toContain('redirect hops');
  });

  it('flags mid-chain captures whose lines the final-hop headers cannot show', () => {
    const note = jarPersistenceNote(['session', 'csrf'], ['session']);
    expect(note).toContain('csrf');
    expect(note).toContain('redirect hops');
  });
});

describe('persistenceNoteFor', () => {
  it('uses the credentials-mode note when a wire capture exists', () => {
    const snapshot = makeSnapshot({ wire: { credentialsMode: 'omit', setCookieHeaders: ['a=1'] } });
    expect(persistenceNoteFor(snapshot, ['a'])).toBe(cookiePersistenceNote('omit'));
  });

  it('uses the jar note on node snapshots, from the snapshot attribution only', () => {
    const snapshot = makeSnapshot({
      headers: [{ key: 'set-cookie', value: 'session=abc' }],
      cookiesCaptured: ['session'],
    });
    expect(persistenceNoteFor(snapshot, ['session'])).toBe(jarPersistenceNote(['session'], ['session']));
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
