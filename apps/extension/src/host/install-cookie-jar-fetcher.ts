/**
 * Boot-time wiring: route the DevTools panel's cookie-jar cache through
 * the SW-side `chrome.cookies.getAll` handler.
 *
 * `chrome.cookies` is not reachable from the panel page — only the SW
 * holds that API. The cache exposes `setCookieJarFetcher` so hosts can
 * install their own fetch path; here, an RPC to the SW which calls
 * `chrome.cookies.getAll({ url })` and returns the normalised jar.
 *
 * Imported once from `apps/extension/src/panel/index.tsx` at panel boot.
 */

import type { JarCookie, JarCookieEdit, JarCookieKey, SiteJarCookie } from '@openheaders/ui/panel/host-cookie-jar';
import {
  setCookieJarFetcher,
  setCookieJarWriter,
  setSiteCookieJarFetcher,
} from '@openheaders/ui/panel/host-cookie-jar';
import { call } from '@utils/bridge';
import { logger } from '@utils/logger';

logger.info('CookieJarHost', 'installed');

setCookieJarFetcher(async (url: string): Promise<readonly JarCookie[] | null> => {
  try {
    const res = await call('fetchCookieJarForUrl', { url });
    return res?.cookies ?? null;
  } catch (err) {
    logger.info('CookieJarHost', `RPC ✗ ${url}: ${(err as Error).message}`);
    return null;
  }
});

setSiteCookieJarFetcher(async (url: string): Promise<readonly SiteJarCookie[] | null> => {
  try {
    const res = await call('fetchCookieJarForSite', { url });
    return res?.cookies ?? null;
  } catch (err) {
    logger.info('CookieJarHost', `site RPC ✗ ${url}: ${(err as Error).message}`);
    return null;
  }
});

setCookieJarWriter({
  async set(edit: JarCookieEdit): Promise<JarCookie | null> {
    try {
      const res = await call('setCookieForUrl', { cookie: edit });
      return res?.cookie ?? null;
    } catch (err) {
      logger.info('CookieJarHost', `set ✗ ${edit.name}: ${(err as Error).message}`);
      return null;
    }
  },
  async remove(key: JarCookieKey): Promise<boolean> {
    try {
      const res = await call('removeCookieForUrl', key);
      return res?.ok ?? false;
    } catch (err) {
      logger.info('CookieJarHost', `remove ✗ ${key.name}: ${(err as Error).message}`);
      return false;
    }
  },
  async clearSite(url: string): Promise<boolean> {
    try {
      const res = await call('clearCookiesForSite', { url });
      return res?.ok ?? false;
    } catch (err) {
      logger.info('CookieJarHost', `clear ✗ ${url}: ${(err as Error).message}`);
      return false;
    }
  },
});
