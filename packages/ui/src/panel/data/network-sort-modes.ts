/**
 * Named sort orders for the Network table.
 *
 * Each mode is a compound comparator: a primary bucket / axis followed
 * by `displayId` ascending as the tiebreak so the result stays
 * waterfall-stable. Modes exist to express the recurring debugging
 * narratives that single-column sort can't ("failed first, then
 * chronological", "group by type, then chronological"); they
 * coexist with column-click sort, which always wins when the user
 * clicks a column header.
 */

import type { NetworkCustomNestedLevel } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { InspectorRowWithFires } from './inspector-row-projection';
import { currentHarEntry, lifecycleTransferredBytes } from './inspector-row-projection';
import { getColumnSortValue, type SortableColumnKey } from './network-columns';
import { classifyRequestState, type RequestState } from './request-state';
import { isAppliedFire } from './types';

export const NETWORK_SORT_MODES = [
  'arrival',
  'failures',
  'slowest',
  'largest',
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
  arrival: {
    title: 'Arrival',
    subtitle: 'Chronological — the order requests started.',
  },
  failures: {
    title: 'Failures first',
    subtitle: 'Failed → pending → redirected → success · arrival within each.',
  },
  slowest: {
    title: 'Slowest first',
    subtitle: 'Longest duration first · arrival keeps waterfall order on ties.',
  },
  largest: {
    title: 'Largest first',
    subtitle: 'Biggest wire bytes first · arrival within ties.',
  },
  byType: {
    title: 'By resource type',
    subtitle: 'Document → XHR/Fetch → Script → Style → Image → Font → Media → WS → Other · arrival within each.',
  },
  byDomain: {
    title: 'By domain',
    subtitle: 'Group by hostname (A → Z) · arrival within each domain.',
  },
  ruleModified: {
    title: 'Rule-modified first',
    subtitle: 'Applied rules → inferred → no fire · arrival within each.',
  },
};

function arrival(a: InspectorRowWithFires, b: InspectorRowWithFires): number {
  return a.displayId - b.displayId;
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
  const harTime = currentHarEntry(row.lifecycle)?.time;
  if (typeof harTime === 'number' && harTime > 0) return harTime;
  const lc = row.lifecycle;
  if (lc.completedAtMs != null) {
    const d = lc.completedAtMs - lc.startedAtMs;
    if (d > 0) return d;
  }
  return -1;
}

function transferredFor(row: InspectorRowWithFires): number {
  return lifecycleTransferredBytes(row.lifecycle) ?? -1;
}

type Comparator = (a: InspectorRowWithFires, b: InspectorRowWithFires) => number;

export const NETWORK_SORT_MODE_COMPARATORS: Record<NetworkSortMode, Comparator> = {
  arrival,
  failures: (a, b) => failureTier(a) - failureTier(b) || arrival(a, b),
  slowest: (a, b) => durationFor(b) - durationFor(a) || arrival(a, b),
  largest: (a, b) => transferredFor(b) - transferredFor(a) || arrival(a, b),
  byType: (a, b) => typeTier(a) - typeTier(b) || arrival(a, b),
  byDomain: (a, b) => host(a.lifecycle.url).localeCompare(host(b.lifecycle.url)) || arrival(a, b),
  ruleModified: (a, b) => fireTier(a) - fireTier(b) || arrival(a, b),
};

/**
 * Compose a comparator from a user-built ordered list of (column,
 * direction) levels. Each level is broken by the next; arrival
 * (`displayId` ascending) is the implicit final tiebreak so the result
 * stays waterfall-stable even when every user-chosen level ties.
 */
export function buildCustomNestedComparator(levels: readonly NetworkCustomNestedLevel[]): Comparator {
  return (a, b) => {
    for (const { key, dir } of levels) {
      const va = key === 'id' ? a.displayId : getColumnSortValue(key as SortableColumnKey, a);
      const vb = key === 'id' ? b.displayId : getColumnSortValue(key as SortableColumnKey, b);
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb;
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
    }
    return arrival(a, b);
  };
}
