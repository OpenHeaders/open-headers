/**
 * Size-column data model.
 *
 * The Size column is actually three different pieces of information
 * collapsed into one:
 *
 *   - "Pending" while the response body hasn't arrived.
 *   - A cache-source label (`(disk cache)`, `(memory cache)`,
 *     `(ServiceWorker)`) when the wire wasn't hit.
 *   - A two-number reading (`transferred / resource`) when it was.
 *     Compressed responses send fewer bytes over the wire than the
 *     page ultimately uses — users debugging perf need both.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry } from './inspector-row-projection';
import type { RequestState } from './request-state';

export type SizeInfo =
  | { kind: 'pending' }
  | { kind: 'cached'; source: 'disk' | 'memory' | 'service-worker' }
  | { kind: 'bytes'; transferred: number | null; resource: number | null };

export function getSizeInfo(lifecycle: RequestLifecycle, state: RequestState): SizeInfo {
  if (state.kind === 'pending') return { kind: 'pending' };
  if (state.kind === 'cached') return { kind: 'cached', source: state.source };

  const har = currentHarEntry(lifecycle);
  const rawBody = har?.response?.bodySize;
  const transferred = typeof rawBody === 'number' && rawBody >= 0 ? rawBody : null;
  const rawContent = har?.response?.content?.size;
  const resource = typeof rawContent === 'number' && rawContent >= 0 ? rawContent : null;
  return { kind: 'bytes', transferred, resource };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
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

/** Single-line rendering of a SizeInfo. Used for tooltips + HAR-export copy. */
export function formatSizeInfo(info: SizeInfo): string {
  if (info.kind === 'pending') return 'Pending';
  if (info.kind === 'cached') return cacheLabel(info.source);
  const { transferred, resource } = info;
  if (transferred == null && resource == null) return '';
  if (transferred != null && resource != null && resource > transferred) {
    return `${formatBytes(transferred)} / ${formatBytes(resource)}`;
  }
  if (transferred != null) return formatBytes(transferred);
  if (resource != null) return formatBytes(resource);
  return '';
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
