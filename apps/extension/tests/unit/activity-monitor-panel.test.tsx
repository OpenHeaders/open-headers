/**
 * The activity monitor's panel (the activity monitor plan §6, laws 2
 * and 6; §8):
 *   - the pull starts on activation, repeats every two seconds, stops
 *     when the tab is no longer the active one or the document is
 *     hidden, and never runs on a mount alone;
 *   - each ask hands back the cursor the previous answer carried;
 *   - a rate that could not be read is a dash, never zero;
 *   - processes without a name sit under one collapsed group and open
 *     to the runtime's own names;
 *   - an ask that goes unanswered says so.
 */

import type { ActivityMonitorProcessRow, ActivityMonitorSnapshot } from '@openheaders/core/activity-monitor';
import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import ActivityMonitorPanel from '@openheaders/ui/workbench/components/panels/activity-monitor/ActivityMonitorPanel';
import {
  ACTIVITY_MONITOR_PULL_MS,
  useActivityMonitorSnapshot,
} from '@openheaders/ui/workbench/components/panels/activity-monitor/use-activity-monitor-snapshot';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SAMPLED_AT = Date.UTC(2026, 10, 20, 15, 0);
const MB = 1024 * 1024;

function makeRow(overrides: Partial<ActivityMonitorProcessRow> = {}): ActivityMonitorProcessRow {
  return {
    id: `${overrides.pid ?? 4312}:${overrides.startedAt ?? SAMPLED_AT - 60_000}`,
    kind: 'engine',
    pid: 4312,
    startedAt: SAMPLED_AT - 60_000,
    cpuRate: 0.006,
    memoryBytes: 212 * MB,
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<ActivityMonitorSnapshot> = {}): ActivityMonitorSnapshot {
  return {
    sampledAt: SAMPLED_AT,
    platform: 'darwin',
    logicalCores: 10,
    processes: [makeRow()],
    cursor: 0,
    ...overrides,
  };
}

interface BridgeFake {
  bridge: HostBridge;
  asks: Array<{ cursor: number | null }>;
}

function createBridgeFake(answer: () => Promise<ActivityMonitorSnapshot>): BridgeFake {
  const asks: Array<{ cursor: number | null }> = [];
  const bridge: HostBridge = {
    async call(type, ...args) {
      if (type !== 'oh.activityMonitor.sample') throw new Error(`unexpected rpc ${String(type)}`);
      asks.push(args[0] as { cursor: number | null });
      return (await answer()) as never;
    },
    broadcast: () => {},
    subscribe: () => () => {},
    presence: () => () => {},
  };
  return { bridge, asks };
}

let visibility: DocumentVisibilityState = 'visible';

function setDocumentVisibility(next: DocumentVisibilityState): void {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}

async function tick(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useActivityMonitorSnapshot', () => {
  it('never asks on a mount alone', async () => {
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    renderHook(() => useActivityMonitorSnapshot(false));
    await tick(ACTIVITY_MONITOR_PULL_MS * 5);
    expect(fake.asks).toHaveLength(0);
  });

  it('asks on activation, then every two seconds', async () => {
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    const hook = renderHook(({ active }) => useActivityMonitorSnapshot(active), { initialProps: { active: false } });

    hook.rerender({ active: true });
    await tick(0);
    expect(fake.asks).toHaveLength(1);
    expect(hook.result.current.snapshot?.sampledAt).toBe(SAMPLED_AT);

    await tick(ACTIVITY_MONITOR_PULL_MS - 1);
    expect(fake.asks).toHaveLength(1);
    await tick(1);
    expect(fake.asks).toHaveLength(2);
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(fake.asks).toHaveLength(3);
  });

  it('stops when the tab is no longer the active one', async () => {
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    const hook = renderHook(({ active }) => useActivityMonitorSnapshot(active), { initialProps: { active: true } });
    await tick(0);
    expect(fake.asks).toHaveLength(1);

    hook.rerender({ active: false });
    await tick(ACTIVITY_MONITOR_PULL_MS * 5);
    expect(fake.asks).toHaveLength(1);
  });

  it('stops while the document is hidden and asks again the moment it shows', async () => {
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    expect(fake.asks).toHaveLength(1);

    act(() => setDocumentVisibility('hidden'));
    await tick(ACTIVITY_MONITOR_PULL_MS * 5);
    expect(fake.asks).toHaveLength(1);

    act(() => setDocumentVisibility('visible'));
    await tick(0);
    expect(fake.asks).toHaveLength(2);
  });

  it('does not start in a hidden document, active or not', async () => {
    visibility = 'hidden';
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    renderHook(() => useActivityMonitorSnapshot(true));
    await tick(ACTIVITY_MONITOR_PULL_MS * 5);
    expect(fake.asks).toHaveLength(0);
  });

  it('hands each ask the cursor the previous answer carried', async () => {
    const fake = createBridgeFake(async () => makeSnapshot({ cursor: 7 }));
    setHostBridge(fake.bridge);
    renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(fake.asks).toEqual([{ cursor: null }, { cursor: 7 }]);
  });

  it('does not stack a second ask on one still unanswered', async () => {
    const fake = createBridgeFake(() => new Promise<ActivityMonitorSnapshot>(() => {}));
    setHostBridge(fake.bridge);
    renderHook(() => useActivityMonitorSnapshot(true));
    await tick(ACTIVITY_MONITOR_PULL_MS * 5);
    expect(fake.asks).toHaveLength(1);
  });

  it('says an ask went unanswered and drops the figures it held', async () => {
    let answered = false;
    const fake = createBridgeFake(async () => {
      if (answered) throw new Error('no handler');
      answered = true;
      return makeSnapshot();
    });
    setHostBridge(fake.bridge);
    const hook = renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    expect(hook.result.current).toMatchObject({ unreadable: false });

    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(hook.result.current).toEqual({ snapshot: null, unreadable: true });
  });
});

