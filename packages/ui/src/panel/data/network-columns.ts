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
import type { DevpanelNetworkWaterfallMetricSetting } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { currentHarEntry, type InspectorRowWithFires, lifecycleTransferredBytes } from './inspector-row-projection';
import { effectiveStatusCode } from './request-state';

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
  | 'waterfall';

export type WaterfallMetric = DevpanelNetworkWaterfallMetricSetting;

/** Human label shown in the Waterfall column header — `Waterfall (Start time)`. */
export const WATERFALL_METRIC_LABELS: Record<WaterfallMetric, string> = {
  startTime: 'Start time',
  responseTime: 'Response time',
  endTime: 'End time',
  duration: 'Total duration',
  latency: 'Latency',
};

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

/**
 * Queueing time (`_blocked_queueing`) — the wait between a request being
 * issued and actually starting. The browser excludes this from the Time
 * column and from duration/latency (its `duration = endTime - startTime`,
 * and `startTime` is the post-queue request time); it only surfaces
 * queueing as a phase in the timing breakdown. We mirror that: subtract it
 * from every displayed duration so a queue-heavy request reads as its
 * active time, not the inflated HAR `time` (which includes queueing).
 */
function queueingMs(lc: RequestLifecycle): number {
  const q = currentHarEntry(lc)?.timings?._blocked_queueing;
  return typeof q === 'number' && q > 0 ? q : 0;
}

/** Active duration shown in the Time column — HAR `time` minus queueing. */
export function durationMs(lc: RequestLifecycle): number {
  const harTime = currentHarEntry(lc)?.time;
  if (typeof harTime === 'number' && harTime > 0) return Math.max(harTime - queueingMs(lc), 0);
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
      return effectiveStatusCode(lc) ?? -1;
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
    case 'waterfall':
      return lc.startedAtMs;
  }
}

/**
 * Latency (time to first byte) = active duration minus content download.
 *
 * Deriving it from `durationMs` (rather than summing the pre-response
 * phases) avoids the HAR connect/ssl overlap: HAR's `connect` already
 * includes `ssl`, so adding both would double-count the handshake. This
 * also keeps latency consistent with the Time column by construction.
 */
function latencyMs(lc: RequestLifecycle): number {
  const d = durationMs(lc);
  if (d < 0) return -1;
  const receive = currentHarEntry(lc)?.timings?.receive;
  const r = typeof receive === 'number' && receive > 0 ? receive : 0;
  return Math.max(d - r, 0);
}

/**
 * Sort value for the Waterfall column under a given metric. Mirrors the
 * five keys Chrome's Waterfall column can sort by. Unknown / still-pending
 * values fall to -1 so they group together at the ascending edge.
 */
export function waterfallSortValue(row: InspectorRowWithFires, metric: WaterfallMetric): number {
  const lc = row.lifecycle;
  switch (metric) {
    case 'startTime':
      return lc.startedAtMs;
    case 'endTime':
      return lc.completedAtMs ?? -1;
    case 'duration':
      return durationMs(lc);
    case 'latency':
      return latencyMs(lc);
    case 'responseTime': {
      const lat = latencyMs(lc);
      return lat < 0 ? -1 : lc.startedAtMs + lat;
    }
  }
}
