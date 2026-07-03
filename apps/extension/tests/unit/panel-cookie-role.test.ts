import { classifyCookie, classifyCookieRole, roleSortOrder } from '@openheaders/ui/panel/data/cookies/cookie-role';
import { describe, expect, it } from 'vitest';

describe('classifyCookieRole', () => {
  it('classifies common auth names as auth', () => {
    for (const name of [
      'session',
      'sess',
      'auth',
      '_gh_sess',
      'JSESSIONID',
      'PHPSESSID',
      'csrf_token',
      'access_token',
      'XSRF-TOKEN',
      'connect.sid',
      'authenticity_token',
      '__RequestVerificationToken',
    ]) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('auth');
    }
  });

  it('classifies known trackers as tracking', () => {
    for (const name of [
      '_ga',
      '_ga_ABC123',
      '_gid',
      '_fbp',
      '_fbc',
      'IDE',
      'NID',
      '_pin_unauth_xyz',
      '_uetsid',
      'MUID',
      'datr',
      '_hjid',
      'mp_abc',
      '__hssrc',
      'hubspotutk',
      's_cc',
      'mbox',
      'amplitude_id',
      '_clck',
      '_clsk',
      '__qca',
      'tdid',
      'cto_bundle',
    ]) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('tracking');
    }
  });

  it('classifies preferences as pref', () => {
    for (const name of ['tz', 'lang', 'theme', 'preferred_color_mode', 'currency', 'cpu_bucket']) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('pref');
    }
  });

  it('classifies consent / cookie-banner cookies as pref', () => {
    for (const name of ['OptanonConsent', 'OptanonAlertBoxClosed', 'CookieConsent', 'euconsent-v2']) {
      expect(classifyCookieRole({ name, value: 'v' })).toBe('pref');
    }
  });

  it('classifies CDN / load-balancer / WAF cookies as functional, not auth', () => {
    // These are HttpOnly + long random — would trip the structural
    // auth heuristic if the vendor table didn't catch them first.
    const longRandom = 'A'.repeat(48);
    for (const name of [
      'AWSALB',
      'AWSALBCORS',
      'AWSELB',
      '__cf_bm',
      'cf_clearance',
      '__cfduid',
      '_abck',
      'ak_bmsc',
      'bm_sz',
      'incap_ses_123_456',
      'visid_incap_789',
      'BIGipServerpool_app',
      'ARRAffinity',
      '_dd_s',
      'dtCookie',
    ]) {
      expect(classifyCookieRole({ name, value: longRandom, httpOnly: true, session: false })).toBe('functional');
    }
  });

  it('strips __Host- / __Secure- prefixes before classifying', () => {
    // The prefix is a security flag, not a category — the underlying
    // name decides the role.
    expect(classifyCookieRole({ name: '__Secure-_ga_ABC123', value: 'v' })).toBe('tracking');
    expect(classifyCookieRole({ name: '__Host-OptanonConsent', value: 'v' })).toBe('pref');
    // But Google's own __Secure-1PSIDCC, __Host-3PLSID etc. ARE auth.
    expect(classifyCookieRole({ name: '__Secure-1PSIDCC', value: 'v' })).toBe('auth');
    expect(classifyCookieRole({ name: '__Host-3PLSID', value: 'v' })).toBe('auth');
    expect(classifyCookieRole({ name: '__Host-GAPS', value: 'v' })).toBe('auth');
  });

  it('uses structural shape to promote unknown HttpOnly random-looking cookies to auth', () => {
    expect(
      classifyCookieRole({
        name: 'qwertysessionid',
        value: 'aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV',
        httpOnly: true,
        session: false,
      }),
    ).toBe('auth');
  });

  it('does NOT promote HttpOnly random cookies whose names suggest non-auth', () => {
    const longRandom = 'A'.repeat(48);
    for (const name of [
      'consent_v2',
      'tracking_id',
      'analytics_blob',
      'cart_token',
      'preferred_layout',
      'dismiss_banner',
      'tour_state',
      'color_mode_v2',
    ]) {
      expect(classifyCookieRole({ name, value: longRandom, httpOnly: true, session: false })).not.toBe('auth');
    }
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

describe('classifyCookie (vendor attribution)', () => {
  it('returns the vendor for well-known cookies', () => {
    expect(classifyCookie({ name: '_ga', value: 'v' })).toEqual({ role: 'tracking', vendor: 'Google Analytics' });
    expect(classifyCookie({ name: '__cf_bm', value: 'v' })).toEqual({
      role: 'functional',
      vendor: 'Cloudflare Bot Management',
    });
    expect(classifyCookie({ name: 'OptanonConsent', value: 'v' })).toEqual({
      role: 'pref',
      vendor: 'OneTrust Cookiebot',
    });
    expect(classifyCookie({ name: '__Secure-1PSIDCC', value: 'v' })).toMatchObject({
      role: 'auth',
      vendor: 'Google identity',
    });
  });

  it('returns no vendor for purely structural / keyword matches', () => {
    expect(classifyCookie({ name: 'my_custom_session', value: 'v' })).toEqual({ role: 'auth' });
    expect(classifyCookie({ name: 'theme', value: 'dark' })).toEqual({ role: 'pref' });
  });
});
