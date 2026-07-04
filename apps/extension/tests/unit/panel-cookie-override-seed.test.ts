import type { CookieRow } from '@openheaders/ui/panel/data/cookies/cookie-model';
import {
  cookieOverrideVarName,
  seedRequestCookieOverride,
  seedResponseCookieOverride,
} from '@openheaders/ui/panel/data/cookies/cookie-override-seed';
import { describe, expect, it } from 'vitest';

const URL = 'https://app.openheaders.io/dashboard';

function row(over: Partial<CookieRow> = {}): CookieRow {
  return {
    name: 'theme',
    value: 'dark',
    direction: 'request',
    attribution: 'request-jar',
    id: 'r:1',
    size: 10,
    ...over,
  };
}

describe('cookieOverrideVarName', () => {
  it('builds a domain-scoped sanitized name', () => {
    expect(cookieOverrideVarName('sessionid', URL)).toBe('cookie_sessionid_openheaders_io');
  });

  it('sanitizes prefix punctuation in the cookie name', () => {
    expect(cookieOverrideVarName('__Host-session', URL)).toBe('cookie_Host_session_openheaders_io');
  });

  it('returns null without a derivable domain', () => {
    expect(cookieOverrideVarName('sess', 'not a url')).toBeNull();
  });
});

describe('seedRequestCookieOverride', () => {
  it('joins sent cookies with "; " keeping literal values for non-auth roles', () => {
    const seed = seedRequestCookieOverride(
      [row({ name: 'theme', value: 'dark' }), row({ name: '_ga', value: 'GA1.2.111', id: 'r:2' })],
      URL,
    );
    expect(seed).toBe('theme=dark; _ga=GA1.2.111');
  });

  it('templates auth-classified values as domain-scoped variable references', () => {
    const seed = seedRequestCookieOverride(
      [row({ name: 'sessionid', value: 'abc123xyz' }), row({ name: 'theme', value: 'dark', id: 'r:2' })],
      URL,
    );
    expect(seed).toBe('sessionid={{cookie_sessionid_openheaders_io}}; theme=dark');
  });

  it('skips filtered-out rows', () => {
    const seed = seedRequestCookieOverride(
      [row({ name: 'theme', value: 'dark' }), row({ name: 'old', value: 'x', attribution: 'filtered-out', id: 'r:2' })],
      URL,
    );
    expect(seed).toBe('theme=dark');
  });

  it('falls back to a syntax skeleton when nothing was sent', () => {
    expect(seedRequestCookieOverride([], URL)).toBe('session={{cookie_session_openheaders_io}}; theme=dark');
  });

  it('keeps the auth value literal when no domain is derivable', () => {
    const seed = seedRequestCookieOverride([row({ name: 'sessionid', value: 'abc123xyz' })], 'not a url');
    expect(seed).toBe('sessionid=abc123xyz');
  });
});

describe('seedResponseCookieOverride', () => {
  it('rebuilds the Set-Cookie line with attributes in order', () => {
    const seed = seedResponseCookieOverride(
      [
        row({
          name: 'theme',
          value: 'dark',
          direction: 'response',
          attribution: 'response-set',
          domain: '.openheaders.io',
          path: '/',
          maxAge: 3600,
          secure: true,
          httpOnly: true,
          sameSite: 'lax',
        }),
      ],
      URL,
    );
    expect(seed).toBe('theme=dark; Domain=.openheaders.io; Path=/; Max-Age=3600; Secure; HttpOnly; SameSite=Lax');
  });

  it('templates an auth value and maps SameSite no_restriction to None', () => {
    const seed = seedResponseCookieOverride(
      [
        row({
          name: 'sessionid',
          value: 'abc123xyz',
          direction: 'response',
          attribution: 'response-set',
          secure: true,
          sameSite: 'no_restriction',
        }),
      ],
      URL,
    );
    expect(seed).toBe('sessionid={{cookie_sessionid_openheaders_io}}; Secure; SameSite=None');
  });

  it('prefers Max-Age over raw Expires, and raw Expires over the parsed date', () => {
    const base = { direction: 'response' as const, attribution: 'response-set' as const };
    expect(
      seedResponseCookieOverride(
        [row({ ...base, maxAge: 60, expiresRaw: 'Thu, 01 Jan 2026 00:00:00 GMT', expirationDate: 1_767_225_600 })],
        URL,
      ),
    ).toContain('Max-Age=60');
    expect(
      seedResponseCookieOverride(
        [row({ ...base, expiresRaw: 'Thu, 01 Jan 2026 00:00:00 GMT', expirationDate: 1_767_225_600 })],
        URL,
      ),
    ).toContain('Expires=Thu, 01 Jan 2026 00:00:00 GMT');
    expect(seedResponseCookieOverride([row({ ...base, expirationDate: 1_767_225_600 })], URL)).toContain(
      'Expires=Thu, 01 Jan 2026 00:00:00 GMT',
    );
  });

  it('serializes Partitioned and Priority', () => {
    const seed = seedResponseCookieOverride(
      [
        row({
          direction: 'response',
          attribution: 'response-set',
          partitionKey: '(set: Partitioned)',
          priority: 'High',
        }),
      ],
      URL,
    );
    expect(seed).toBe('theme=dark; Partitioned; Priority=High');
  });

  it('falls back to a Set-Cookie skeleton when the response set nothing', () => {
    expect(seedResponseCookieOverride([], URL)).toBe(
      'session={{cookie_session_openheaders_io}}; Path=/; Secure; HttpOnly; SameSite=Lax',
    );
  });
});
