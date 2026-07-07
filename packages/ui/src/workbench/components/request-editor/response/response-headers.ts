/**
 * response-headers — pure helpers behind `ResponseHeadersView`.
 *
 * Rows render in snapshot order: the fetch `Headers` object already
 * normalizes names to lowercase and iterates them sorted, so the
 * snapshot carries the platform's canonical order — we don't re-sort
 * and we don't pretend to know the wire order the server used.
 */

import type { ExecutedRequestSnapshot } from '@openheaders/core/types';

export type ResponseHeaderRow = ExecutedRequestSnapshot['headers'][number];

/** Row count above which the Headers tab offers the filter box. */
export const HEADER_FILTER_THRESHOLD = 10;

/**
 * Merge the wire capture's raw `Set-Cookie` lines into the header rows.
 * `Set-Cookie` is a forbidden response header for `fetch()`, so the
 * snapshot's list never carries it — but the wire capture observed the
 * lines verbatim. Appended at the end: the fetch order is the
 * platform's sorted order and the true wire position is unknown.
 */
export function withWireCookieHeaders(
  headers: readonly ResponseHeaderRow[],
  setCookieHeaders: readonly string[] | undefined,
): ResponseHeaderRow[] {
  if (!setCookieHeaders || setCookieHeaders.length === 0) return [...headers];
  return [...headers, ...setCookieHeaders.map((value) => ({ key: 'set-cookie', value }))];
}

/**
 * Case-insensitive substring filter over name and value. A blank (or
 * whitespace-only) query keeps every row.
 */
export function filterHeaderRows(headers: readonly ResponseHeaderRow[], query: string): ResponseHeaderRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...headers];
  return headers.filter((h) => h.key.toLowerCase().includes(q) || h.value.toLowerCase().includes(q));
}

/** Serialize rows to `name: value` lines — the copy-all payload. */
export function serializeHeaderLines(headers: readonly ResponseHeaderRow[]): string {
  return headers.map((h) => `${h.key}: ${h.value}`).join('\n');
}
