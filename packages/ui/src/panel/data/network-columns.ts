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
  | 'requestNumber'
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

/**
 * The browser's five resource-priority tiers. The HAR carries the raw
 * protocol spelling (`VeryLow` … `VeryHigh`); we rank them so a sort reads
 * highest-first and relabel them to the browser's user-facing wording
 * (`Lowest` … `Highest`) for display. The priority itself is the browser's —
 * computed in the renderer from type plus fetch context and reported verbatim;
 * we never re-derive it.
 */
const PRIORITY_TIERS: Record<string, { rank: number; label: string }> = {
  VeryLow: { rank: 1, label: 'Lowest' },
  Low: { rank: 2, label: 'Low' },
  Medium: { rank: 3, label: 'Medium' },
  High: { rank: 4, label: 'High' },
  VeryHigh: { rank: 5, label: 'Highest' },
};

/** Sort weight for the reported priority — 5 (highest) … 1 (lowest), 0 when
 * the browser hasn't reported one yet (pending / cache-only rows), so those
 * group at the bottom of a highest-first sort. */
export function priorityRank(lc: RequestLifecycle): number {
  const p = currentHarEntry(lc)?._priority;
  return (typeof p === 'string' ? PRIORITY_TIERS[p]?.rank : undefined) ?? 0;
}

/** The reported priority in the browser's display wording (`Lowest` …
 * `Highest`); empty when none has been reported. */
export function priorityLabel(lc: RequestLifecycle): string {
  const p = currentHarEntry(lc)?._priority;
  return (typeof p === 'string' ? PRIORITY_TIERS[p]?.label : undefined) ?? '';
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
export function queueingMs(lc: RequestLifecycle): number {
  const q = currentHarEntry(lc)?.timings?._blocked_queueing;
  return typeof q === 'number' && q > 0 ? q : 0;
}

/**
 * Issue-time anchor for the waterfall timeline. The browser measures the
 * network timeline from a request's issue time; HAR `startedDateTime` carries
 * exactly that (the pseudo-wall issue time), so prefer it — its zero matches
 * the browser's and frees the timeline from the slight skew of the lifecycle's
 * `webRequest` start. Falls back to that lifecycle start while the HAR entry
 * hasn't arrived (an in-flight request). The HAR timestamp is millisecond-
 * quantized, so absolute positions round to whole ms.
 */
export function waterfallStartMs(lc: RequestLifecycle): number {
  const started = currentHarEntry(lc)?.startedDateTime;
  if (started) {
    const parsed = Date.parse(started);
    if (Number.isFinite(parsed)) return parsed;
  }
  return lc.startedAtMs;
}

/**
 * Active duration shown in the Time column. HAR `time` is
 * `blocked + dns + connect + send + wait + receive`, but its `connect`
 * already spans `dns`, so HAR `time` double-counts DNS. Strip queueing and
 * that duplicated DNS to match the browser's `endTime - startTime`. (Kept
 * arithmetic-only — no phase allocation — since this runs in the sort path.)
 */
export function durationMs(lc: RequestLifecycle): number {
  const har = currentHarEntry(lc);
  if (har && typeof har.time === 'number' && har.time > 0) {
    const t = har.timings;
    const connect = t && typeof t.connect === 'number' && t.connect > 0 ? t.connect : 0;
    const dns = t && typeof t.dns === 'number' && t.dns > 0 ? t.dns : 0;
    const duplicatedDns = connect > 0 ? dns : 0;
    return Math.max(har.time - queueingMs(lc) - duplicatedDns, 0);
  }
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
    case 'requestNumber':
      return row.displayId;
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
      return priorityRank(lc);
    case 'waterfall':
      return waterfallStartMs(lc);
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
 * Epoch ms at which the request finishes, anchored at the waterfall issue
 * time and built from the same HAR-derived spans the bars use:
 * `issue + queueing + duration`. The timeline window and every timeline bar
 * read this, so a bar's right edge and the window's extent agree by
 * construction. Falls back to the issue time while a request is still pending
 * (duration unknown).
 */
export function timelineEndMs(lc: RequestLifecycle): number {
  return waterfallStartMs(lc) + queueingMs(lc) + Math.max(durationMs(lc), 0);
}

/**
 * Sort value for the Waterfall column under a given metric. Mirrors the
 * five keys the browser's Waterfall column sorts by — each is the matching
 * request field: start time, response (first-byte) time, end time, total
 * duration, latency. Unknown / still-pending values fall to -1 so they group
 * together at the ascending edge.
 *
 * Start and response times are measured from the post-queue start, not the
 * issue time: the browser's start time is the request baseline *after*
 * queueing (its duration excludes queueing too), so the issue time has the
 * queueing delay added back to land on the same instant. Without that, two
 * requests issued together but queued differently would sort by issue order
 * instead of by when they actually started.
 */
export function waterfallSortValue(row: InspectorRowWithFires, metric: WaterfallMetric): number {
  const lc = row.lifecycle;
  switch (metric) {
    case 'startTime':
      return waterfallStartMs(lc) + queueingMs(lc);
    case 'endTime':
      return lc.completedAtMs ?? -1;
    case 'duration':
      return durationMs(lc);
    case 'latency':
      return latencyMs(lc);
    case 'responseTime': {
      const lat = latencyMs(lc);
      return lat < 0 ? -1 : waterfallStartMs(lc) + queueingMs(lc) + lat;
    }
  }
}
