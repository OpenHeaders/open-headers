/**
 * `usePanelData` — the panel's single data-projection hook.
 *
 * Composes the three reactive client snapshots (lifecycle, page, fire)
 * into the row + projection bundle the panel's render tree consumes.
 * App.tsx will compose this with `useLifecycleClient` / `usePageClient`
 * / `useFireClient` once the R1 component flip lands (next session); the
 * hook is shipped now so the projection logic — and the tests around it
 * — exist as a stable foundation before the component-level rewrites
 * touch them.
 *
 * Concerns owned here, and nowhere else:
 *   - Row construction (delegated to `buildInspectorRows` + `attachFiresToRows`).
 *   - Fire dangling partition (also from `attachFiresToRows`).
 *   - Nav-timing projection from the latest known `Page` — the legacy
 *     `setNavTiming` channel is gone in the new world; the same shape is
 *     derived from the page-stream snapshot.
 *   - Initiator inverted index (delegated to `buildInitiatorIndex`).
 *   - Per-row identity lookups (`lookupByRequestId`, `lookupByUrl`).
 *   - Initiator children resolver (closure over the index + lookup).
 *   - Status-bar totals (`totalBytesTransferred`, `totalResourceSize`,
 *     `finishTimeMs`, `baselineMs`).
 *   - Per-row Timing-tab closures (`getConnectionReuse`, `getRepeatStats`)
 *     — both are `(lifecycle) → result` closures over the full lifecycle
 *     list, so consumers don't thread the array through prop chains.
 *
 * Intentionally NOT here yet (locked for follow-up sessions):
 *   - HAR export — its `pageToHar` projector ships in `./page-to-har`;
 *     the call site flips during the App.tsx flip.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorNavTiming } from '@openheaders/core/types';
import { useMemo } from 'react';

import { type ConnectionReuseInfo, computeConnectionReuse } from './connection-reuse';
import type { FireClientSnapshot } from './fire-client-store';
import { buildInitiatorIndex, type InitiatorIndex } from './initiator-index';
import { type BuildInspectorRowsOptions, buildInspectorRows } from './inspector-facet';
import {
  attachFiresToRows,
  currentHarEntry,
  type InspectorRowWithFires,
  lifecycleTransferredBytes,
} from './inspector-row-projection';
import type { LifecycleClientSnapshot } from './lifecycle-client-store';
import { synthesizeMemoryCacheLifecycles } from './memory-cache-rows';
import type { PageClientSnapshot } from './page-client-store';
import type { ResourceTimingClientSnapshot } from './resource-timing-client-store';
import { computeRepeatStats, type RepeatStats } from './timing-repeats';
import { type InspectorFire, isAppliedFire } from './types';

export interface UsePanelDataInput {
  readonly lifecycle: LifecycleClientSnapshot;
  readonly page: PageClientSnapshot;
  readonly fire: FireClientSnapshot;
  /**
   * Sort + retry-consolidation options forwarded to `buildInspectorRows`.
   * `consolidateRetries: false` mirrors the legacy panel default (every
   * lifecycle is a real attempt the user wants to see).
   */
  readonly opts?: BuildInspectorRowsOptions;
  /**
   * Preserve log across navigations. Default `true`. When `false`, the
   * view is scoped to the latest top-level navigation — a refresh or new
   * navigation drops the prior page's requests so the list starts from
   * zero, matching the browser's Network tab. (Background-history and the
   * Clear action are separate axes.)
   */
  readonly preserveLog?: boolean;
  /**
   * Latest Resource Timing snapshot for the inspected tab. Optional —
   * when present, renderer memory-cache hits (which never reach
   * `webRequest` / HAR) are reconciled against the real rows and the
   * surplus surfaced as synthetic `(memory cache)` rows. Absent → no
   * synthesis (every prior caller's behavior is unchanged).
   */
  readonly resourceTiming?: ResourceTimingClientSnapshot;
}

