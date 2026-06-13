import {
  __resetCookieJarCacheForTests,
  __seedCookieJarForTests,
  cookieEditKey,
  getEditedCookieKeys,
  getJarCookiesForUrl,
  isCookieJarWritable,
  type JarCookie,
  removeJarCookie,
  setCookieJarWriter,
  writeJarCookie,
} from '@openheaders/ui/panel/data/cookie-jar-cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const URL = 'https://openheaders.io/api';
const SEEDED: JarCookie = {
  name: 'sid',
  value: 'old',
  domain: 'openheaders.io',
  path: '/',
  hostOnly: true,
  httpOnly: true,
  secure: true,
  session: true,
};

beforeEach(() => {
  __resetCookieJarCacheForTests();
});

describe('cookie-jar write seam', () => {
  it('reports not-writable until a writer is installed', () => {
    expect(isCookieJarWritable()).toBe(false);
    setCookieJarWriter({ set: vi.fn(), remove: vi.fn() });
    expect(isCookieJarWritable()).toBe(true);
  });

  it('writeJarCookie returns null and skips work when no writer is installed', async () => {
    const result = await writeJarCookie({
      name: 'sid',
      value: 'v',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
    });
    expect(result).toBeNull();
  });

  it('writeJarCookie forwards the edit and invalidates the cache', async () => {
    const written: JarCookie = { ...SEEDED, value: 'new' };
    const set = vi.fn(async () => written);
    setCookieJarWriter({ set, remove: vi.fn(async () => true) });

    // Seed a resolved entry, then confirm the write clears it.
    __seedCookieJarForTests(URL, [SEEDED]);
    expect(getJarCookiesForUrl(URL)).toEqual([SEEDED]);

    const result = await writeJarCookie({
      name: 'sid',
      value: 'new',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
    });

    expect(set).toHaveBeenCalledTimes(1);
    expect(result).toEqual(written);
    // Cache was invalidated → the synchronous read kicks off a fresh
    // lookup and returns null in the meantime.
    expect(getJarCookiesForUrl(URL)).toBeNull();
  });

  it('records the edited key on a successful write', async () => {
    const written: JarCookie = { ...SEEDED, value: 'new' };
    setCookieJarWriter({ set: vi.fn(async () => written), remove: vi.fn(async () => true) });

    expect(getEditedCookieKeys().has(cookieEditKey('sid', 'openheaders.io', '/'))).toBe(false);
    await writeJarCookie({
      name: 'sid',
      value: 'new',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
    });
    expect(getEditedCookieKeys().has(cookieEditKey('sid', 'openheaders.io', '/'))).toBe(true);
  });

  it('does not record an edited key when the write fails', async () => {
    setCookieJarWriter({ set: vi.fn(async () => null), remove: vi.fn(async () => true) });
    await writeJarCookie({
      name: 'sid',
      value: 'new',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
    });
    expect(getEditedCookieKeys().size).toBe(0);
  });

  it('removeJarCookie forwards the key and invalidates the cache', async () => {
    const remove = vi.fn(async () => true);
    setCookieJarWriter({ set: vi.fn(async () => null), remove });
    __seedCookieJarForTests(URL, [SEEDED]);

    const ok = await removeJarCookie({ name: 'sid', domain: 'openheaders.io', path: '/', secure: true });

    expect(remove).toHaveBeenCalledWith({ name: 'sid', domain: 'openheaders.io', path: '/', secure: true });
    expect(ok).toBe(true);
    expect(getJarCookiesForUrl(URL)).toBeNull();
  });

  it('swallows a writer that throws and still invalidates', async () => {
    setCookieJarWriter({
      set: vi.fn(async () => {
        throw new Error('boom');
      }),
      remove: vi.fn(async () => true),
    });
    __seedCookieJarForTests(URL, [SEEDED]);

    const result = await writeJarCookie({
      name: 'sid',
      value: 'new',
      domain: 'openheaders.io',
      path: '/',
      hostOnly: true,
      httpOnly: true,
      secure: true,
    });

    expect(result).toBeNull();
    expect(getJarCookiesForUrl(URL)).toBeNull();
  });
});
