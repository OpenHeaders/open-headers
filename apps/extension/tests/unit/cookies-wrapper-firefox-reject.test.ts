import type * as BrowserRuntimeModule from '@utils/browser-runtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// PB1 — the Firefox cookie wrapper must not hang the bridge on a rejection.
//
// `browser.cookies.set`/`remove` REJECT on Firefox for an invalid write
// (a `__Host-`/`__Secure-` prefix violated, `SameSite=None` without
// Secure); `getAll` can reject too (permission revoked mid-read). The
// SW-side write/read path resolves a `new Promise` only from the wrapper
// callback, and the bridge `call` has no timeout — so if the rejection is
// swallowed and the callback never fires, the whole RPC hangs forever.
// The Firefox branch must invoke the callback with the null/empty sentinel
// on rejection, matching Chrome's always-fires callback form.
//
// These probes exercise the REAL wrapper (browser-api is not mocked) with
// `isFirefox` forced true via the runtime module + a rejecting `chrome.cookies.*`.
vi.mock('@utils/browser-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof BrowserRuntimeModule>();
  return { ...actual, isFirefox: true };
});

import { cookies } from '@utils/browser-api';
import { removeCookieForUrl, setCookieForUrl } from '@/background/modules/net/fetch-cookie-jar';

const cookiesApi = cookies!;

const getAllSpy = (): ReturnType<typeof vi.fn> => chrome.cookies.getAll as unknown as ReturnType<typeof vi.fn>;
const setSpy = (): ReturnType<typeof vi.fn> => chrome.cookies.set as unknown as ReturnType<typeof vi.fn>;
const removeSpy = (): ReturnType<typeof vi.fn> => chrome.cookies.remove as unknown as ReturnType<typeof vi.fn>;

const setDetails: chrome.cookies.SetDetails = {
  url: 'https://openheaders.io/',
  name: '__Host-sid',
  value: 'abc',
  path: '/',
  secure: false,
};

const removeDetails: chrome.cookies.CookieDetails = {
  url: 'https://openheaders.io/',
  name: 'sid',
};

beforeEach(() => {
  getAllSpy().mockClear();
  setSpy().mockClear();
  removeSpy().mockClear();
});

describe('cookies wrapper — Firefox rejection invokes the callback (PB1)', () => {
  it('invokes the set callback with null + the rejection reason when the Firefox promise rejects', async () => {
    setSpy().mockImplementationOnce(() => Promise.reject(new Error('__Host- prefix requires Secure')));
    const cb = vi.fn();
    await Promise.resolve(cookiesApi.set(setDetails, cb)).catch(() => {});
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(null, '__Host- prefix requires Secure');
  });

  it('invokes the remove callback with null when the Firefox promise rejects', async () => {
    removeSpy().mockImplementationOnce(() => Promise.reject(new Error('no host permission')));
    const cb = vi.fn();
    await Promise.resolve(cookiesApi.remove(removeDetails, cb)).catch(() => {});
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(null);
  });

  it('invokes the getAll callback with an empty array when the Firefox promise rejects', async () => {
    getAllSpy().mockImplementationOnce(() => Promise.reject(new Error('permission revoked')));
    const cb = vi.fn();
    await Promise.resolve(cookiesApi.getAll({ url: 'https://openheaders.io/' }, cb)).catch(() => {});
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith([]);
  });

  it('still forwards the resolved cookie on a successful Firefox set', async () => {
    const cookie = { name: 'sid', value: 'v' } as chrome.cookies.Cookie;
    setSpy().mockImplementationOnce(() => Promise.resolve(cookie));
    const cb = vi.fn();
    await Promise.resolve(cookiesApi.set(setDetails, cb)).catch(() => {});
    expect(cb).toHaveBeenCalledWith(cookie);
  });
});

describe('cookie-jar write path no longer hangs on a Firefox rejection (PB1)', () => {
  it('setCookieForUrl resolves { cookie: null } with the rejection reason instead of hanging', async () => {
    setSpy().mockImplementationOnce(() => Promise.reject(new Error('__Host- prefix requires Secure')));
    const res = await setCookieForUrl({
      name: '__Host-sid',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: false,
      secure: false,
    });
    expect(res).toEqual({ cookie: null, error: '__Host- prefix requires Secure' });
  });

  it('removeCookieForUrl resolves { ok: false } instead of hanging', async () => {
    removeSpy().mockImplementationOnce(() => Promise.reject(new Error('no host permission')));
    const res = await removeCookieForUrl({ name: 'sid', domain: 'openheaders.io', path: '/', secure: true });
    expect(res).toEqual({ ok: false });
  });
});
