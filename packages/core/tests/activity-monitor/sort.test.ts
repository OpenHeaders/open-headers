/**
 * The table's sort (the activity monitor plan §6, law 10): one figure
 * orders the rows, the fixed order breaks every tie, what could not be
 * read sorts last either way, and a held order moves no row until the
 * sort is applied again.
 */

import { describe, expect, it } from 'vitest';
import type { ActivityMonitorProcessKind, ActivityMonitorProcessRow } from '../../src/activity-monitor/model';
import {
  compareProcessRows,
  holdProcessOrder,
  nextProcessSort,
  sortedProcessIds,
} from '../../src/activity-monitor/sort';

function makeRow(
  kind: ActivityMonitorProcessKind,
  overrides: Partial<ActivityMonitorProcessRow> = {},
): ActivityMonitorProcessRow {
  return { id: kind, kind, pid: 1, startedAt: 0, cpuRate: 0, memoryBytes: 0, ...overrides };
}

const ROWS = [
  makeRow('window', { pid: 61_007, startedAt: 500, cpuRate: 0.011, memoryBytes: 310 }),
  makeRow('engine', { pid: 4312, startedAt: 100, cpuRate: 0.4, memoryBytes: 212 }),
  makeRow('graphics', { pid: 4318, startedAt: 100, cpuRate: null, memoryBytes: 74 }),
  makeRow('network', { pid: 4319, startedAt: 100, cpuRate: 0.011, memoryBytes: null }),
];

describe('compareProcessRows', () => {
  it('orders by the figure, highest first or lowest first', () => {
    expect(sortedProcessIds(ROWS, { column: 'memory', direction: 'desc' })).toEqual([
      'window',
      'engine',
      'graphics',
      'network',
    ]);
    expect(sortedProcessIds(ROWS, { column: 'pid', direction: 'asc' })).toEqual([
      'engine',
      'graphics',
      'network',
      'window',
    ]);
  });

  it('breaks a tie by the fixed order, the same way in both directions', () => {
    // The window and the network service read the same rate; the window comes first in the fixed order.
    expect(sortedProcessIds(ROWS, { column: 'cpu', direction: 'desc' })).toEqual([
      'engine',
      'window',
      'network',
      'graphics',
    ]);
    expect(sortedProcessIds(ROWS, { column: 'cpu', direction: 'asc' })).toEqual([
      'window',
      'network',
      'engine',
      'graphics',
    ]);
  });

  it('sorts what could not be read last in either direction — a dash is not the smallest figure', () => {
    for (const direction of ['asc', 'desc'] as const) {
      expect(sortedProcessIds(ROWS, { column: 'cpu', direction })[3]).toBe('graphics');
      expect(sortedProcessIds(ROWS, { column: 'memory', direction })[3]).toBe('network');
    }
  });

  it('orders two unreadable rows by the fixed order', () => {
    const compare = compareProcessRows({ column: 'cpu', direction: 'desc' });
    const older = makeRow('other', { id: 'a', pid: 9, startedAt: 1, cpuRate: null });
    const newer = makeRow('other', { id: 'b', pid: 8, startedAt: 2, cpuRate: null });
    expect(compare(older, newer)).toBeLessThan(0);
    expect(compare(newer, older)).toBeGreaterThan(0);
  });
});

describe('nextProcessSort — a heading click', () => {
  it('goes highest first, then lowest first, then back to the fixed order', () => {
    const first = nextProcessSort(null, 'cpu');
    expect(first).toEqual({ column: 'cpu', direction: 'desc' });
    const second = nextProcessSort(first, 'cpu');
    expect(second).toEqual({ column: 'cpu', direction: 'asc' });
    expect(nextProcessSort(second, 'cpu')).toBeNull();
  });

  it('starts another heading highest first', () => {
    expect(nextProcessSort({ column: 'cpu', direction: 'asc' }, 'memory')).toEqual({
      column: 'memory',
      direction: 'desc',
    });
  });
});

describe('holdProcessOrder', () => {
  it('keeps the held order whatever the figures read now', () => {
    const held = sortedProcessIds(ROWS, { column: 'cpu', direction: 'desc' });
    const now = ROWS.map((row) => (row.id === 'network' ? { ...row, cpuRate: 3 } : row));
    expect(holdProcessOrder(now, held).map((row) => row.id)).toEqual(['engine', 'window', 'network', 'graphics']);
  });

  it('places a process that started since after the ones it knows, in the order given', () => {
    const held = ['engine', 'window'];
    const rows = [...ROWS, makeRow('script-sandbox')];
    expect(holdProcessOrder(rows, held).map((row) => row.id)).toEqual([
      'engine',
      'window',
      'graphics',
      'network',
      'script-sandbox',
    ]);
  });

  it('skips a held identity that is gone', () => {
    expect(holdProcessOrder([ROWS[0]], ['engine', 'window']).map((row) => row.id)).toEqual(['window']);
  });
});
