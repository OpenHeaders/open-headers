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
