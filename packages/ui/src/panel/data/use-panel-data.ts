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
import type { PageClientSnapshot } from './page-client-store';
import { computeRepeatStats, type RepeatStats } from './timing-repeats';
import type { InspectorFire } from './types';

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
  /** Largest observed lifecycle duration in milliseconds, or 0 if none. */
  readonly finishTimeMs: number;
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

export function usePanelData(input: UsePanelDataInput): UsePanelDataResult {
  const { lifecycle, page, fire, opts } = input;

  const lifecycles = lifecycle.ordered;
  const pages = page.pages;
  const fires = fire.fires;

  return useMemo(() => {
    const baseRows = buildInspectorRows(lifecycles, opts);
    const { rows, dangling } = attachFiresToRows(baseRows, fires);

    const lookupByRequestId = new Map<string, InspectorRowWithFires>();
    const lookupByUrl = new Map<string, InspectorRowWithFires>();
    let totalBytesTransferred = 0;
    let totalResourceSize = 0;
    let finishTimeMs = 0;
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

      const dur = lifecycleDuration(row.lifecycle);
      if (dur > finishTimeMs) finishTimeMs = dur;
    }

    const initiatorIndex = buildInitiatorIndex(lifecycles);
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

    const getConnectionReuse = (lc: RequestLifecycle): ConnectionReuseInfo => computeConnectionReuse(lc, lifecycles);
    const getRepeatStats = (lc: RequestLifecycle): RepeatStats | null => computeRepeatStats(lc, lifecycles);

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
    };
  }, [lifecycles, pages, fires, opts]);
}
