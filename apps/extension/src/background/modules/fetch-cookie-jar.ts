/**
 * SW-side cookie-jar fetcher for the DevTools panel's Cookies tab.
 *
 * `chrome.cookies` is not exposed to the panel page — only background
 * contexts hold that API. The panel sends `fetchCookieJarForUrl` over
 * the bridge; this module answers with the cookies the browser jar
 * would consider sending on a request to `url`, plus their full
 * attribute set (Domain, Path, Expires, HttpOnly, Secure, SameSite,
 * Partition, …) which the HAR `request.cookies` shape doesn't carry.
 *
 * Every failure path returns `{ cookies: null }` — the renderer's
 * cache treats `null` as "no jar available" and falls back to the
 * HAR-only view silently.
 */

import { cookies as cookiesApi } from '@utils/browser-api';
import { logger } from '@utils/logger';

export interface FetchCookieJarResult {
  cookies: ReadonlyArray<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expirationDate?: number;
    hostOnly: boolean;
    httpOnly: boolean;
    secure: boolean;
    sameSite?: string;
    session: boolean;
    partitionKey?: string;
    storeId?: string;
  }> | null;
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
          const out = (raw ?? []).map((c) => ({
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
            ...(normalizePartitionKey((c as { partitionKey?: unknown }).partitionKey)
              ? { partitionKey: normalizePartitionKey((c as { partitionKey?: unknown }).partitionKey) }
              : {}),
            ...(c.storeId ? { storeId: c.storeId } : {}),
          }));
          resolve({ cookies: out });
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
