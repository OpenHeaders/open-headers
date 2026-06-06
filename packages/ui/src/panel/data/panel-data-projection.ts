/**
 * `projectPanelData` — the panel's pure data projection: the three
 * reactive client snapshots (lifecycle, page, fire, + optional Resource
 * Timing) folded into the row + projection bundle the render tree
 * consumes.
 *
 * Extracted from `usePanelData` so the projection is a plain function with
 * no React dependency. Two reasons it lives on its own:
 *   - **Benchmarkable.** The replay harness drives it directly over a
 *     synthesized capture to measure per-frame recompute cost without a
 *     renderer in the loop.
 *   - **Oracle.** It is the full-recompute reference any future
 *     incremental derived-state path must match for the same input
 *     sequence (see `docs/PANEL_PERF_FOUNDATION_PLAN.md` §3).
 *
 * `usePanelData` is now a thin `useMemo` wrapper over this function; the
 * memo dependency list is what bounds how often it runs, and the
 * notify-scheduler batches how often those deps change per frame.
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
 */

import type { Page } from '@openheaders/core/page-stream';
import type { RequestLifecycle } from '@openheaders/core/request-lifecycle';
import type { InspectorHarEntry, InspectorNavTiming } from '@openheaders/core/types';

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
import { isRecorded, type RecordingWindow } from './use-recording-windows';

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
   * Navigation clear floor (a `startedAtMs` value) from `useNavClearFloor`.
   * The view shows lifecycles with `startedAtMs >= navClearFloorMs`. `-1`
   * (the default) means no floor — show everything. This is the
   * "Preserve log" boundary: a monotonic floor that advances on navigation
   * while Preserve log is off and freezes when it is on, so the past is
   * never resurrected by re-enabling. (The Clear action is a separate
   * axis, owned engine-side.)
   */
  readonly navClearFloorMs?: number;
  /**
   * Recording windows from `useRecordingWindows`. A lifecycle is shown
   * only if its `startedAtMs` falls inside one — so requests that started
   * while recording was stopped are dropped (browser-parity). Omitted (the
   * default) means "always recording": no recording filter.
   */
  readonly recordingWindows?: readonly RecordingWindow[];
  /**
   * Manual-Clear floor (a wall-clock `startedAtMs` value) from
   * `usePanelUiState`. The panel-local analog of the engine clear floor:
   * real rows are scoped engine-side, but the Resource Timing feed has no
   * engine, so the projection drops RT entries (and their synthetic rows)
   * that started before the last Clear. Without it, clearing the real rows
   * removes the dedup denominator and every still-cached request resurfaces
   * as a `(memory cache)` row. `-1` (the default) means never cleared.
   */
  readonly clearFloorMs?: number;
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
  /**
   * DOMContentLoaded / Load for the status-bar footer, re-anchored to the
   * final committed document (Chrome's footer zero). Equal to the
   * `navTiming` milestones for a non-redirected navigation; smaller by the
   * redirect leg when the navigation redirected. `undefined` until known.
   */
  readonly footerDclMs: number | undefined;
  readonly footerLoadMs: number | undefined;
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

/** A HAR entry's network start (host `requestTime`): the pseudo-wall issue
 * time (`startedDateTime`) plus queueing (`_blocked_queueing`). */
function harEntryNetworkStartMs(entry: InspectorHarEntry): number {
  const issued = Date.parse(entry.startedDateTime);
  const queueing = entry.timings?._blocked_queueing;
  return (Number.isFinite(issued) ? issued : 0) + (typeof queueing === 'number' && queueing > 0 ? queueing : 0);
}

/**
 * A redirected navigation's "redirect leg": the gap between the final
 * committed document's network start and the redirect-chain root's. Chrome's
 * live footer anchors DOMContentLoaded / Load / Finish to the FINAL committed
 * document (the request whose URL is the inspected URL), while HAR `pages[]`
 * anchor to the chain ROOT (`PageLoad.startTime`). The two differ by exactly
 * this leg, so the footer re-anchors by subtracting it. `0` for a
 * non-redirected navigation (footer and HAR coincide).
 */
function redirectLegMs(lc: RequestLifecycle): number {
  if (lc.redirectHopCount <= 0) return 0;
  const root = lc.har[0];
  const final = lc.har[lc.redirectHopCount];
  if (root == null || final == null) return 0;
  const leg = harEntryNetworkStartMs(final) - harEntryNetworkStartMs(root);
  return leg > 0 ? leg : 0;
}

