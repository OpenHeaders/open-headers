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

/** Short metric tag for the cramped column header — `Waterfall (ST)`. The
 * full names stay in the View / Sort menus where there's room to read them. */
export const WATERFALL_METRIC_ABBR: Record<WaterfallMetric, string> = {
  startTime: 'ST',
  responseTime: 'RT',
  endTime: 'ET',
  duration: 'TD',
  latency: 'L',
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
 * Network start — the host's `NetworkRequest.startTime` (= `timing.requestTime`):
 * the post-queue instant the request actually hit the network, i.e. the issue
 * time plus queueing.
 *
 * Unlike {@link waterfallStartMs} (the bar's zero, anchored to the ms-quantized
 * HAR `startedDateTime`), this reads the un-truncated `lifecycle.hopStartedAtMs`,
 * because the host's default waterfall sort orders by this network start at
 * full precision. Two requests fired in the same ms but queued differently
 * must order by their sub-ms network start — quantizing here would collapse
 * them into one bucket and mis-sort against the host.
 *
 * `hopStartedAtMs` (not `startedAtMs`) is the CURRENT hop's start: for a
 * redirected request the row is the final hop, which began after the chain
 * root. Anchoring to `startedAtMs` would sort the final hop at the root's
 * instant — placing the committed document before its own 3xx redirect row.
 */
function networkStartMs(lc: RequestLifecycle): number {
  return lc.hopStartedAtMs + queueingMs(lc);
}

/**
 * Active duration shown in the Time column — the browser's
 * `endTime - startTime`, where `startTime` is the post-queue network start.
 * HAR `time` is the full queued→ended span (`blocked + dns + connect + send +
 * wait + receive`, with `connect` the TCP+TLS leg that does NOT span `dns`), so
 * the active duration is simply HAR `time` minus queueing. (Kept arithmetic-only
 * — no phase allocation — since this runs in the sort path.)
 */
export function durationMs(lc: RequestLifecycle): number {
  const har = currentHarEntry(lc);
  if (har && typeof har.time === 'number' && har.time > 0) {
    return Math.max(har.time - queueingMs(lc), 0);
  }
  // A completed request sorts by its real duration, including 0 (instant
  // / cache); only a still-pending request is unknown (sorts last via -1).
  if (lc.completedAtMs != null) {
    const d = lc.completedAtMs - lc.startedAtMs;
    return d > 0 ? d : 0;
  }
  // In-flight: the elapsed time to the latest body chunk (the browser's live
  // `endTime - startTime`), so the Time column and the waterfall bar grow
  // during a slow download. Queueing is stripped to match the HAR-time branch
  // this settles into at completion (the browser's start is the post-queue
  // network start), so the value doesn't jump by the queue leg when the hop
  // finishes. CDP-only; the heuristic path leaves `lastActivityAtMs` unset and
  // stays unknown (-1) until the terminal event.
  if (lc.lastActivityAtMs != null) {
    const d = lc.lastActivityAtMs - lc.startedAtMs - queueingMs(lc);
    if (d > 0) return d;
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
  // Finished (or any row whose download leg is known): latency = duration −
  // download. Byte-identical to the long-standing behavior.
  if (lc.completedAtMs != null || r > 0) return Math.max(d - r, 0);
  // In-flight before the body finished: the receive (download) leg is still
  // unknown (`-1`) while `d` already grows with each chunk, so `d − 0` would
  // make latency grow with the download. The first-byte latency is fixed once
  // the response is in, so derive it from the stable pre-receive HAR legs
  // instead — the download share grows, the latency share holds (matching the
  // browser, whose latency = responseReceivedTime − startTime).
  return firstByteLatencyMs(lc);
}

/**
 * Fixed time-to-first-byte from the pre-receive HAR legs, the in-flight
 * latency source while the download (`receive`) leg is still unknown. Sums the
 * stable legs and strips queueing — the same post-queue adjustment
 * {@link durationMs} applies — so at completion it equals the finished
 * `duration − receive`. `-1` until the response (and its legs) lands.
 */
function firstByteLatencyMs(lc: RequestLifecycle): number {
  const t = currentHarEntry(lc)?.timings;
  if (!t) return -1;
  const leg = (x: number | undefined): number => (typeof x === 'number' && x > 0 ? x : 0);
  const nonReceive = leg(t.blocked) + leg(t.dns) + leg(t.connect) + leg(t.send) + leg(t.wait);
  if (nonReceive <= 0) return -1;
  return Math.max(nonReceive - queueingMs(lc), 0);
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
      return networkStartMs(lc);
    case 'endTime':
      // The browser's `endTime` advances on every body chunk; mirror that with
      // the live `lastActivityAtMs` while in flight, settling on `completedAtMs`
      // at the terminal event. -1 (unknown) only before the first byte.
      return lc.completedAtMs ?? lc.lastActivityAtMs ?? -1;
    case 'duration':
      return durationMs(lc);
    case 'latency':
      return latencyMs(lc);
    case 'responseTime': {
      const lat = latencyMs(lc);
      return lat < 0 ? -1 : networkStartMs(lc) + lat;
    }
  }
}
