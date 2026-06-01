/**
 * Pure sort-value extraction for the network table columns.
 *
 * The column registry in `components/traffic/columns` mixes
 * presentation (label, default width, alignment) with data (sort
 * keys, cell value extraction). The pure data half lives here so it
 * stays consumable from `network-sort-modes` — which only cares about
 * comparator values — without dragging the React-side registry into
 * the sort module.
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import { currentHarEntry, type InspectorRowWithFires, lifecycleTransferredBytes } from './inspector-row-projection';

export type SortableColumnKey =
  | 'name'
  | 'method'
  | 'path'
  | 'url'
  | 'status'
  | 'protocol'
  | 'scheme'
  | 'domain'
  | 'remoteAddress'
  | 'type'
  | 'initiator'
  | 'cookies'
  | 'setCookies'
  | 'size'
  | 'time'
  | 'priority'
  | 'timestamp'
  | 'waterfall';

interface Initiator {
  type?: string;
  url?: string;
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function safeScheme(url: string): string {
  try {
    return new URL(url).protocol.replace(/:$/, '');
  } catch {
    return '';
  }
}

function safePath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ?? '');
  } catch {
    return url;
  }
}

function countSetCookies(lc: RequestLifecycle): number {
  const headers = currentHarEntry(lc)?.response?.headers ?? [];
  let n = 0;
  for (const h of headers) if (h.name.toLowerCase() === 'set-cookie') n++;
  return n;
}

function countRequestCookies(lc: RequestLifecycle): number {
  return currentHarEntry(lc)?.request?.cookies?.length ?? 0;
}

function priorityText(lc: RequestLifecycle): string {
  const p = currentHarEntry(lc)?._priority;
  return typeof p === 'string' ? p : '';
}

function transferredBytes(lc: RequestLifecycle): number {
  return lifecycleTransferredBytes(lc) ?? -1;
}

function durationMs(lc: RequestLifecycle): number {
  const harTime = currentHarEntry(lc)?.time;
  if (typeof harTime === 'number' && harTime > 0) return harTime;
  // A completed request sorts by its real duration, including 0 (instant
  // / cache); only a still-pending request is unknown (sorts last via -1).
  if (lc.completedAtMs != null) {
    const d = lc.completedAtMs - lc.startedAtMs;
    return d > 0 ? d : 0;
  }
  return -1;
}

function initiatorText(lc: RequestLifecycle): string {
  const init = currentHarEntry(lc)?._initiator as Initiator | undefined;
  if (!init) return '';
  if (init.url) return init.url;
  return init.type ?? '';
}

/**
 * Pure value the network-sort comparator chain reads when a given
 * column is selected as a sort level. Strings sort
 * case-insensitively where the legacy `getSortValue` lowercased
 * (`name`, `url`).
 */
export function getColumnSortValue(key: SortableColumnKey, row: InspectorRowWithFires): string | number {
  const lc = row.lifecycle;
  switch (key) {
    case 'name':
    case 'url':
      return lc.url.toLowerCase();
    case 'method':
      return lc.method;
    case 'path':
      return safePath(lc.url);
    case 'status':
      return lc.statusCode ?? -1;
    case 'protocol':
      return currentHarEntry(lc)?.response?.httpVersion ?? '';
    case 'scheme':
      return safeScheme(lc.url);
    case 'domain':
      return safeHost(lc.url);
    case 'remoteAddress':
      return currentHarEntry(lc)?.serverIPAddress ?? '';
    case 'type':
      return (lc.resourceType ?? '').toLowerCase();
    case 'initiator':
      return initiatorText(lc).toLowerCase();
    case 'cookies':
      return countRequestCookies(lc);
    case 'setCookies':
      return countSetCookies(lc);
    case 'size':
      return transferredBytes(lc);
    case 'time':
      return durationMs(lc);
    case 'priority':
      return priorityText(lc);
    case 'timestamp':
    case 'waterfall':
      return lc.startedAtMs;
  }
}
