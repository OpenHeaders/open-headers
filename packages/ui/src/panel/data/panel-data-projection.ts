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
import type { InspectorNavTiming } from '@openheaders/core/types';

import { type ConnectionReuseInfo, computeConnectionReuse } from './connection-reuse';
import type { FireClientSnapshot } from './fire-client-store';
import { rowFireTier } from './fire-evidence';
import { buildInitiatorIndex, type InitiatorIndex } from './initiator-index';
import { type BuildInspectorRowsOptions, buildInspectorRows } from './inspector-facet';
import {
  attachFiresToRows,
  currentHarEntry,
  displayResourceBytes,
  displayTransferredBytes,
  type InspectorRowWithFires,
  stampRedirectRewrites,
} from './inspector-row-projection';
import type { LifecycleClientSnapshot } from './lifecycle-client-store';
import { synthesizeMemoryCacheLifecycles } from './memory-cache-rows';
import { selectMainDocByLoader } from './page-anchor';
import type { PageClientSnapshot } from './page-client-store';
import { isInView, type PanelViewScope } from './panel-view-scope';
import type { ResourceTimingClientSnapshot } from './resource-timing-client-store';
import { computeRepeatStats, type RepeatStats } from './timing-repeats';
import type { InspectorFire } from './types';
import type { RecordingWindow } from './use-recording-windows';

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
  /** In-scope navigations, scoped by the same recording-state seam as `rows`
   * — what the page block renders and what the HAR export's page set derives
   * from. A navigation hidden from the rows is absent here too. */
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
   * Time in ms from the latest navigation's final committed document to the
   * last byte of its last request — "Finish". Anchored to that document's
   * network start (the browser footer's zero, `maxTime − finalDoc.startTime`),
   * not the longest request ever seen, so it tracks the page you are on and
   * never drifts under preserve-log. 0 if unknown.
   */
  readonly finishTimeMs: number;
  /**
   * The footer's zero — the final committed document's network start in
   * wall-clock ms (the browser footer's `baseTime`), from which `finishTimeMs`
   * and the re-anchored milestones are measured. `baseTime` (the nav start)
   * when no main document is known.
   */
  readonly footerAnchorMs: number;
  /**
   * The redirect leg subtracted to re-anchor the footer milestones: the gap
   * from the navigation root to the final document's network start. `0` for a
   * non-redirected navigation.
   */
  readonly legMs: number;
  /**
   * DOMContentLoaded / Load for the status-bar footer, re-anchored to the
   * final committed document (the browser footer's zero). Equal to the
   * `navTiming` milestones for a non-redirected navigation; smaller by the
   * redirect leg when the navigation redirected. `undefined` until known.
   */
  readonly footerDclMs: number | undefined;
  readonly footerLoadMs: number | undefined;
  /**
   * Aggregate (browser-default) status-bar timings — Finish / DCL / Load
   * measured from the **earliest** navigation to the current page's URL,
   * spanning the whole preserve-log timeline the way Chrome's summary bar
   * does across multiple navigations. The `footer*` values above instead
   * anchor to the latest navigation (the per-page reading). The two coincide
   * for a single navigation; the status bar shows these by default and lets
   * the user switch to the per-page `footer*` set via a setting.
   */
  readonly aggregateFinishMs: number;
  readonly aggregateDclMs: number | undefined;
  readonly aggregateLoadMs: number | undefined;
  /** Rows whose rules verifiably applied (`rowFireTier === 'applied'`) —
   * engine-confirmed, reporter-confirmed, or wire-corroborated; a
   * contradicted row is not counted as modified. */
  readonly modifiedCount: number;
  /** Rows that errored — failed phase or HTTP status >= 400. */
  readonly failedCount: number;
  /** Rows served from cache — no wire bytes but a non-empty resource. */
  readonly cachedCount: number;
  /** Number of in-scope navigations (pages) currently displayed — scoped by
   * recording state exactly like the rows, so it never counts a navigation
   * whose requests are hidden. */
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
export interface FooterTotals {
  /** Rows counted — the footer's "N requests". */
  readonly requestCount: number;
  /** Wire bytes summed across the rows — live `displayTransferredBytes` while
   *  in flight, authoritative HAR once finished, so the total grows during a
   *  download. */
  readonly totalBytesTransferred: number;
  /** Decoded resource bytes summed across the rows (`displayResourceBytes`). */
  readonly totalResourceSize: number;
}

/**
 * Footer byte/count totals over a row set — the status-bar
 * "N requests · X transferred · Y resources". Built from
 * `displayTransferredBytes` / `displayResourceBytes` so an in-flight row
 * contributes its running bytes (live by construction), a finished row its
 * authoritative HAR figure, and a cache hit / pre-first-byte row nothing.
 * Reused for both the full in-view set (the projection below) and the
 * filtered subset (the view), so a filter renders `subset / total` and the
 * two readings can never diverge.
 */
export function computeFooterTotals(rows: readonly InspectorRowWithFires[]): FooterTotals {
  let totalBytesTransferred = 0;
  let totalResourceSize = 0;
  for (const row of rows) {
    const transferred = displayTransferredBytes(row.lifecycle);
    if (transferred != null && transferred > 0) totalBytesTransferred += transferred;
    const contentSize = displayResourceBytes(row.lifecycle);
    if (contentSize != null && contentSize > 0) totalResourceSize += contentSize;
  }
  return { requestCount: rows.length, totalBytesTransferred, totalResourceSize };
}

/**
 * Footer subset totals for an active filter, or `null` when none is in effect.
 * Mirrors the browser's count-based `selectedNodeNumber !== nodeCount` trigger:
 * a subset is reported only when the filtered set is strictly smaller than the
 * full set, so a filter that hides nothing leaves the footer on single totals.
 * Built from {@link computeFooterTotals} over the same shared `filteredRows`,
 * so the subset grows live as a passing in-flight row streams.
 */
export function computeFooterSubset(
  fullRows: readonly InspectorRowWithFires[],
  filteredRows: readonly InspectorRowWithFires[],
): FooterTotals | null {
  if (filteredRows.length === fullRows.length) return null;
  return computeFooterTotals(filteredRows);
}

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
  if (lifecycle.completedAtMs != null) {
    const d = lifecycle.completedAtMs - lifecycle.startedAtMs;
    return d > 0 ? d : 0;
  }
  // In-flight: span to the latest body chunk so the footer's `maxEnd` (and the
  // Finish total it drives) grows live during a slow download, the way the
  // browser's summary bar advances. CDP-only; absent → 0 (a truly-pending row
  // contributes nothing to the span).
  if (lifecycle.lastActivityAtMs != null) {
    const d = lifecycle.lastActivityAtMs - lifecycle.startedAtMs;
    return d > 0 ? d : 0;
  }
  return 0;
}

