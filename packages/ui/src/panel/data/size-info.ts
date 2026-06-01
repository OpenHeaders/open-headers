/**
 * Size-column data model.
 *
 * The Size column is three different pieces of information collapsed
 * into one:
 *
 *   - "Pending" while the response body hasn't arrived.
 *   - A cache-source label (`(disk cache)`, `(memory cache)`,
 *     `(ServiceWorker)`) when the wire wasn't hit.
 *   - The bytes transferred over the wire when it was. Compressed
 *     responses send fewer bytes than the page ultimately uses — the
 *     decoded resource size rides along in the cell tooltip.
 *
 * The cell shows a single value, always in kB so a column of sizes
 * stays in one unit; the transferred size is the visible figure and
 * the resource size lives in the tooltip.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry, lifecycleTransferredBytes } from './inspector-row-projection';
import type { RequestState } from './request-state';

export type SizeInfo =
  | { kind: 'pending' }
  | { kind: 'cached'; source: 'disk' | 'memory' | 'service-worker' }
  | { kind: 'bytes'; transferred: number | null; resource: number | null };

export function getSizeInfo(lifecycle: RequestLifecycle, state: RequestState): SizeInfo {
  if (state.kind === 'pending') return { kind: 'pending' };
  if (state.kind === 'cached') return { kind: 'cached', source: state.source };

  const har = currentHarEntry(lifecycle);
  const transferred = lifecycleTransferredBytes(lifecycle);
  const rawContent = har?.response?.content?.size;
  const resource = typeof rawContent === 'number' && rawContent >= 0 ? rawContent : null;
  return { kind: 'bytes', transferred, resource };
}

/**
 * Render bytes always in kB so a column of sizes stays in one unit.
 * One decimal below 100 kB, integer kB (thousands-separated) above.
 * Uses 1000-byte kB.
 */
export function formatBytesToKb(bytes: number): string {
  const kilobytes = bytes / 1000;
  if (kilobytes < 100) return `${kilobytes.toFixed(1)} kB`;
  return `${Math.round(kilobytes).toLocaleString()} kB`;
}

function cacheLabel(source: 'disk' | 'memory' | 'service-worker'): string {
  switch (source) {
    case 'disk':
      return '(disk cache)';
    case 'memory':
      return '(memory cache)';
    case 'service-worker':
      return '(ServiceWorker)';
  }
}

/**
 * The single value shown in the Size column: the transferred size in
 * kB (falling back to the resource size when the wire count is
 * unknown). Pending / cached rows render their label instead.
 */
export function formatSizeInfo(info: SizeInfo): string {
  if (info.kind === 'pending') return 'Pending';
  if (info.kind === 'cached') return cacheLabel(info.source);
  const primary = info.transferred ?? info.resource;
  return primary == null ? '' : formatBytesToKb(primary);
}

/**
 * Sort-key: prefer transferred (what the user actually paid for), fall
 * back to resource, fall back to -1 so pending/cached rows sort to the
 * bottom rather than colliding with `0 B`.
 */
export function sortValueOf(info: SizeInfo): number {
  if (info.kind === 'bytes') {
    if (info.transferred != null) return info.transferred;
    if (info.resource != null) return info.resource;
  }
  return -1;
}
