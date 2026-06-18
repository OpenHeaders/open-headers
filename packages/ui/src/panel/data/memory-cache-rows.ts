/**
 * Memory-cache row synthesis — the panel-local reconciliation of the
 * Resource Timing feed against the real (webRequest + HAR) rows.
 *
 * A resource served from the renderer's in-process cache never reaches
 * the network service, so no `webRequest` / HAR event fires and no real
 * `RequestLifecycle` exists for it — yet it still records a
 * `PerformanceResourceTiming` entry. This module turns those otherwise-
 * invisible hits into synthetic lifecycles so they flow through the same
 * row pipeline as everything else (sort, display id, totals, the Size
 * cell's `(memory cache)` label via the cached request-state).
 *
 * Reconciliation is count-based, mirroring the heuristic stance of the
 * HAR↔requestId join: for each URL, `synthetic = rt(url) − real(url)`.
 * A disk-cache hit or a normal fetch produces a real row, so it cancels
 * its RT entry and is never duplicated; only the surplus — RT entries
 * with no matching real row — becomes memory-cache rows. The surplus
 * picks cache-shaped entries (zero transfer / `cache` delivery) first so
 * a mixed "fetched once, cache-hit twice" URL synthesizes the cache hits
 * rather than the network fetch.
 *
 * Limitations (surfaced in the detail panes, not hidden): RT carries no
 * headers, so synthetic rows have empty Headers / Cookies tabs; a cross-
 * origin resource without Timing-Allow-Origin reports zero sizes and a
 * `0` status (still rendered as `(memory cache)`).
 */

import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { ResourceTimingEntry } from '@openheaders/core/resource-timing';
import type { InspectorHarEntry } from '@openheaders/core/types';

export interface MemoryCacheSynthesisInput {
  /** Latest Resource Timing entries for the inspected document. */
  readonly entries: readonly ResourceTimingEntry[];
  /** Document time origin in wall-clock ms; `null` disables synthesis. */
  readonly timeOriginMs: number | null;
  /**
   * Real lifecycles of the current navigation — the dedup denominator.
   * The RT buffer is scoped to the current document, so the count must
   * be too, or a same-URL row from a prior page would mask a real hit.
   */
  readonly realLifecycles: readonly RequestLifecycle[];
  /** Tab the rows belong to; identity only (panel is single-tab). */
  readonly tabId: number;
}

/** `oh-mem:` requestId prefix — disjoint from chrome's numeric ids. */
const SYNTHETIC_ID_PREFIX = 'oh-mem:';

export function synthesizeMemoryCacheLifecycles(input: MemoryCacheSynthesisInput): RequestLifecycle[] {
  const { entries, timeOriginMs, realLifecycles, tabId } = input;
  if (timeOriginMs == null || entries.length === 0) return [];

  const realCountByUrl = new Map<string, number>();
  for (const lc of realLifecycles) {
    // Resource Timing names a redirected resource by the URL the page first
    // requested (the chain root), never its final hop — so the dedup
    // denominator must key on that same root. Keying on `lc.url` (the final
    // hop) leaves every redirected request — including a DNR query-param /
    // redirect rule's own 307 — looking like an unmatched RT entry, which
    // then synthesizes a phantom memory-cache row for the pre-redirect URL.
    const rtName = lc.redirectHops.length > 0 ? lc.redirectHops[0].sourceUrl : lc.url;
    realCountByUrl.set(rtName, (realCountByUrl.get(rtName) ?? 0) + 1);
  }

  const entriesByUrl = new Map<string, ResourceTimingEntry[]>();
  for (const entry of entries) {
    const list = entriesByUrl.get(entry.name);
    if (list) list.push(entry);
    else entriesByUrl.set(entry.name, [entry]);
  }

  const synthetic: RequestLifecycle[] = [];
  for (const [url, group] of entriesByUrl) {
    const surplus = group.length - (realCountByUrl.get(url) ?? 0);
    if (surplus <= 0) continue;
    // Cache-shaped entries first, so the surplus represents the hits.
    const ordered = [...group].sort((a, b) => cacheRank(a) - cacheRank(b));
    for (let i = 0; i < surplus; i++) {
      synthetic.push(toLifecycle(ordered[i], i, tabId, timeOriginMs));
    }
  }
  return synthetic;
}

/** Lower rank = more cache-shaped (sorted to the front of the surplus). */
function cacheRank(entry: ResourceTimingEntry): number {
  if (entry.deliveryType === 'cache') return 0;
  if (entry.transferSize === 0) return 1;
  return 2;
}

function toLifecycle(entry: ResourceTimingEntry, index: number, tabId: number, timeOriginMs: number): RequestLifecycle {
  const startedAtMs = timeOriginMs + entry.startTime;
  const duration = entry.duration > 0 ? entry.duration : 0;
  const completedAtMs = startedAtMs + duration;
  const status = entry.responseStatus && entry.responseStatus > 0 ? entry.responseStatus : 200;
  const protocol = entry.nextHopProtocol;

  const har: InspectorHarEntry = {
    startedDateTime: new Date(startedAtMs).toISOString(),
    time: duration,
    request: {
      method: 'GET',
      url: entry.name,
      httpVersion: protocol,
      headers: [],
      queryString: [],
    },
    response: {
      status,
      statusText: '',
      httpVersion: protocol,
      headers: [],
      content: { size: entry.decodedBodySize, mimeType: '' },
      // Wire count is zero (served from cache); the resource size rides
      // in `content.size`.
      _transferSize: 0,
      bodySize: entry.encodedBodySize,
    },
    // `_fromCache: 'memory'` is the entry-level flag that classifies the
    // row as a memory-cache hit (→ the Size cell's `(memory cache)`).
    _fromCache: 'memory',
  };

  return {
    tabId,
    requestId: `${SYNTHETIC_ID_PREFIX}${entry.name}#${index}`,
    url: entry.name,
    method: 'GET',
    resourceType: mapResourceType(entry.initiatorType),
    phase: 'completed',
    redirectHopCount: 0,
    redirectHops: [],
    startedAtMs,
    hopStartedAtMs: startedAtMs,
    completedAtMs,
    statusCode: status,
    statusText: '',
    fromCache: true,
    har: [har],
    harBodyByHop: [],
  };
}

/** Map a Resource Timing `initiatorType` to a webRequest resource type. */
function mapResourceType(initiatorType: string): string {
  switch (initiatorType) {
    case 'script':
      return 'script';
    case 'css':
    case 'link':
      return 'stylesheet';
    case 'img':
    case 'image':
    case 'imageset':
      return 'image';
    case 'video':
    case 'audio':
      return 'media';
    case 'fetch':
      return 'fetch';
    case 'xmlhttprequest':
      return 'xmlhttprequest';
    case 'beacon':
    case 'ping':
      return 'ping';
    case 'iframe':
    case 'frame':
      return 'sub_frame';
    default:
      return initiatorType || 'other';
  }
}
