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

const DIRECTION_LABEL: Record<HeaderDirection, string> = {
  request: 'Request header',
  response: 'Response header',
  both: 'Request / Response header',
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
export function getHeaderInfoContent(name: string): InfoPopoverContent | null {
  const entry = HEADER_INFO.get(name.toLowerCase());
  if (!entry) return null;
  const sections: InfoPopoverSection[] = [];
  if (entry.directives && entry.directives.length > 0) {
    sections.push({
      heading: 'Directives',
      items: entry.directives.map((d) => ({ label: d.key, desc: d.desc })),
    });
  }
  if (entry.commonValues && entry.commonValues.length > 0) {
    sections.push({
      heading: 'Common values',
      items: entry.commonValues.map((v) => ({ label: v.value, desc: v.desc })),
    });
  }
  return {
    title: entry.display,
    kicker: `${DIRECTION_LABEL[entry.direction]} · ${entry.category}`,
    summary: entry.summary,
    description:
      entry.body && entry.body.length > 0
        ? entry.body.map((p, i) => (
            <p key={`${entry.display}-p-${i}`} style={{ margin: i === 0 ? 0 : '4px 0 0' }}>
              {p}
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
  name: string,
  direction: RowDirection,
  rowCategory: string,
): InfoPopoverContent {
  const rich = getHeaderInfoContent(name);
  if (rich) return rich;
  const directionLabel = direction === 'request' ? 'Request header' : 'Response header';
  const isCustom = name.toLowerCase().startsWith('x-') || rowCategory.toLowerCase() === 'other';
  return {
    title: name,
    kicker: isCustom ? `${directionLabel} · Custom or non-standard` : `${directionLabel} · ${rowCategory}`,
    summary: isCustom
      ? 'This header is custom or non-standard — no documentation in our registry.'
      : `${name} is not yet documented in our registry. The row classifies it as ${rowCategory}.`,
  };
}