export function projectPanelData(input: UsePanelDataInput): UsePanelDataResult {
  const {
    lifecycle,
    page,
    fire,
    opts,
    navClearFloorMs = -1,
    recordingWindows,
    resourceTiming,
    clearFloorMs = -1,
  } = input;

  const lifecycles = lifecycle.ordered;
  const pages = page.pages;
  const fires = fire.fires;
  const rtGroups = resourceTiming?.groups;

  // Memory-cache synthesis. The RT buffer is per-document, so the store
  // keeps one group per navigation; each group dedups against the real
  // rows of its own navigation window — `[thisOrigin, nextOrigin)` on
  // the wall clock. Groups below the nav floor are dropped from the view
  // (older navigations the floor has scoped out).
  //
  // The RT clear floor is the stronger of the nav floor (Preserve-log
  // boundary, whole-navigation) and the manual Clear floor (button, mid-
  // navigation). Entries are filtered by it BEFORE synthesis so the dedup
  // denominator stays consistent: dropping the real rows on Clear must not
  // turn their still-cached RT entries into surplus `(memory cache)` rows.
  const tabId = lifecycles[0]?.tabId ?? 0;
  const rtFloorMs = Math.max(navClearFloorMs, clearFloorMs);
  const sortedGroups = rtGroups ? [...rtGroups].sort((a, b) => a.timeOriginMs - b.timeOriginMs) : [];
  const activeGroups =
    navClearFloorMs < 0 ? sortedGroups : sortedGroups.filter((g) => g.timeOriginMs >= navClearFloorMs);
  const syntheticCacheRows: RequestLifecycle[] = [];
  for (let i = 0; i < activeGroups.length; i++) {
    const group = activeGroups[i];
    // The window end is the NEXT group's origin across ALL groups (not
    // just the active subset), so dedup never bleeds across navigations.
    const groupIdx = sortedGroups.indexOf(group);
    const nextOrigin =
      groupIdx + 1 < sortedGroups.length ? sortedGroups[groupIdx + 1].timeOriginMs : Number.POSITIVE_INFINITY;
    const reals = lifecycles.filter((lc) => lc.startedAtMs >= group.timeOriginMs && lc.startedAtMs < nextOrigin);
    const eligibleEntries =
      rtFloorMs < 0 ? group.entries : group.entries.filter((e) => group.timeOriginMs + e.startTime >= rtFloorMs);
    if (eligibleEntries.length === 0) continue;
    syntheticCacheRows.push(
      ...synthesizeMemoryCacheLifecycles({
        entries: eligibleEntries,
        timeOriginMs: group.timeOriginMs,
        realLifecycles: reals,
        tabId,
      }),
    );
  }

  // Scope the view to two display filters, both keyed on `startedAtMs`:
  //   - the clear floor (Preserve log): drop anything before it;
  //   - recording windows: drop anything that started while recording was
  //     stopped (browser-parity).
  // Pure display filters — the new page's requests (which arrive over a
  // separate port from the nav signal) are never racily wiped, and the
  // floor only ever advances on a committed navigation.
  const inView = (startedAtMs: number): boolean =>
    (navClearFloorMs < 0 || startedAtMs >= navClearFloorMs) &&
    (recordingWindows === undefined || isRecorded(startedAtMs, recordingWindows));
  const scoped = lifecycles.filter((lc) => inView(lc.startedAtMs));
  // Synthetic cache rows are already navigation-scoped, but still honor
  // the recording filter via the shared `inView` predicate.
  const visibleSynthetic = syntheticCacheRows.filter((lc) => inView(lc.startedAtMs));
  const merged = visibleSynthetic.length > 0 ? [...scoped, ...visibleSynthetic] : scoped;

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
  // Latest redirected main-document lifecycle, for the footer re-anchor.
  let redirectDoc: RequestLifecycle | null = null;
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
    if (row.lifecycle.resourceType === 'main_frame') {
      if (startedAtMs > baseTime) baseTime = startedAtMs;
      if (row.lifecycle.redirectHopCount > 0 && (redirectDoc === null || startedAtMs >= redirectDoc.startedAtMs)) {
        redirectDoc = row.lifecycle;
      }
    }
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
  // Re-anchor the footer to the final committed document (Chrome's footer
  // zero), not the redirect-chain root the window/HAR use. `legMs` is 0
  // unless the navigation redirected.
  const legMs = redirectDoc ? redirectLegMs(redirectDoc) : 0;
  const finishTimeMs = baseTime >= 0 && maxEnd > baseTime ? Math.max(maxEnd - baseTime - legMs, 0) : 0;

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

  // Footer milestones, re-anchored to the final committed document. `navTiming`
  // keeps the root-anchored HAR values (`pages[].pageTimings`); the status bar
  // mirrors Chrome's footer, which subtracts the redirect leg.
  const latestPage = pages.length > 0 ? pages[pages.length - 1] : null;
  let footerDclMs: number | undefined;
  let footerLoadMs: number | undefined;
  if (latestPage) {
    if (latestPage.dclMs != null) footerDclMs = latestPage.dclMs - legMs;
    if (latestPage.loadMs != null) footerLoadMs = latestPage.loadMs - legMs;
  }

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
    footerDclMs,
    footerLoadMs,
    modifiedCount,
    failedCount,
    cachedCount,
    pageCount: pages.length,
  };
}
