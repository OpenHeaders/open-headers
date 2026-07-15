/**
 * Set-Cookie attribute docs registry — powers the response Cookies
 * tab's per-attribute popovers. Same in-app-docs discipline as the
 * http-headers and http-status corpora: `getCookieAttributeInfoContent`
 * always returns content — curated attributes get specific copy,
 * anything else an honest fallback. Prose lives in the i18n catalog
 * (`shared.info.cookie.*`); attribute names are wire vocabulary and
 * stay raw.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '../../types';

interface CookieAttributeEntry {
  /** Canonical spelling, shown regardless of the server's casing. */
  display: string;
  /** One-sentence meaning. */
  summaryKey: MessageKey;
  /** Optional extra guidance. */
  bodyKey?: MessageKey;
}

const ATTRIBUTE_INFO: ReadonlyMap<string, CookieAttributeEntry> = new Map<string, CookieAttributeEntry>([
  [
    'domain',
    {
      display: 'Domain',
      summaryKey: 'shared.info.cookie.domain.summary',
      bodyKey: 'shared.info.cookie.domain.body',
    },
  ],
  [
    'path',
    {
      display: 'Path',
      summaryKey: 'shared.info.cookie.path.summary',
    },
  ],
  [
    'expires',
    {
      display: 'Expires',
      summaryKey: 'shared.info.cookie.expires.summary',
      bodyKey: 'shared.info.cookie.expires.body',
    },
  ],
  [
    'max-age',
    {
      display: 'Max-Age',
      summaryKey: 'shared.info.cookie.maxAge.summary',
      bodyKey: 'shared.info.cookie.maxAge.body',
    },
  ],
  [
    'secure',
    {
      display: 'Secure',
      summaryKey: 'shared.info.cookie.secure.summary',
      bodyKey: 'shared.info.cookie.secure.body',
    },
  ],
  [
    'httponly',
    {
      display: 'HttpOnly',
      summaryKey: 'shared.info.cookie.httponly.summary',
      bodyKey: 'shared.info.cookie.httponly.body',
    },
  ],
  [
    'samesite',
    {
      display: 'SameSite',
      summaryKey: 'shared.info.cookie.samesite.summary',
      bodyKey: 'shared.info.cookie.samesite.body',
    },
  ],
  [
    'partitioned',
    {
      display: 'Partitioned',
      summaryKey: 'shared.info.cookie.partitioned.summary',
    },
  ],
  [
    'priority',
    {
      display: 'Priority',
      summaryKey: 'shared.info.cookie.priority.summary',
    },
  ],
]);

export function getCookieAttributeInfoContent(t: Translate, name: string): InfoPopoverContent {
  const entry = ATTRIBUTE_INFO.get(name.trim().toLowerCase());
  if (!entry) {
    return {
      title: name,
      kicker: t('shared.info.cookie.kicker'),
      summary: t('shared.info.cookie.fallbackSummary'),
      description: t('shared.info.cookie.fallbackDescription'),
    };
  }
  return {
    title: entry.display,
    kicker: t('shared.info.cookie.kicker'),
    summary: t(entry.summaryKey),
    ...(entry.bodyKey !== undefined ? { description: t(entry.bodyKey) } : {}),
  };
}

/** Count of curated attributes, exposed for tests + sanity checks. */
export function cookieAttributeInfoCount(): number {
  return ATTRIBUTE_INFO.size;
}
