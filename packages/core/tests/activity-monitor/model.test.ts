/**
 * The table's fixed order and the collapsed group (the activity monitor
 * plan §6, law 1): rows keep their place from one answer to the next,
 * and a process with no name is grouped, never dropped.
 */

import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_MONITOR_PROCESS_KINDS,
  ACTIVITY_MONITOR_SERVICE_KINDS,
  type ActivityMonitorProcessKind,
  type ActivityMonitorProcessRow,
  type ActivityMonitorServiceRow,
  arrangeProcessRows,
  countProcesses,
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

describe('the owners of what the host started itself', () => {
  it('lists them after the runtime’s own processes and before the unnamed ones: a terminal, git, the HTTP/3 helper', () => {
    expect(ACTIVITY_MONITOR_PROCESS_KINDS).toEqual([
      'window',
      'engine',
      'graphics',
      'network',
      'script-sandbox',
      'script-runtime',
      'terminal',
      'git',
      'http3-helper',
      'other',
    ]);
    const { named, other } = arrangeProcessRows([
      makeRow('other', { pid: 9 }),
      makeRow('http3-helper', { id: 'h3-helper', pid: 8 }),
      makeRow('terminal', { id: 'terminal:pty-2', pid: 7, startedAt: 20 }),
      makeRow('git', { id: 'git-objects', pid: 6 }),
      makeRow('terminal', { id: 'terminal:pty-1', pid: 5, startedAt: 10 }),
      makeRow('script-runtime', { pid: 4 }),
    ]);
    expect(named.map((row) => row.id)).toEqual(['4:0', 'terminal:pty-1', 'terminal:pty-2', 'git-objects', 'h3-helper']);
    expect(other.map((row) => row.pid)).toEqual([9]);
  });

  it('counts every process an owner’s row stands for, and a row of the runtime’s own as one', () => {
    expect(
      countProcesses([
        makeRow('engine'),
        makeRow('terminal', { processCount: 3 }),
        makeRow('git', { processCount: 1 }),
        makeRow('other'),
      ]),
    ).toBe(6);
    expect(countProcesses([])).toBe(0);
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

describe('the service vocabulary', () => {
  it('lists the five services in the order the panel shows them', () => {
    expect(ACTIVITY_MONITOR_SERVICE_KINDS).toEqual(['sync-server', 'workflows', 'git', 'mcp-server', 'proxy-capture']);
  });

  it('a service row carries facts and no cost — no CPU or memory field on any kind', () => {
    const rows: ActivityMonitorServiceRow[] = [
      {
        kind: 'sync-server',
        state: 'on',
        host: '127.0.0.1',
        port: 8137,
        peers: [{ role: 'extension', browser: 'chrome' }],
      },
      { kind: 'workflows', state: 'on', scheduled: 4, nextFireAt: 1_763_640_000_000 },
      { kind: 'git', state: 'on', bound: 1, watching: 1 },
      { kind: 'mcp-server', state: 'off' },
      { kind: 'proxy-capture', state: 'unreadable', port: null },
    ];
    expect(rows.map((row) => row.kind)).toEqual([...ACTIVITY_MONITOR_SERVICE_KINDS]);
    for (const row of rows) {
      expect(Object.keys(row).some((key) => /cpu|memory/i.test(key))).toBe(false);
    }
  });
});