export interface UsePanelDataResult {
  readonly rows: readonly InspectorRowWithFires[];
  readonly dangling: readonly InspectorFire[];
  readonly pages: readonly Page[];
  readonly navTiming: InspectorNavTiming | null;
  readonly initiatorIndex: InitiatorIndex;
  readonly lookupByRequestId: ReadonlyMap<string, InspectorRowWithFires>;
  readonly lookupByUrl: ReadonlyMap<string, InspectorRowWithFires>;
  readonly getInitiatorChildren: (url: string) => readonly InspectorRowWithFires[];
  /** Per-row Timing-tab connection-reuse closure over the full lifecycle list. */
  readonly getConnectionReuse: (lifecycle: RequestLifecycle) => ConnectionReuseInfo;
  /** Per-row Timing-tab repeat-URL stats closure over the full lifecycle list. */
  readonly getRepeatStats: (lifecycle: RequestLifecycle) => RepeatStats | null;
  readonly baselineMs: number | null;
  readonly totalBytesTransferred: number;
  readonly totalResourceSize: number;
  /**
   * Time in ms from the current navigation's start to the last byte of
   * its last request — "Finish". Anchored to the latest top-level
   * navigation (not the longest request ever seen), so it tracks the
   * page you are on and never drifts under preserve-log. 0 if unknown.
   */
  readonly finishTimeMs: number;
  /** Rows whose rules actually ran (`isAppliedFire`). */
  readonly modifiedCount: number;
  /** Rows that errored — failed phase or HTTP status >= 400. */
  readonly failedCount: number;
  /** Rows served from cache — no wire bytes but a non-empty resource. */
  readonly cachedCount: number;
  /** Number of distinct navigations (pages) observed on this tab. */
  readonly pageCount: number;
}

/**
 * Project the latest page in the snapshot into the legacy
 * `InspectorNavTiming` shape. The panel toolbar + status bar still read
 * this shape; deriving it here means the consumers don't need to know
 * about pages at all.
 *
 * Returns `null` until at least one page is known — same semantics as
 * the legacy store's `navTiming` slot.
 */
function projectNavTiming(pages: readonly Page[]): InspectorNavTiming | null {
  if (pages.length === 0) return null;
  const latest = pages[pages.length - 1];
  // `Page.url` is the full URL the host reported; the legacy nav-timing
  // surfaced an origin-only string in `pageOrigin`. Derive the origin
  // and fall back to the full string if URL parsing fails (e.g.
  // chrome-extension:// or about: schemes that parse into non-http
  // origins viewers reject).
  let pageOrigin: string | null = null;
  if (latest.url) {
    try {
      pageOrigin = new URL(latest.url).origin;
    } catch {
      pageOrigin = latest.url;
    }
  }
  const out: InspectorNavTiming = { pageOrigin };
  if (latest.dclMs != null) out.dclMs = latest.dclMs;
  if (latest.loadMs != null) out.loadMs = latest.loadMs;
  return out;
}

function lifecycleDuration(lifecycle: RequestLifecycle): number {
  if (lifecycle.completedAtMs == null) return 0;
  const d = lifecycle.completedAtMs - lifecycle.startedAtMs;
  return d > 0 ? d : 0;
}

/**
 * Latest top-level navigation start (`main_frame` lifecycle), or -1 if
 * none has been observed. The clear-on-nav boundary.
 */
function latestNavStartMs(lifecycles: readonly RequestLifecycle[]): number {
  let nav = -1;
  for (const lc of lifecycles) {
    if (lc.resourceType === 'main_frame' && lc.startedAtMs > nav) nav = lc.startedAtMs;
  }
  return nav;
}

