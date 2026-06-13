/**
 * SW-side cookie-jar read + write path for the DevTools panel's Cookies tab.
 *
 * `chrome.cookies` is not exposed to the panel page — only background
 * contexts hold that API. The panel sends `fetchCookieJarForUrl` /
 * `setCookieForUrl` / `removeCookieForUrl` over the bridge; this module
 * answers.
 *
 * The read path returns the cookies the browser jar would consider
 * sending on a request to `url`, plus their full attribute set (Domain,
 * Path, Expires, HttpOnly, Secure, SameSite, Partition, …) which the HAR
 * `request.cookies` shape doesn't carry.
 *
 * The write path lets the panel add / edit / delete cookies the page's
 * own JS can't reach — HttpOnly is the point: `document.cookie` can't set
 * it, the extension's `cookies` permission can. `chrome.cookies.set`
 * needs a request URL it has host permission for, so we rebuild one from
 * the cookie's own domain / path / secure (a host-only domain drops its
 * leading dot).
 *
 * Every read failure returns `{ cookies: null }`; every write failure
 * returns a null cookie / `ok: false` — the renderer treats those as
 * "no jar write available" and surfaces the error without a half-applied
 * edit.
 */

import type { JarCookieEditWire, JarCookieKeyWire, JarCookieWire } from '@openheaders/core/bridge';
import { cookies as cookiesApi } from '@utils/browser-api';
import { logger } from '@utils/logger';

export interface FetchCookieJarResult {
  cookies: ReadonlyArray<JarCookieWire> | null;
}

export interface SetCookieResult {
  cookie: JarCookieWire | null;
}

export interface RemoveCookieResult {
  ok: boolean;
}

function normalizeSameSite(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  // chrome.cookies reports `no_restriction` | `lax` | `strict` | `unspecified`.
  // Pass through as-is — the renderer maps to its chip / display vocabulary.
  return raw;
}

function normalizePartitionKey(raw: unknown): string | undefined {
  // Different browsers/versions disagree on the shape here:
  //   - Chromium (current): `{ topLevelSite: 'https://example.com', hasCrossSiteAncestor?: boolean }`
  //   - Firefox: not implemented; field absent
  // Normalise to a printable string the chip layer can render.
  if (!raw || typeof raw !== 'object') return undefined;
  const tls = (raw as { topLevelSite?: unknown }).topLevelSite;
  return typeof tls === 'string' ? tls : undefined;
}

function normalizeCookie(c: chrome.cookies.Cookie): JarCookieWire {
  const partitionKey = normalizePartitionKey((c as { partitionKey?: unknown }).partitionKey);
  return {
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    ...(c.expirationDate != null ? { expirationDate: c.expirationDate } : {}),
    hostOnly: !!c.hostOnly,
    httpOnly: !!c.httpOnly,
    secure: !!c.secure,
    ...(c.sameSite ? { sameSite: normalizeSameSite(c.sameSite) } : {}),
    session: !!c.session,
    ...(partitionKey ? { partitionKey } : {}),
    ...(c.storeId ? { storeId: c.storeId } : {}),
  };
}

/**
 * `chrome.cookies.set`/`remove` need a request URL they hold host
 * permission for. Rebuild one from the cookie's own attributes: scheme
 * follows `secure`, host is the domain with any leading dot stripped
 * (a domain cookie's `.example.com` isn't a valid URL host), path is the
 * cookie path.
 */
function reconstructCookieUrl(domain: string, path: string, secure: boolean): string {
  const host = domain.replace(/^\./, '');
  return `${secure ? 'https' : 'http'}://${host}${path || '/'}`;
}

function toPartitionKey(raw: string | undefined): chrome.cookies.CookiePartitionKey | undefined {
  return raw ? { topLevelSite: raw } : undefined;
}

export async function fetchCookieJarForUrl(url: string): Promise<FetchCookieJarResult> {
  const api = cookiesApi;
  if (!api) {
    logger.info('CookieJarFetch', 'cookies API unavailable');
    return { cookies: null };
  }
  if (!url) return { cookies: null };

  return await new Promise<FetchCookieJarResult>((resolve) => {
    try {
      api.getAll({ url }, (raw) => {
        try {
          resolve({ cookies: (raw ?? []).map(normalizeCookie) });
        } catch (e) {
          logger.info('CookieJarFetch', `normalise threw: ${(e as Error).message}`);
          resolve({ cookies: null });
        }
      });
    } catch (e) {
      logger.info('CookieJarFetch', `getAll threw: ${(e as Error).message}`);
      resolve({ cookies: null });
    }
  });
}

export async function setCookieForUrl(cookie: JarCookieEditWire): Promise<SetCookieResult> {
  const api = cookiesApi;
  if (!api) {
    logger.info('CookieJarWrite', 'cookies API unavailable');
    return { cookie: null };
  }
  if (!cookie?.name || !cookie.domain) return { cookie: null };

  const details: chrome.cookies.SetDetails = {
    url: reconstructCookieUrl(cookie.domain, cookie.path, cookie.secure),
    name: cookie.name,
    value: cookie.value,
    path: cookie.path,
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    // A host-only cookie is expressed by omitting Domain — the browser
    // pins it to the URL host. A domain cookie carries Domain explicitly.
    ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
    ...(cookie.sameSite && cookie.sameSite !== 'unspecified'
      ? { sameSite: cookie.sameSite as chrome.cookies.SameSiteStatus }
      : {}),
    // No expirationDate ⇒ session cookie, mirroring chrome.cookies.set.
    ...(cookie.expirationDate != null ? { expirationDate: cookie.expirationDate } : {}),
    ...(toPartitionKey(cookie.partitionKey) ? { partitionKey: toPartitionKey(cookie.partitionKey) } : {}),
    ...(cookie.storeId ? { storeId: cookie.storeId } : {}),
  };

  return await new Promise<SetCookieResult>((resolve) => {
    try {
      api.set(details, (c) => {
        resolve({ cookie: c ? normalizeCookie(c) : null });
      });
    } catch (e) {
      logger.info('CookieJarWrite', `set threw: ${(e as Error).message}`);
      resolve({ cookie: null });
    }
  });
}

export async function removeCookieForUrl(key: JarCookieKeyWire): Promise<RemoveCookieResult> {
  const api = cookiesApi;
  if (!api) {
    logger.info('CookieJarWrite', 'cookies API unavailable');
    return { ok: false };
  }
  if (!key?.name || !key.domain) return { ok: false };

  const details: chrome.cookies.CookieDetails = {
    url: reconstructCookieUrl(key.domain, key.path, key.secure),
    name: key.name,
    ...(toPartitionKey(key.partitionKey) ? { partitionKey: toPartitionKey(key.partitionKey) } : {}),
    ...(key.storeId ? { storeId: key.storeId } : {}),
  };

  return await new Promise<RemoveCookieResult>((resolve) => {
    try {
      api.remove(details, (removed) => {
        // chrome.cookies.remove resolves the removed cookie's details, or
        // null when nothing matched.
        resolve({ ok: !!removed });
      });
    } catch (e) {
      logger.info('CookieJarWrite', `remove threw: ${(e as Error).message}`);
      resolve({ ok: false });
    }
  });
}
