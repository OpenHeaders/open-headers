/**
 * The table's fixed order and the collapsed group (the activity monitor
 * plan §6, law 1): rows keep their place from one answer to the next,
 * and a process with no name is grouped, never dropped.
 */

import { describe, expect, it } from 'vitest';
import {
  type ActivityMonitorProcessKind,
  type ActivityMonitorProcessRow,
  arrangeProcessRows,
  sumReadable,
} from '../../src/activity-monitor/model';

function makeRow(
  kind: ActivityMonitorProcessKind,
  overrides: Partial<ActivityMonitorProcessRow> = {},
): ActivityMonitorProcessRow {
  return {
    id: `${overrides.pid ?? 1}:${overrides.startedAt ?? 0}`,
    kind,
    pid: 1,
    startedAt: 0,
    cpuRate: 0,
    memoryBytes: 0,
    ...overrides,
  };
}

describe('arrangeProcessRows', () => {
  it('lists the named rows by kind, whatever order the host read them in', () => {
    const { named, other } = arrangeProcessRows([
      makeRow('other', { pid: 9, runtimeName: 'Audio Service' }),
      makeRow('script-runtime', { pid: 8 }),
      makeRow('network', { pid: 4 }),
      makeRow('engine', { pid: 2 }),
      makeRow('script-sandbox', { pid: 7 }),
      makeRow('graphics', { pid: 3 }),
      makeRow('window', { pid: 5 }),
    ]);
    expect(named.map((row) => row.kind)).toEqual([
      'window',
      'engine',
      'graphics',
      'network',
      'script-sandbox',
      'script-runtime',
    ]);
    expect(other.map((row) => row.runtimeName)).toEqual(['Audio Service']);
  });

  it('keeps two rows of one kind in a stable order: the older first, then the pid', () => {
    const { named } = arrangeProcessRows([
      makeRow('window', { pid: 61_300, startedAt: 2_000 }),
      makeRow('window', { pid: 61_007, startedAt: 1_000 }),
      makeRow('window', { pid: 61_100, startedAt: 2_000 }),
    ]);
    expect(named.map((row) => row.pid)).toEqual([61_007, 61_100, 61_300]);
  });

  it('never drops a process it has no name for', () => {
    const rows = [makeRow('other', { pid: 11 }), makeRow('other', { pid: 12 }), makeRow('engine', { pid: 2 })];
    const { named, other } = arrangeProcessRows(rows);
    expect(named.length + other.length).toBe(rows.length);
  });
});

describe('sumReadable', () => {
  it('adds what could be read', () => {
    expect(sumReadable([1.5, null, 2])).toBe(3.5);
    expect(sumReadable([0, 0])).toBe(0);
  });

  it('is unreadable when nothing could be read — not zero', () => {
    expect(sumReadable([null, null])).toBeNull();
    expect(sumReadable([])).toBeNull();
  });
});
