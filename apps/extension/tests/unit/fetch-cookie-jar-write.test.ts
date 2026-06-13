import { beforeEach, describe, expect, it, type vi } from 'vitest';
import { removeCookieForUrl, setCookieForUrl } from '@/background/modules/fetch-cookie-jar';

// The handlers reach `chrome.cookies` through `@utils/browser-api`, which
// resolves to the global chrome mock (stubbed in tests/setup.ts). We drive
// the mock's `set`/`remove` spies and assert the URL reconstruction +
// attribute mapping the SW performs.

const setSpy = (): ReturnType<typeof vi.fn> => chrome.cookies.set as unknown as ReturnType<typeof vi.fn>;
const removeSpy = (): ReturnType<typeof vi.fn> => chrome.cookies.remove as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  setSpy().mockClear();
  removeSpy().mockClear();
});

describe('setCookieForUrl', () => {
  it('rebuilds an https URL for a secure domain cookie and keeps the Domain attribute', async () => {
    const res = await setCookieForUrl({
      name: 'sid',
      value: 'abc',
      domain: '.openheaders.io',
      path: '/api',
      hostOnly: false,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    const details = setSpy().mock.calls[0][0] as chrome.cookies.SetDetails;
    expect(details.url).toBe('https://openheaders.io/api');
    expect(details.domain).toBe('.openheaders.io');
    expect(details.httpOnly).toBe(true);
    expect(details.sameSite).toBe('lax');
    expect(res.cookie?.name).toBe('sid');
    expect(res.cookie?.httpOnly).toBe(true);
  });

  it('omits Domain for a host-only cookie and uses http when not secure', async () => {
    await setCookieForUrl({
      name: 'pref',
      value: '1',
      domain: 'app.openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: false,
    });

    const details = setSpy().mock.calls[0][0] as chrome.cookies.SetDetails;
    expect(details.url).toBe('http://app.openheaders.io/');
    expect(details.domain).toBeUndefined();
  });

  it('drops sameSite=unspecified and omits expirationDate for a session cookie', async () => {
    await setCookieForUrl({
      name: 's',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: true,
      sameSite: 'unspecified',
    });

    const details = setSpy().mock.calls[0][0] as chrome.cookies.SetDetails;
    expect(details.sameSite).toBeUndefined();
    expect(details.expirationDate).toBeUndefined();
  });

  it('forwards expirationDate and partitionKey when present', async () => {
    await setCookieForUrl({
      name: 'p',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: true,
      expirationDate: 4102444800,
      partitionKey: 'https://embed.openheaders.io',
    });

    const details = setSpy().mock.calls[0][0] as chrome.cookies.SetDetails;
    expect(details.expirationDate).toBe(4102444800);
    expect(details.partitionKey).toEqual({ topLevelSite: 'https://embed.openheaders.io' });
  });

  it('returns a null cookie when the name or domain is missing', async () => {
    const res = await setCookieForUrl({
      name: '',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: true,
    });
    expect(res.cookie).toBeNull();
    expect(setSpy()).not.toHaveBeenCalled();
  });

  it('returns a null cookie when chrome.cookies.set resolves null', async () => {
    setSpy().mockImplementationOnce((_d: chrome.cookies.SetDetails, cb?: (c: chrome.cookies.Cookie | null) => void) =>
      cb?.(null),
    );
    const res = await setCookieForUrl({
      name: 'sid',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: true,
    });
    expect(res.cookie).toBeNull();
  });
});

describe('removeCookieForUrl', () => {
  it('rebuilds the URL and forwards the cookie name', async () => {
    const res = await removeCookieForUrl({
      name: 'sid',
      domain: '.openheaders.io',
      path: '/api',
      secure: true,
    });

    const details = removeSpy().mock.calls[0][0] as chrome.cookies.CookieDetails;
    expect(details.url).toBe('https://openheaders.io/api');
    expect(details.name).toBe('sid');
    expect(res.ok).toBe(true);
  });

  it('forwards partitionKey + storeId when present', async () => {
    await removeCookieForUrl({
      name: 'sid',
      domain: 'openheaders.io',
      path: '/',
      secure: false,
      partitionKey: 'https://embed.openheaders.io',
      storeId: '1',
    });

    const details = removeSpy().mock.calls[0][0] as chrome.cookies.CookieDetails;
    expect(details.url).toBe('http://openheaders.io/');
    expect(details.partitionKey).toEqual({ topLevelSite: 'https://embed.openheaders.io' });
    expect(details.storeId).toBe('1');
  });

  it('reports ok=false when nothing was removed', async () => {
    removeSpy().mockImplementationOnce(
      (_d: chrome.cookies.CookieDetails, cb?: (d: chrome.cookies.CookieDetails | null) => void) => cb?.(null),
    );
    const res = await removeCookieForUrl({ name: 'sid', domain: 'openheaders.io', path: '/', secure: true });
    expect(res.ok).toBe(false);
  });
});
