/**
 * Named sort orders for the Network table.
 *
 * Each mode is a compound comparator: a primary bucket / axis followed
 * by start time ascending as the tiebreak so the result stays
 * waterfall-stable. (Request # / `displayId` is discovery order, not
 * start order, so it can't serve as the chronological tiebreak.)
 * Modes exist to express the recurring debugging
 * narratives that single-column sort can't ("failed first, then
 * chronological", "group by type, then chronological"); they
 * coexist with column-click sort, which always wins when the user
 * clicks a column header.
 */

import type { NetworkCustomNestedLevel } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { lifecycleTransferredBytes } from './inspector-row-projection';
import { durationMs, getColumnSortValue, priorityRank, type SortableColumnKey } from './network-columns';
import { classifyRequestState, type RequestState } from './request-state';
import { isAppliedFire } from './types';

export const NETWORK_SORT_MODES = [
  'failures',
  'slowest',
  'largest',
  'browserPriority',
  'byType',
  'byDomain',
  'ruleModified',
] as const;
export type NetworkSortMode = (typeof NETWORK_SORT_MODES)[number];

export interface NetworkSortModeMeta {
  title: string;
  subtitle: string;
}

export const NETWORK_SORT_MODE_META: Record<NetworkSortMode, NetworkSortModeMeta> = {
  failures: {
    title: 'Failures first',
    subtitle: 'Failed → pending → redirected → success · start time within each.',
  },
  slowest: {
    title: 'Slowest first',
    subtitle: 'Longest duration first · start time keeps waterfall order on ties.',
  },
  largest: {
    title: 'Largest first',
    subtitle: 'Biggest wire bytes first · start time within ties.',
  },
  browserPriority: {
    title: 'Browser priority',
    subtitle: 'Highest → Lowest by the browser’s reported priority · start time within each.',
  },
  byType: {
    title: 'By resource type',
    subtitle: 'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · start time within each.',
  },
  byDomain: {
    title: 'By domain',
    subtitle: 'Group by hostname (A → Z) · start time within each domain.',
  },
  ruleModified: {
    title: 'Rule-modified first',
    subtitle: 'Applied rules → inferred → no fire · start time within each.',
  },
};

/** Waterfall-stable tiebreak: start time ascending, `requestId` to break exact ties. */
function chronological(a: InspectorRowWithFires, b: InspectorRowWithFires): number {
  const d = a.lifecycle.startedAtMs - b.lifecycle.startedAtMs;
  if (d !== 0) return d;
  return a.lifecycle.requestId < b.lifecycle.requestId ? -1 : a.lifecycle.requestId > b.lifecycle.requestId ? 1 : 0;
}

// ── Failure tiers ────────────────────────────────────────────────────
function failureTier(row: InspectorRowWithFires): number {
  const state: RequestState = classifyRequestState(row.lifecycle);
  switch (state.kind) {
    case 'blocked':
    case 'failed':
    case 'httpError':
      return 0;
    case 'pending':
      return 1;
    case 'redirect':
      return 2;
    case 'success':
      return 3;
    case 'cached':
      return 4;
    default:
      return 5;
  }
}

// ── Type tiers ────────────────────────────────────────────────────────
const TYPE_ORDER: readonly string[] = [
  'document',
  'main_frame',
  'sub_frame',
  'xmlhttprequest',
  'xhr',
  'fetch',
  'script',
  'js',
  'stylesheet',
  'css',
  'image',
  'img',
  'font',
  'media',
  'websocket',
  'ws',
  'wasm',
  'preflight',
];

function typeTier(row: InspectorRowWithFires): number {
  const t = (row.lifecycle.resourceType ?? '').toLowerCase();
  const idx = TYPE_ORDER.indexOf(t);
  return idx === -1 ? TYPE_ORDER.length : idx;
}

function host(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// ── Rule-fire tiers ──────────────────────────────────────────────────
function fireTier(row: InspectorRowWithFires): number {
  if (row.fires.length === 0) return 2;
  return row.fires.some(isAppliedFire) ? 0 : 1;
}

function durationFor(row: InspectorRowWithFires): number {
  // Active duration (queueing excluded) — same basis as the Time column.
  return durationMs(row.lifecycle);
}

function transferredFor(row: InspectorRowWithFires): number {
  return lifecycleTransferredBytes(row.lifecycle) ?? -1;
}

type Comparator = (a: InspectorRowWithFires, b: InspectorRowWithFires) => number;

export const NETWORK_SORT_MODE_COMPARATORS: Record<NetworkSortMode, Comparator> = {
  failures: (a, b) => failureTier(a) - failureTier(b) || chronological(a, b),
  slowest: (a, b) => durationFor(b) - durationFor(a) || chronological(a, b),
  largest: (a, b) => transferredFor(b) - transferredFor(a) || chronological(a, b),
  browserPriority: (a, b) => priorityRank(b.lifecycle) - priorityRank(a.lifecycle) || chronological(a, b),
  byType: (a, b) => typeTier(a) - typeTier(b) || chronological(a, b),
  byDomain: (a, b) => host(a.lifecycle.url).localeCompare(host(b.lifecycle.url)) || chronological(a, b),
  ruleModified: (a, b) => fireTier(a) - fireTier(b) || chronological(a, b),
};

/**
 * Compose a comparator from a user-built ordered list of (column,
 * direction) levels. Each level is broken by the next; start time
 * ascending is the implicit final tiebreak so the result stays
 * waterfall-stable even when every user-chosen level ties.
 */
export function buildCustomNestedComparator(levels: readonly NetworkCustomNestedLevel[]): Comparator {
  return (a, b) => {
    for (const { key, dir } of levels) {
      const va = getColumnSortValue(key as SortableColumnKey, a);
      const vb = getColumnSortValue(key as SortableColumnKey, b);
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return chronological(a, b);
  };
}