describe('ActivityMonitorPanel', () => {
  const INFO = { title: 'Activity Monitor', summary: 'test' };

  const cells = (row: Element): string[] =>
    Array.from(row.querySelectorAll('[role="cell"]'), (cell) => cell.textContent);

  it('asks nothing while it is mounted but not the active tab', async () => {
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active={false} onHide={() => {}} />);
    await tick(ACTIVITY_MONITOR_PULL_MS * 5);
    expect(fake.asks).toHaveLength(0);
    expect(screen.queryAllByTestId('activity-monitor-row')).toHaveLength(0);
  });

  it('lists each process by its name with its figures, a dash where the rate could not be read', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        processes: [
          makeRow({ kind: 'engine', pid: 4312, cpuRate: 0.006, memoryBytes: 212 * MB }),
          makeRow({ kind: 'window', pid: 61_007, cpuRate: null, memoryBytes: 310 * MB }),
          makeRow({ kind: 'graphics', pid: 4318, cpuRate: 0, memoryBytes: null }),
        ],
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} />);
    await tick(0);

    const rows = screen.getAllByTestId('activity-monitor-row');
    expect(rows.map((row) => cells(row).slice(0, 3))).toEqual([
      ['Workbench window', '—', '310 MB'],
      ['Open Headers', '0.6%', '212 MB'],
      ['Graphics', '0.0%', '—'],
    ]);
    expect(cells(rows[0])[4]).toBe('61007');
  });

  it('counts "CPU %" as a share of the whole machine where the host is Windows', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({ platform: 'win32', logicalCores: 8, processes: [makeRow({ cpuRate: 0.4 })] }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} />);
    await tick(0);
    expect(cells(screen.getByTestId('activity-monitor-row'))[1]).toBe('5.0%');
  });

  it('keeps unnamed processes under one collapsed group that opens to the runtime names', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        processes: [
          makeRow(),
          makeRow({ kind: 'other', runtimeName: 'Audio Service', pid: 4377, cpuRate: 0.01, memoryBytes: 24 * MB }),
          makeRow({ kind: 'other', runtimeName: 'Tab', pid: 61_012, cpuRate: null, memoryBytes: 37 * MB }),
        ],
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} />);
    await tick(0);

    const group = screen.getByTestId('activity-monitor-other');
    expect(group.textContent).toContain('Other (2)');
    expect(cells(group)).toEqual(['1.0%', '61 MB']);
    expect(screen.getAllByTestId('activity-monitor-row')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Other (2)' }));
    const rows = screen.getAllByTestId('activity-monitor-row');
    expect(rows.map((row) => cells(row)[0])).toEqual(['Open Headers', 'Audio Service', 'Tab']);
  });

  it('says so when the processes could not be read', async () => {
    const fake = createBridgeFake(async () => {
      throw new Error('no handler');
    });
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} />);
    await tick(0);
    expect(screen.getByText('The processes could not be read.')).toBeTruthy();
    expect(screen.queryAllByTestId('activity-monitor-row')).toHaveLength(0);
  });
});
