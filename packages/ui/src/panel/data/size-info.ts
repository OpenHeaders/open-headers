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
 *
 * Chrome's native Size column follows the same convention. We mirror
 * it so anyone coming from Chrome reads our column the same way.
 */

import type { RequestState } from './request-state';
import type { InspectorRequest } from './types';

export type SizeInfo =
  | { kind: 'pending' }
  | { kind: 'cached'; source: 'disk' | 'memory' | 'service-worker' }
  | { kind: 'bytes'; transferred: number | null; resource: number | null };

export function getSizeInfo(entry: InspectorRequest, state: RequestState): SizeInfo {
  if (state.kind === 'pending') return { kind: 'pending' };
  if (state.kind === 'cached') return { kind: 'cached', source: state.source };

  const har = entry.harEntry;
  // Transferred bytes = response body size on the wire. `bodySize` is
  // the HAR standard; falls back to our projection when the HAR
  // doesn't provide it (some recorders emit -1 for "unknown").
  const rawBody = har?.response?.bodySize;
  const transferred = typeof rawBody === 'number' && rawBody >= 0 ? rawBody : (entry.responseSize ?? null);
  // Resource / decoded size = uncompressed payload. `content.size`
  // is HAR standard; often equal to transferred when the response
  // wasn't compressed.
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

/**
 * Single-line rendering of a SizeInfo. Used for title tooltips and as
 * the fallback when the UI renders a plain string (e.g. HAR export
 * copy). The rich component version lives in TrafficList so it can
 * style the two-byte-count form.
 */
export function formatSizeInfo(info: SizeInfo): string {
  if (info.kind === 'pending') return 'Pending';
  if (info.kind === 'cached') return cacheLabel(info.source);
  const { transferred, resource } = info;
  if (transferred == null && resource == null) return '';
  if (transferred != null && resource != null && resource > transferred) {
    // Compressed — show both wire and decoded sizes.
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
