/**
 * SW-side SITE jar lookup + bulk clear (`fetchCookieJarForSite` /
 * `clearCookiesForSite`): the union of `getAll({domain})` (host +
 * subdomain scopes) and `getAll({url})` (adds parent-domain cookies),
 * deduped by identity, each row stamped `sendable` by membership in the
 * URL set — the browser's own attach verdict, never re-derived — and
 * the clear leg removing exactly that enumeration.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCookiesForSite, fetchCookieJarForSite } from '@/background/modules/net/fetch-cookie-jar';

type GetAllSpy = ReturnType<typeof vi.fn>;
const getAllSpy = (): GetAllSpy => chrome.cookies.getAll as unknown as GetAllSpy;
const removeSpy = (): GetAllSpy => chrome.cookies.remove as unknown as GetAllSpy;

function jarCookie(): chrome.cookies.Cookie {
  return {
    name: 'sid',
    value: 'abc',
    domain: 'app.openheaders.io',
    path: '/',
    secure: false,
    httpOnly: false,
    hostOnly: true,
    session: true,
    sameSite: 'lax',
    storeId: '0',
  };
}

function stubGetAll(byDomain: chrome.cookies.Cookie[], byUrl: chrome.cookies.Cookie[]): void {
  getAllSpy().mockImplementation(
    (details: chrome.cookies.GetAllDetails, callback?: (cookies: chrome.cookies.Cookie[]) => void) => {
      callback?.('url' in details && details.url ? byUrl : byDomain);
    },
  );
}

beforeEach(() => {
  getAllSpy().mockReset();
  removeSpy().mockReset();
  removeSpy().mockImplementation(
    (details: chrome.cookies.CookieDetails, callback?: (details: chrome.cookies.CookieDetails | null) => void) => {
      callback?.(details);
    },
  );
});

describe('fetchCookieJarForSite', () => {
  it('unions the domain and url sets, dedupes by identity, and stamps sendable from the url set', async () => {
    const sendable = jarCookie(); // in both sets
    const subScoped = { ...jarCookie(), name: 'sub', domain: 'api.app.openheaders.io' }; // domain set only
    const parentScoped = { ...jarCookie(), name: 'parent', domain: '.openheaders.io', hostOnly: false }; // url set only
    stubGetAll([sendable, subScoped], [sendable, parentScoped]);

    const { cookies } = await fetchCookieJarForSite('https://app.openheaders.io/');
    expect(cookies).toHaveLength(3);
    const byName = new Map(cookies?.map((c) => [c.name, c]));
    expect(byName.get('sid')?.sendable).toBe(true);
    expect(byName.get('sub')?.sendable).toBe(false);
    expect(byName.get('parent')?.sendable).toBe(true);

    const details = getAllSpy().mock.calls.map((c) => c[0]);
    expect(details).toContainEqual({ domain: 'app.openheaders.io' });
    expect(details).toContainEqual({ url: 'https://app.openheaders.io/' });
  });

  it('treats same-name cookies on different paths as distinct identities', async () => {
    const root = jarCookie();
    const scoped = { ...jarCookie(), path: '/account' };
    stubGetAll([root, scoped], [root]);

    const { cookies } = await fetchCookieJarForSite('https://app.openheaders.io/');
    expect(cookies).toHaveLength(2);
    expect(cookies?.find((c) => c.path === '/account')?.sendable).toBe(false);
  });

  it('returns null on an unparsable URL without touching the API', async () => {
    const { cookies } = await fetchCookieJarForSite('not a url');
    expect(cookies).toBeNull();
    expect(getAllSpy()).not.toHaveBeenCalled();
  });

  it('returns null when the jar lookup throws', async () => {
    getAllSpy().mockImplementation(() => {
      throw new Error('gone');
    });
    const { cookies } = await fetchCookieJarForSite('https://app.openheaders.io/');
    expect(cookies).toBeNull();
  });
});

describe('clearCookiesForSite', () => {
  it('removes every cookie of the site enumeration and reports ok', async () => {
    const a = jarCookie();
    const b = { ...jarCookie(), name: 'theme', domain: '.openheaders.io', hostOnly: false, secure: true };
    stubGetAll([a], [a, b]);

    const { ok } = await clearCookiesForSite('https://app.openheaders.io/');
    expect(ok).toBe(true);
    expect(removeSpy()).toHaveBeenCalledTimes(2);
    const urls = removeSpy().mock.calls.map((c) => (c[0] as chrome.cookies.CookieDetails).url);
    expect(urls).toContain('http://app.openheaders.io/');
    expect(urls).toContain('https://openheaders.io/');
  });

  it('reports ok: false when any single remove fails', async () => {
    const a = jarCookie();
    const b = { ...jarCookie(), name: 'theme' };
    stubGetAll([a, b], []);
    removeSpy()
      .mockImplementationOnce(
        (details: chrome.cookies.CookieDetails, callback?: (d: chrome.cookies.CookieDetails | null) => void) => {
          callback?.(details);
        },
      )
      .mockImplementationOnce(
        (_details: chrome.cookies.CookieDetails, callback?: (d: chrome.cookies.CookieDetails | null) => void) => {
          callback?.(null);
        },
      );

    const { ok } = await clearCookiesForSite('https://app.openheaders.io/');
    expect(ok).toBe(false);
  });

  it('reports ok: false when the enumeration itself fails', async () => {
    getAllSpy().mockImplementation(() => {
      throw new Error('gone');
    });
    const { ok } = await clearCookiesForSite('https://app.openheaders.io/');
    expect(ok).toBe(false);
    expect(removeSpy()).not.toHaveBeenCalled();
  });
});
