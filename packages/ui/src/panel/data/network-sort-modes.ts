/**
 * Named sort orders for the Network table.
 *
 * Each mode is a compound comparator: a primary bucket / axis followed
 * by `arrivalIndex` as the tiebreak so the result stays
 * waterfall-stable. Modes exist to express the recurring debugging
 * narratives that single-column sort can't ("failed first, then
 * chronological", "group by type, then chronological", …); they
 * coexist with column-click sort, which always wins when the user
 * clicks a column header.
 */

import type { NetworkCustomNestedLevel } from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import { COLUMN_DEFS } from '../components/traffic/columns';
import { classifyRequestState, type RequestState } from './request-state';
import { type InspectorRequest, isAppliedFire } from './types';

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

function arrival(a: InspectorRequest, b: InspectorRequest): number {
  return a.arrivalIndex - b.arrivalIndex;
}

// ── Failure tiers ────────────────────────────────────────────────────
// Lower index = worse / more interesting for triage. Driven by the
// existing RequestState taxonomy so the same classifier feeds both row
// styling and this sort.
function failureTier(entry: InspectorRequest): number {
  const state: RequestState = classifyRequestState(entry);
  switch (state.kind) {
    case 'blocked':
    case 'failed':
    case 'httpError':
      // 4xx/5xx joins the leading triage tier — they're the rows the
      // user most needs to inspect, alongside net-stack failures.
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
// Order mirrors how a page loads — top-frame first, then the calls
// that drive UI state, then static asset classes. Anything unknown
// goes at the bottom.
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

function typeTier(entry: InspectorRequest): number {
  const t = (entry.resourceType ?? '').toLowerCase();
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
// 0 = a rule actually applied (the user explicitly wants this row),
// 1 = inferred match without application,
// 2 = nothing fired.
function fireTier(entry: InspectorRequest): number {
  if (entry.fires.length === 0) return 2;
  return entry.fires.some(isAppliedFire) ? 0 : 1;
}

type Comparator = (a: InspectorRequest, b: InspectorRequest) => number;

export const NETWORK_SORT_MODE_COMPARATORS: Record<NetworkSortMode, Comparator> = {
  arrival,
  failures: (a, b) => failureTier(a) - failureTier(b) || arrival(a, b),
  slowest: (a, b) => (b.duration ?? -1) - (a.duration ?? -1) || arrival(a, b),
  largest: (a, b) => (b.responseSize ?? -1) - (a.responseSize ?? -1) || arrival(a, b),
  byType: (a, b) => typeTier(a) - typeTier(b) || arrival(a, b),
  byDomain: (a, b) => host(a.url).localeCompare(host(b.url)) || arrival(a, b),
  ruleModified: (a, b) => fireTier(a) - fireTier(b) || arrival(a, b),
};

/**
 * Compose a comparator from a user-built ordered list of (column,
 * direction) levels. Each level is broken by the next; arrival is the
 * implicit final tiebreak so the result stays waterfall-stable even
 * when every user-chosen level ties. Mirrors the comparator chain
 * pattern used by `Array.prototype.sort` consumers — return at the
 * first non-zero level.
 */
export function buildCustomNestedComparator(levels: readonly NetworkCustomNestedLevel[]): Comparator {
  return (a, b) => {
    for (const { key, dir } of levels) {
      const va = key === 'id' ? a.arrivalIndex : COLUMN_DEFS[key].getSortValue(a);
      const vb = key === 'id' ? b.arrivalIndex : COLUMN_DEFS[key].getSortValue(b);
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