/** Top-level navigation document — `main_frame` from the webRequest path,
 * `document` from the CDP path (both surface the page's main resource). */
function isMainDocument(resourceType: string | undefined): boolean {
  return resourceType === 'main_frame' || resourceType === 'document';
}

/** URL minus its `#fragment` — for comparing the page's root URL to the
 * final document's URL without a hash-only mismatch reading as a redirect. */
function stripHash(url: string): string {
  const h = url.indexOf('#');
  return h === -1 ? url : url.slice(0, h);
}

/**
 * Did this navigation redirect? Two signals, so the answer holds even when
 * CDP attached mid-navigation and never saw the 3xx hop:
 *   - the redirect folded into the lifecycle (`redirectHopCount > 0`); or
 *   - the final committed document's URL differs from the page's recorded
 *     root URL — the request-level redirect was lost, but the page stream
 *     still recorded the root (`Page.startedAtMs` / `Page.url`), so the two
 *     URLs disagree.
 * Gates the footer leg: a non-redirected nav has no leg, so its DCL/Load
 * stay exactly on the root-anchored HAR values (no nav-setup clock skew).
 */
function isRedirectedNav(finalDoc: RequestLifecycle, page: Page): boolean {
  if (finalDoc.redirectHopCount > 0) return true;
  return page.url != null && stripHash(page.url) !== stripHash(finalDoc.url);
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

  // The one recording-state scope predicate, composed from the clear floor
  // (Preserve log) and the recording windows (record / stop). Applied to
  // rows, synthetic rows, AND pages below — the browser scopes its whole
  // network log, not just the rows, so the page block, footer, counts, and
  // export page set all derive from this same decision and can never drift.
  const scope: PanelViewScope = { navClearFloorMs, recordingWindows };
  const inView = (startedAtMs: number): boolean => isInView(startedAtMs, scope);
  const scoped = lifecycles.filter((lc) => inView(lc.startedAtMs));
  // Synthetic cache rows are already navigation-scoped, but still honor
  // the recording filter via the shared `inView` predicate.
  const visibleSynthetic = syntheticCacheRows.filter((lc) => inView(lc.startedAtMs));
  const merged = visibleSynthetic.length > 0 ? [...scoped, ...visibleSynthetic] : scoped;
  // Pages run through the SAME seam, keyed on the page's COMMIT instant.
  // A navigation whose commit falls in a recording gap (stop → refresh) or
  // below the Preserve-log floor is scoped out exactly like its requests —
  // so the footer milestones, navTiming, page count, and exported page block
  // stay anchored to the recorded page instead of recomputing onto a
  // navigation the user is not recording. The commit instant (`committedAtMs`,
  // immutable at mint) is the membership key because `startedAtMs` is later
  // corrected DOWN to the document's timeOrigin, which precedes the main-frame
  // request that set the nav clear floor — keying on the corrected start would
  // scope the floor's own page out and silently drop its DCL / Load milestones.
  const scopedPages = pages.filter((p) => inView(p.committedAtMs ?? p.startedAtMs));

  const baseRows = buildInspectorRows(merged, opts);
  const { rows: firedRows, dangling } = attachFiresToRows(baseRows, fires);
  // Label OH-induced internal-redirect hops (a query-param/redirect rule's own
  // 307) so the rail reads them as our rewrite, not a server redirect.
  const rows = stampRedirectRewrites(firedRows);

  // Footer byte/count totals over the full in-view set — the same pure helper
  // the view re-runs over its filtered subset, so the footer can read
  // `subset / total` without the two sums ever drifting.
  const footerTotals = computeFooterTotals(rows);

  const lookupByRequestId = new Map<string, InspectorRowWithFires>();
  const lookupByUrl = new Map<string, InspectorRowWithFires>();
  let modifiedCount = 0;
  let failedCount = 0;
  let cachedCount = 0;
  // Finish baseline: anchor to the latest top-level navigation so the
  // total tracks the current page, not the longest request ever seen.
  let baseTime = -1;
  let minStartedAtMs = -1;
  // The final committed document of the latest navigation: the main-document
  // lifecycle whose current hop started last (`hopStartedAtMs`). For a folded
  // redirect that is the final hop; for an un-folded one (CDP mid-attach) it
  // is the standalone final request; for a non-redirect it is the document
  // itself. Synthetic redirect-hop rows (earlier hops) never win the max.
  // This is the footer's zero — the browser anchors DCL / Load / Finish to it.
  // Heuristic selection; the loader fold below makes it loader-authoritative
  // when the latest navigation carries a loader id.
  let footerDoc: RequestLifecycle | null = null;
  for (const row of rows) {
    lookupByRequestId.set(row.lifecycle.requestId, row);
    // First arrival wins for URL collisions — same convention as
    // the legacy `entriesByUrl` map in App.tsx.
    if (!lookupByUrl.has(row.lifecycle.url)) lookupByUrl.set(row.lifecycle.url, row);

    const har = currentHarEntry(row.lifecycle);
    // Live running counts while a row streams, authoritative HAR once finished
    // — the same `display*` source the Size column and `computeFooterTotals`
    // read, so the cache verdict below stays consistent with the footer total.
    const transferred = displayTransferredBytes(row.lifecycle);
    const contentSize = displayResourceBytes(row.lifecycle);

    if (rowFireTier(row.lifecycle, row.fires) === 'applied') modifiedCount++;
    const status = har?.response?.status;
    if (row.lifecycle.phase === 'failed' || (typeof status === 'number' && status >= 400)) failedCount++;
    // Cache hit: a real resource the page received with no wire bytes.
    if ((transferred == null || transferred === 0) && contentSize != null && contentSize > 0) {
      cachedCount++;
    }

    const startedAtMs = row.lifecycle.startedAtMs;
    if (minStartedAtMs < 0 || startedAtMs < minStartedAtMs) minStartedAtMs = startedAtMs;
    if (isMainDocument(row.lifecycle.resourceType)) {
      if (startedAtMs > baseTime) baseTime = startedAtMs;
      if (footerDoc === null || row.lifecycle.hopStartedAtMs > footerDoc.hopStartedAtMs) {
        footerDoc = row.lifecycle;
      }
    }
  }

  // No top-level nav captured (e.g. panel opened mid-session): fall back
  // to the earliest request as the baseline.
  if (baseTime < 0) baseTime = minStartedAtMs;
  let maxEnd = baseTime;
  // Last byte across the whole in-view log (every navigation), the browser
  // footer's `maxTime` — used by the aggregate timeline below.
  let maxEndGlobal = -1;
  for (const row of rows) {
    const end = row.lifecycle.startedAtMs + lifecycleDuration(row.lifecycle);
    if (end > maxEndGlobal) maxEndGlobal = end;
    if (baseTime >= 0 && row.lifecycle.startedAtMs >= baseTime && end > maxEnd) maxEnd = end;
  }

  const latestPage = scopedPages.length > 0 ? scopedPages[scopedPages.length - 1] : null;
  // Loader fold: when the latest navigation carries a loader id, the footer's
  // zero is the document the host bound that page load to — the main-document
  // lifecycle whose loader id matches the page (the same join `resolvePageref`
  // uses), not whichever main document merely started last. Keeps the footer,
  // the page block, and the pageref from disagreeing in a slow-nav transition
  // window. Falls back to the latest-committed-document heuristic above when no
  // loader id is available (heuristic page source, pre-CDP-attach).
  if (latestPage?.loaderId != null) {
    const loaderDoc = selectMainDocByLoader(
      rows.map((r) => r.lifecycle),
      latestPage.loaderId,
    );
    if (loaderDoc !== null) footerDoc = loaderDoc;
  }
  // Footer zero — the final committed document's network start (when it left
  // the queue for the wire), mirroring the browser footer's `baseTime`. Prefer
  // the hop's `hopNetworkStartMs`; fall back to its issue instant
  // (`hopStartedAtMs`) when the network start is unknown, then to the nav start
  // when no main document is known. Issue and network start coincide for a hop
  // that never queued.
  const footerAnchorMs = footerDoc !== null ? (footerDoc.hopNetworkStartMs ?? footerDoc.hopStartedAtMs) : baseTime;
  // Redirect leg: the page stream anchors `dclMs` / `loadMs` to the chain
  // root (`Page.startedAtMs`); the footer re-anchors them to the final
  // committed document by subtracting the gap. Gated on an actual redirect
  // (see `isRedirectedNav`) so a non-redirect's nav-setup clock skew never
  // leaks in — `0` then, and DCL / Load stay on the root-anchored HAR values.
  const legMs =
    footerDoc !== null &&
    latestPage?.startedAtMs != null &&
    isRedirectedNav(footerDoc, latestPage) &&
    footerAnchorMs > latestPage.startedAtMs
      ? footerAnchorMs - latestPage.startedAtMs
      : 0;
  // Finish spans the final document's start to the last byte, like the
  // browser footer (`maxTime − finalDoc.startTime`).
  const finishTimeMs = footerAnchorMs >= 0 && maxEnd > footerAnchorMs ? maxEnd - footerAnchorMs : 0;

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

  const navTiming = projectNavTiming(scopedPages);
  const baselineMs = rows.length > 0 ? rows[0].lifecycle.startedAtMs : null;

  // Footer milestones, re-anchored to the final committed document. `navTiming`
  // keeps the root-anchored HAR values (`pages[].pageTimings`); the status bar
  // mirrors the browser footer, which subtracts the redirect leg (`0` for a
  // non-redirected navigation, so the two coincide there).
  let footerDclMs: number | undefined;
  let footerLoadMs: number | undefined;
  if (latestPage) {
    if (latestPage.dclMs != null) footerDclMs = latestPage.dclMs - legMs;
    if (latestPage.loadMs != null) footerLoadMs = latestPage.loadMs - legMs;
  }

  // Aggregate (browser-default) timeline. Chrome's summary bar overwrites its
  // `baseTime` for every top-level document whose URL matches the inspected
  // URL while walking the newest-first request log, so it lands on the
  // *earliest* navigation to the current page — the zero of the whole
  // preserve-log span. We mirror that: keep the latest navigation's authoritative
  // anchor (`footerAnchorMs`) and pull it back to the earliest same-URL page's
  // own `startedAtMs`. We read the page start directly (not via a request→page
  // join) because that join is the queue-adjusted heuristic that mis-bins a
  // document starting marginally before its own page; the page start is set
  // straight from the page stream and, in CDP mode, already equals the document
  // network start (so it matches `footerAnchorMs` for the latest nav, and a
  // single navigation collapses the aggregate set onto `footer*`). DCL / Load
  // keep the latest navigation's milestone (the last event Chrome saw),
  // re-anchored to that earlier zero.
  let aggregateAnchorMs = footerAnchorMs;
  if (latestPage) {
    for (const p of scopedPages) {
      if (p === latestPage || p.url !== latestPage.url) continue;
      if (p.startedAtMs < aggregateAnchorMs) aggregateAnchorMs = p.startedAtMs;
    }
  }
  const aggregateFinishMs =
    aggregateAnchorMs >= 0 && maxEndGlobal > aggregateAnchorMs ? maxEndGlobal - aggregateAnchorMs : 0;
  const aggregateAnchorDeltaMs = footerAnchorMs - aggregateAnchorMs;
  const aggregateDclMs = footerDclMs != null ? footerDclMs + aggregateAnchorDeltaMs : undefined;
  const aggregateLoadMs = footerLoadMs != null ? footerLoadMs + aggregateAnchorDeltaMs : undefined;

  const getConnectionReuse = (lc: RequestLifecycle): ConnectionReuseInfo => computeConnectionReuse(lc, scoped);
  const getRepeatStats = (lc: RequestLifecycle): RepeatStats | null => computeRepeatStats(lc, scoped);

  return {
    rows,
    dangling,
    pages: scopedPages,
    navTiming,
    initiatorIndex,
    lookupByRequestId,
    lookupByUrl,
    getInitiatorChildren,
    getConnectionReuse,
    getRepeatStats,
    baselineMs,
    totalBytesTransferred: footerTotals.totalBytesTransferred,
    totalResourceSize: footerTotals.totalResourceSize,
    finishTimeMs,
    footerAnchorMs,
    legMs,
    footerDclMs,
    footerLoadMs,
    aggregateFinishMs,
    aggregateDclMs,
    aggregateLoadMs,
    modifiedCount,
    failedCount,
    cachedCount,
    pageCount: scopedPages.length,
  };
}
