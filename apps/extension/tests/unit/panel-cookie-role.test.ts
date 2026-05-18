import { classifyCookieRole, roleSortOrder } from '@openheaders/ui/panel/data/cookie-role';
import { describe, expect, it } from 'vitest';

describe('classifyCookieRole', () => {
  it('classifies common auth names as auth', () => {
    for (const name of ['session', 'sess', 'auth', '_gh_sess', 'JSESSIONID', 'PHPSESSID', 'csrf_token', 'access_token', 'XSRF-TOKEN']) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('auth');
    }
  });

  it('classifies known trackers as tracking', () => {
    for (const name of ['_ga', '_gid', '_fbp', 'IDE', 'NID', '_pin_unauth_xyz', '_uetsid', 'MUID', 'datr', '_hjid', 'mp_abc']) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('tracking');
    }
  });

  it('classifies preferences as pref', () => {
    for (const name of ['tz', 'lang', 'theme', 'preferred_color_mode', 'currency', 'cpu_bucket']) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('pref');
    }
  });

  it('uses structural shape to promote unknown HttpOnly random-looking cookies to auth', () => {
    expect(
      classifyCookieRole({
        name: 'qwerty',
        value: 'aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV',
        httpOnly: true,
        session: false,
      }),
    ).toBe('auth');
  });

  it('falls back to tracking for unknown 3rd-party cookies', () => {
    expect(classifyCookieRole({ name: 'whatever', value: 'v', thirdParty: true })).toBe('tracking');
  });

  it('falls back to functional for everything else', () => {
    expect(classifyCookieRole({ name: 'foo', value: 'v' })).toBe('functional');
  });

  it('orders roles auth → functional → pref → tracking', () => {
    expect(roleSortOrder('auth')).toBeLessThan(roleSortOrder('functional'));
    expect(roleSortOrder('functional')).toBeLessThan(roleSortOrder('pref'));
    expect(roleSortOrder('pref')).toBeLessThan(roleSortOrder('tracking'));
  });
});
