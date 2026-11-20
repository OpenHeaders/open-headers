/**
 * The table's sort (the activity monitor plan §6, law 10): a heading
 * click orders the rows by one figure; the fixed order breaks every
 * tie, so two rows with the same figure never trade places. The order a
 * sort produced is HELD between two applications — a figure changing
 * under the pointer moves no row.
 */

import { type ActivityMonitorProcessRow, compareProcessOrder } from './model';

export const ACTIVITY_MONITOR_SORT_COLUMNS = ['cpu', 'memory', 'started', 'pid'] as const;

export type ActivityMonitorSortColumn = (typeof ACTIVITY_MONITOR_SORT_COLUMNS)[number];

export interface ActivityMonitorSort {
  column: ActivityMonitorSortColumn;
  direction: 'asc' | 'desc';
}

function sortValue(row: ActivityMonitorProcessRow, column: ActivityMonitorSortColumn): number | null {
  switch (column) {
    case 'cpu':
      return row.cpuRate;
    case 'memory':
      return row.memoryBytes;
    case 'started':
      return row.startedAt;
    case 'pid':
      return row.pid;
  }
}

/** What could not be read sorts last in either direction — a dash is not the smallest figure. */
export function compareProcessRows(
  sort: ActivityMonitorSort,
): (a: ActivityMonitorProcessRow, b: ActivityMonitorProcessRow) => number {
  return (a, b) => {
    const va = sortValue(a, sort.column);
    const vb = sortValue(b, sort.column);
    if (va === null || vb === null) {
      if (va !== vb) return va === null ? 1 : -1;
      return compareProcessOrder(a, b);
    }
    const byFigure = sort.direction === 'asc' ? va - vb : vb - va;
    return byFigure || compareProcessOrder(a, b);
  };
}

/** A heading click: the highest first, then the lowest first, then back to the fixed order. */
export function nextProcessSort(
  current: ActivityMonitorSort | null,
  column: ActivityMonitorSortColumn,
): ActivityMonitorSort | null {
  if (current?.column !== column) return { column, direction: 'desc' };
  return current.direction === 'desc' ? { column, direction: 'asc' } : null;
}

/** The order a sort gives right now, as identities — what the table holds until the sort is applied again. */
export function sortedProcessIds(rows: readonly ActivityMonitorProcessRow[], sort: ActivityMonitorSort): string[] {
  return [...rows].sort(compareProcessRows(sort)).map((row) => row.id);
}

/**
 * Rows in a held order. A row the order does not know — a process that
 * started since — keeps its given place after the ones it does.
 */
export function holdProcessOrder<Row extends { id: string }>(rows: readonly Row[], held: readonly string[]): Row[] {
  const place = new Map(held.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (place.get(a.id) ?? held.length) - (place.get(b.id) ?? held.length));
}
