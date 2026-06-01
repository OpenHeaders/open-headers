import type {
  DevpanelNetworkSortBySetting,
  DevpanelNetworkSortDirSetting,
} from '@openheaders/ui/workbench/settings/schema/devpanel-network';
import type { InspectorRowWithFires } from '../../data/inspector-row-projection';
import { COLUMN_DEFS } from './columns';

export type SortDir = DevpanelNetworkSortDirSetting;

/**
 * Sort target. `'id'` is the synthetic leading `#` column — not part
 * of the toggleable registry but always sortable. Everything else
 * maps to a `ColumnKey` in `COLUMN_DEFS`.
 */
export type SortTarget = DevpanelNetworkSortBySetting;

export function sortValueOf(row: InspectorRowWithFires, target: SortTarget): string | number {
  if (target === 'id') return row.displayId;
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
): number {
  const va = sortValueOf(a, target);
  const vb = sortValueOf(b, target);
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
