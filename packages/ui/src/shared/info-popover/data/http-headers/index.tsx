/**
 * HTTP-header docs registry — assembled from per-category files in
 * this directory. Powers the `(i)` triggers on the Headers tab via
 * `<InfoTrigger>` — no docs panel involvement.
 *
 * Adding a header:
 *   1. Append the entry to the right `./<category>.ts` file.
 *   2. Add the same name to `./header-category.ts` so header rows
 *      bucket the name under the matching category.
 *
 * `getHeaderInfoContentForRow(name, direction, rowCategory)` always
 * returns content — known headers get rich details, unknown ones get
 * an honest fallback (name + direction + the category the row was
 * bucketed into) so the (i) is useful for every row, not just
 * curated ones.
 */

import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent, InfoPopoverSection } from '../../types';
import { AUTH_HEADERS } from './auth';
import { CACHING_HEADERS } from './caching';
import { CLIENT_HINTS_HEADERS } from './client-hints';
import { CONNECTION_HEADERS } from './connection';
import { CONTENT_HEADERS } from './content';
import { COOKIES_HEADERS } from './cookies';
import { CORS_HEADERS } from './cors';
import { FETCH_METADATA_HEADERS } from './fetch-metadata';
import { PERFORMANCE_HEADERS } from './performance';
import { PRIVACY_HEADERS } from './privacy';
import { PROXY_HEADERS } from './proxy';
import { ROUTING_HEADERS } from './routing';
import { SECURITY_HEADERS } from './security';
import { SERVER_IDENTIFICATION_HEADERS } from './server-id';
import { TRACING_HEADERS } from './tracing';
import type { HeaderDirection, HeaderInfoEntry, RowDirection } from './types';

export type { HeaderCategory, HeaderDirection, HeaderInfoEntry, RowDirection } from './types';

const HEADER_INFO: ReadonlyMap<string, HeaderInfoEntry> = new Map<string, HeaderInfoEntry>([
  ...CORS_HEADERS,
  ...CACHING_HEADERS,
  ...SECURITY_HEADERS,
  ...COOKIES_HEADERS,
  ...CONTENT_HEADERS,
  ...AUTH_HEADERS,
  ...TRACING_HEADERS,
  ...CLIENT_HINTS_HEADERS,
  ...FETCH_METADATA_HEADERS,
  ...ROUTING_HEADERS,
  ...CONNECTION_HEADERS,
  ...PRIVACY_HEADERS,
  ...PERFORMANCE_HEADERS,
  ...SERVER_IDENTIFICATION_HEADERS,
  ...PROXY_HEADERS,
]);

const DIRECTION_KEY: Record<HeaderDirection, MessageKey> = {
  request: 'shared.info.header.direction.request',
  response: 'shared.info.header.direction.response',
  both: 'shared.info.header.direction.both',
};

/** True when we have a documented explanation for this header name. */
export function hasHeaderInfo(name: string): boolean {
  return HEADER_INFO.has(name.toLowerCase());
}

/** Look up the entry; useful when callers want the raw fields. */
export function getHeaderInfo(name: string): HeaderInfoEntry | null {
  return HEADER_INFO.get(name.toLowerCase()) ?? null;
}

/**
 * Map a known header to a fully-formed `InfoPopoverContent`. Returns
 * `null` when the header isn't in the registry — most callers should
 * prefer `getHeaderInfoContentForRow` which always returns content.
 */
export function getHeaderInfoContent(t: Translate, name: string): InfoPopoverContent | null {
  const entry = HEADER_INFO.get(name.toLowerCase());
  if (!entry) return null;
  const sections: InfoPopoverSection[] = [];
  if (entry.directives && entry.directives.length > 0) {
    sections.push({
      heading: t('shared.info.header.section.directives'),
      items: entry.directives.map((d) => ({ label: d.key, desc: t(d.descKey) })),
    });
  }
  if (entry.commonValues && entry.commonValues.length > 0) {
    sections.push({
      heading: t('shared.info.header.section.commonValues'),
      items: entry.commonValues.map((v) => ({ label: v.value, desc: t(v.descKey) })),
    });
  }
  return {
    title: entry.display,
    kicker: t('shared.info.header.kicker', { direction: t(DIRECTION_KEY[entry.direction]), category: entry.category }),
    summary: t(entry.summaryKey),
    description:
      entry.bodyKeys && entry.bodyKeys.length > 0
        ? entry.bodyKeys.map((k, i) => (
            <p key={`${entry.display}-p-${i}`} style={{ margin: i === 0 ? 0 : '4px 0 0' }}>
              {t(k)}
            </p>
          ))
        : undefined,
    sections,
  };
}

/** Count of known headers, exposed for tests + sanity checks. */
export function headerInfoCount(): number {
  return HEADER_INFO.size;
}

/**
 * Always-returns variant for row triggers. Uses the rich registry
 * entry when we have one; otherwise builds an honest fallback that
 * still tells the user *something* (name, direction, the category
 * the row was bucketed into). The fallback exists because every row
 * benefits from an (i) — a custom `X-*` header still has a known
 * direction worth showing, and "no documentation in our registry"
 * is itself useful signal.
 */
export function getHeaderInfoContentForRow(
  t: Translate,
  name: string,
  direction: RowDirection,
  rowCategory: string,
): InfoPopoverContent {
  const rich = getHeaderInfoContent(t, name);
  if (rich) return rich;
  const directionLabel = t(DIRECTION_KEY[direction]);
  const isCustom = name.toLowerCase().startsWith('x-') || rowCategory.toLowerCase() === 'other';
  return {
    title: name,
    kicker: t('shared.info.header.kicker', {
      direction: directionLabel,
      category: isCustom ? t('shared.info.header.fallback.customCategory') : rowCategory,
    }),
    summary: isCustom
      ? t('shared.info.header.fallback.customSummary')
      : t('shared.info.header.fallback.unknownSummary', { name, category: rowCategory }),
  };
}