export function usePanelData(input: UsePanelDataInput): UsePanelDataResult {
  const { lifecycle, page, fire, opts, preserveLog = true, resourceTiming } = input;

  const lifecycles = lifecycle.ordered;
  const pages = page.pages;
  const fires = fire.fires;
  const rtGroups = resourceTiming?.groups;

  return useMemo(() => {
    // Memory-cache synthesis. The RT buffer is per-document, so the store
    // keeps one group per navigation; each group dedups against the real
    // rows of its own navigation window — `[thisOrigin, nextOrigin)` on
    // the wall clock. Preserve-log OFF keeps only the current document's
    // group (older navigations are dropped from the view).
    const tabId = lifecycles[0]?.tabId ?? 0;
    const sortedGroups = rtGroups ? [...rtGroups].sort((a, b) => a.timeOriginMs - b.timeOriginMs) : [];
    const activeGroups =
      preserveLog || sortedGroups.length === 0 ? sortedGroups : [sortedGroups[sortedGroups.length - 1]];
    const syntheticCacheRows: RequestLifecycle[] = [];
    for (let i = 0; i < activeGroups.length; i++) {
      const group = activeGroups[i];
      // The window end is the NEXT group's origin across ALL groups (not
      // just the active subset), so dedup never bleeds across navigations.
      const groupIdx = sortedGroups.indexOf(group);
      const nextOrigin =
        groupIdx + 1 < sortedGroups.length ? sortedGroups[groupIdx + 1].timeOriginMs : Number.POSITIVE_INFINITY;
      const reals = lifecycles.filter((lc) => lc.startedAtMs >= group.timeOriginMs && lc.startedAtMs < nextOrigin);
      syntheticCacheRows.push(
        ...synthesizeMemoryCacheLifecycles({
          entries: group.entries,
          timeOriginMs: group.timeOriginMs,
          realLifecycles: reals,
          tabId,
        }),
      );
    }

    // Preserve log OFF → scope the view to the current navigation: drop
    // everything that started before the latest top-level nav so a
    // refresh resets the list to the new page. A pure display filter, so
    // the new page's requests (which arrive over a separate port from the
    // nav signal) are never racily wiped.
    const navStartMs = preserveLog ? -1 : latestNavStartMs(lifecycles);
    const scoped = navStartMs >= 0 ? lifecycles.filter((lc) => lc.startedAtMs >= navStartMs) : lifecycles;
    // Synthetic cache rows are already navigation-scoped (and preserve-log
    // aware), so they survive the real-row filter unconditionally.
    const merged = syntheticCacheRows.length > 0 ? [...scoped, ...syntheticCacheRows] : scoped;

    const baseRows = buildInspectorRows(merged, opts);
    const { rows, dangling } = attachFiresToRows(baseRows, fires);

    const lookupByRequestId = new Map<string, InspectorRowWithFires>();
    const lookupByUrl = new Map<string, InspectorRowWithFires>();
    let totalBytesTransferred = 0;
    let totalResourceSize = 0;
    let modifiedCount = 0;
    let failedCount = 0;
    let cachedCount = 0;
    // Finish baseline: anchor to the latest top-level navigation so the
    // total tracks the current page, not the longest request ever seen.
    let baseTime = -1;
    let minStartedAtMs = -1;
    for (const row of rows) {
      lookupByRequestId.set(row.lifecycle.requestId, row);
      // First arrival wins for URL collisions — same convention as
      // the legacy `entriesByUrl` map in App.tsx.
      if (!lookupByUrl.has(row.lifecycle.url)) lookupByUrl.set(row.lifecycle.url, row);

      const har = currentHarEntry(row.lifecycle);
      const transferred = lifecycleTransferredBytes(row.lifecycle);
      if (transferred != null && transferred > 0) totalBytesTransferred += transferred;
      const contentSize = har?.response?.content?.size;
      if (typeof contentSize === 'number' && contentSize > 0) totalResourceSize += contentSize;

      if (row.fires.some(isAppliedFire)) modifiedCount++;
      const status = har?.response?.status;
      if (row.lifecycle.phase === 'failed' || (typeof status === 'number' && status >= 400)) failedCount++;
      // Cache hit: a real resource the page received with no wire bytes.
      if ((transferred == null || transferred === 0) && typeof contentSize === 'number' && contentSize > 0) {
        cachedCount++;
      }

      const startedAtMs = row.lifecycle.startedAtMs;
      if (minStartedAtMs < 0 || startedAtMs < minStartedAtMs) minStartedAtMs = startedAtMs;
      if (row.lifecycle.resourceType === 'main_frame' && startedAtMs > baseTime) baseTime = startedAtMs;
    }

    // No top-level nav captured (e.g. panel opened mid-session): fall back
    // to the earliest request as the baseline.
    if (baseTime < 0) baseTime = minStartedAtMs;
    let maxEnd = baseTime;
    if (baseTime >= 0) {
      for (const row of rows) {
        if (row.lifecycle.startedAtMs < baseTime) continue;
        const end = row.lifecycle.startedAtMs + lifecycleDuration(row.lifecycle);
        if (end > maxEnd) maxEnd = end;
      }
    }
    const finishTimeMs = baseTime >= 0 && maxEnd > baseTime ? maxEnd - baseTime : 0;

    const initiatorIndex = buildInitiatorIndex(scoped);
    const getInitiatorChildren = (url: string): readonly InspectorRowWithFires[] => {
      const ids = initiatorIndex.get(url);
      if (!ids || ids.length === 0) return [];
      const out: InspectorRowWithFires[] = [];
      for (const id of ids) {
        const r = lookupByRequestId.get(id);
        if (r) out.push(r);
      }
      return out;
    };

    const navTiming = projectNavTiming(pages);
    const baselineMs = rows.length > 0 ? rows[0].lifecycle.startedAtMs : null;

    const getConnectionReuse = (lc: RequestLifecycle): ConnectionReuseInfo => computeConnectionReuse(lc, scoped);
    const getRepeatStats = (lc: RequestLifecycle): RepeatStats | null => computeRepeatStats(lc, scoped);

    return {
      rows,
      dangling,
      pages,
      navTiming,
      initiatorIndex,
      lookupByRequestId,
      lookupByUrl,
      getInitiatorChildren,
      getConnectionReuse,
      getRepeatStats,
      baselineMs,
      totalBytesTransferred,
      totalResourceSize,
      finishTimeMs,
      modifiedCount,
      failedCount,
      cachedCount,
      pageCount: pages.length,
    };
  }, [lifecycles, pages, fires, opts, preserveLog, rtGroups]);
}
