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

import { setCookieJarFetcher } from '@openheaders/ui/panel/host-cookie-jar';
import type { JarCookie } from '@openheaders/ui/panel/host-cookie-jar';
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
