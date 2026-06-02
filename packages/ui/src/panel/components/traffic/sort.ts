import type {
  DevpanelNetworkSortBySetting,
  DevpanelNetworkSortDirSetting,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { type WaterfallMetric, waterfallSortValue } from '../../data/network-columns';
import { COLUMN_DEFS } from './columns';

export type SortDir = DevpanelNetworkSortDirSetting;

/** Sort target — a `ColumnKey` in `COLUMN_DEFS` (Request # is `requestNumber`). */
export type SortTarget = DevpanelNetworkSortBySetting;

export function sortValueOf(
  row: InspectorRowWithFires,
  target: SortTarget,
  waterfallMetric: WaterfallMetric,
): string | number {
  // The Waterfall column is overloaded — its sort key follows the active metric.
  if (target === 'waterfall') return waterfallSortValue(row, waterfallMetric);
  return COLUMN_DEFS[target].getSortValue(row);
}

export function sortIndicator(col: SortTarget, sortKey: SortTarget, sortDir: SortDir, active: boolean): string {
  if (!active || col !== sortKey) return '';
  return sortDir === 'asc' ? ' ▴' : ' ▾';
}

export function sortCompare(
  a: InspectorRowWithFires,
  b: InspectorRowWithFires,
  target: SortTarget,
  dir: SortDir,
  waterfallMetric: WaterfallMetric,
): number {
  const va = sortValueOf(a, target, waterfallMetric);
  const vb = sortValueOf(b, target, waterfallMetric);
  let cmp: number;
  if (typeof va === 'number' && typeof vb === 'number') {
    cmp = va - vb;
  } else {
    cmp = String(va).localeCompare(String(vb));
  }
  if (cmp !== 0) return dir === 'asc' ? cmp : -cmp;
  // Stable tiebreak: arrival order via `displayId`. Always ascending so
  // a `desc` sort still presents each tie group in arrival order rather
  // than reversing it.
  return a.displayId - b.displayId;
}
