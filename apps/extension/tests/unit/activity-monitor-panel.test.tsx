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
 *   - an ask that goes unanswered says so;
 *   - what the engine keeps running sits under RUNNING as facts worded
 *     from structured fields, an off service muted, an unreadable one a
 *     dash; a dot wears the status store's colour where a subsystem
 *     owns the service; the arrow asks the shell to front the owner;
 *   - the history is kept across asks — appended, never asked for
 *     twice, kept through an unanswered ask; a row's last hour is one
 *     path on the one scale; a process that ended keeps a muted row;
 *     the header line adds every process up and says its memory is an
 *     upper bound; a heading click sorts, and the order is held until
 *     a history beat arrives with the pointer off the table (law 10).
 */

import {
  type ActivityMonitorHistoryBeat,
  type ActivityMonitorHistoryPoint,
  type ActivityMonitorProcessRow,
  type ActivityMonitorServiceRow,
  type ActivityMonitorSnapshot,
  formatStartTime,
} from '@openheaders/core/activity-monitor';
import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import type { StatusSnapshot } from '@openheaders/core/types';
import ActivityMonitorPanel from '@openheaders/ui/workbench/components/panels/activity-monitor/ActivityMonitorPanel';
import { SERVICE_REVEAL_TARGETS } from '@openheaders/ui/workbench/components/panels/activity-monitor/service-reveal';
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
    services: [],
    history: [],
    ended: [],
    cursor: 0,
    ...overrides,
  };
}

function makeBeat(
  seq: number,
  at: number,
  points: Record<string, ActivityMonitorHistoryPoint>,
): ActivityMonitorHistoryBeat {
  return { seq, at, points };
}

const HALF_HOUR = 30 * 60_000;

interface BridgeFake {
  bridge: HostBridge;
  asks: Array<{ cursor: number | null }>;
}

function createBridgeFake(answer: () => Promise<ActivityMonitorSnapshot>, status: StatusSnapshot = {}): BridgeFake {
  const asks: Array<{ cursor: number | null }> = [];
  const bridge: HostBridge = {
    async call(type, ...args) {
      if (type === 'getStatusSnapshot') return { snapshot: status } as never;
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

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.useFakeTimers();
  // A hover's tooltip measures its trigger; the test DOM has no observer of its own.
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
    expect(hook.result.current).toEqual({ snapshot: null, unreadable: true, history: [] });
  });

  it('keeps the history across asks: the first answer’s beats, then each answer’s new ones appended', async () => {
    const answers = [
      makeSnapshot({
        history: [makeBeat(1, SAMPLED_AT - 30_000, {}), makeBeat(2, SAMPLED_AT - 15_000, {})],
        cursor: 2,
      }),
      makeSnapshot({ history: [makeBeat(3, SAMPLED_AT, {})], cursor: 3 }),
    ];
    const fake = createBridgeFake(async () => answers.shift() ?? makeSnapshot({ cursor: 3 }));
    setHostBridge(fake.bridge);
    const hook = renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    expect(hook.result.current.history.map((beat) => beat.seq)).toEqual([1, 2]);

    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(hook.result.current.history.map((beat) => beat.seq)).toEqual([1, 2, 3]);
    expect(fake.asks).toEqual([{ cursor: null }, { cursor: 2 }]);
  });

  it('holds the very same history when an answer carries no beat', async () => {
    const answers = [makeSnapshot({ history: [makeBeat(1, SAMPLED_AT, {})], cursor: 1 })];
    const fake = createBridgeFake(async () => answers.shift() ?? makeSnapshot({ cursor: 1 }));
    setHostBridge(fake.bridge);
    const hook = renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    const held = hook.result.current.history;

    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(fake.asks).toHaveLength(2);
    expect(hook.result.current.history).toBe(held);
  });

  it('keeps the history through an unanswered ask, and asks on from the cursor it held', async () => {
    let asked = 0;
    const fake = createBridgeFake(async () => {
      asked += 1;
      if (asked === 2) throw new Error('no handler');
      return asked === 1
        ? makeSnapshot({ history: [makeBeat(1, SAMPLED_AT - 15_000, {})], cursor: 1 })
        : makeSnapshot({ history: [makeBeat(2, SAMPLED_AT, {})], cursor: 2 });
    });
    setHostBridge(fake.bridge);
    const hook = renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(hook.result.current.unreadable).toBe(true);
    expect(hook.result.current.history.map((beat) => beat.seq)).toEqual([1]);

    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(fake.asks[2]).toEqual({ cursor: 1 });
    expect(hook.result.current.history.map((beat) => beat.seq)).toEqual([1, 2]);
  });

  it('replaces the history with beats that do not continue it — the host started over', async () => {
    const answers = [
      makeSnapshot({ history: [makeBeat(8, SAMPLED_AT - 15_000, {}), makeBeat(9, SAMPLED_AT, {})], cursor: 9 }),
      makeSnapshot({ history: [makeBeat(1, SAMPLED_AT + 15_000, {})], cursor: 1 }),
    ];
    const fake = createBridgeFake(async () => answers.shift() ?? makeSnapshot({ cursor: 1 }));
    setHostBridge(fake.bridge);
    const hook = renderHook(() => useActivityMonitorSnapshot(true));
    await tick(0);
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(hook.result.current.history.map((beat) => beat.seq)).toEqual([1]);
  });
});

describe('ActivityMonitorPanel', () => {
  const INFO = { title: 'Activity Monitor', summary: 'test' };

  const cells = (row: Element): string[] =>
    Array.from(row.querySelectorAll('[role="cell"]'), (cell) => cell.textContent);

  it('asks nothing while it is mounted but not the active tab', async () => {
    const fake = createBridgeFake(async () => makeSnapshot());
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active={false} onHide={() => {}} onRevealService={() => {}} />);
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
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
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
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
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
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
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
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    expect(screen.getByText('The processes could not be read.')).toBeTruthy();
    expect(screen.queryAllByTestId('activity-monitor-row')).toHaveLength(0);
  });

  const SERVICES: ActivityMonitorServiceRow[] = [
    {
      kind: 'sync-server',
      state: 'on',
      host: '127.0.0.1',
      port: 8137,
      peers: [
        { role: 'extension', browser: 'chrome' },
        { role: 'cli', browser: null },
      ],
    },
    { kind: 'workflows', state: 'on', scheduled: 4, nextFireAt: SAMPLED_AT + 42_000 },
    { kind: 'git', state: 'on', bound: 1, watching: 1 },
    { kind: 'mcp-server', state: 'on' },
    { kind: 'proxy-capture', state: 'off', port: null },
  ];

  const serviceLines = (): string[][] => screen.getAllByTestId('activity-monitor-service').map((row) => cells(row));

  async function renderServices(
    services: ActivityMonitorServiceRow[],
    status: StatusSnapshot = {},
    onRevealService: (kind: ActivityMonitorServiceRow['kind']) => void = () => {},
  ): Promise<void> {
    setHostBridge(createBridgeFake(async () => makeSnapshot({ services }), status).bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={onRevealService} />);
    await tick(0);
  }

  it('lists what the engine keeps running under RUNNING, each line worded from its facts', async () => {
    await renderServices(SERVICES);
    expect(screen.getByText('Running')).toBeTruthy();
    expect(serviceLines()).toEqual([
      ['Sync server', '127.0.0.1:8137 · 2 connected — Chrome extension, CLI'],
      ['Workflows', '4 scheduled · next in 42 sec.'],
      ['Git', '1 workspace bound · watching for changes'],
      ['MCP server', 'on'],
      ['Proxy capture', 'off'],
    ]);
  });

  it('words the quiet and the partial cases: no peer, nothing scheduled, a folder not watched, a port', async () => {
    await renderServices([
      { kind: 'sync-server', state: 'on', host: '0.0.0.0', port: 8137, peers: [] },
      { kind: 'workflows', state: 'off', scheduled: 0, nextFireAt: null },
      { kind: 'git', state: 'on', bound: 2, watching: 1 },
      { kind: 'mcp-server', state: 'off' },
      { kind: 'proxy-capture', state: 'on', port: 8138 },
    ]);
    expect(serviceLines()).toEqual([
      ['Sync server', '0.0.0.0:8137 · no one connected'],
      ['Workflows', 'none scheduled'],
      ['Git', '2 workspaces bound · watching for changes: 1'],
      ['MCP server', 'off'],
      ['Proxy capture', 'on · port 8138'],
    ]);
  });

  it('says a server that is not listening, and reads a dash for a service that could not be asked', async () => {
    await renderServices([
      { kind: 'sync-server', state: 'off', host: '127.0.0.1', port: 8137, peers: [] },
      { kind: 'workflows', state: 'unreadable', scheduled: 0, nextFireAt: null },
      { kind: 'git', state: 'off', bound: 0, watching: 0 },
    ]);
    expect(serviceLines()).toEqual([
      ['Sync server', 'not listening on 127.0.0.1:8137'],
      ['Workflows', '—'],
      ['Git', 'no workspace bound'],
    ]);
  });

  it('names a browser peer that announced no browser, and a role it has no word for as the registry gave it', async () => {
    await renderServices([
      {
        kind: 'sync-server',
        state: 'on',
        host: '127.0.0.1',
        port: 8137,
        peers: [
          { role: 'extension', browser: null },
          { role: 'web', browser: 'firefox' },
          { role: 'relay', browser: null },
        ],
      },
    ]);
    expect(serviceLines()).toEqual([['Sync server', '127.0.0.1:8137 · 3 connected — Browser extension, Web, relay']]);
  });

  it('mutes a service that is not on with a hollow dot, and gives a running one a filled dot', async () => {
    await renderServices(SERVICES);
    const rows = screen.getAllByTestId('activity-monitor-service');
    const dot = (row: Element): Element | null => row.querySelector('.oh-am-dot');
    expect(rows[3].className).toBe('oh-am-service');
    expect(dot(rows[3])?.getAttribute('data-level')).toBe('green');
    expect(rows[4].className).toBe('oh-am-service oh-am-service--idle');
    expect(dot(rows[4])?.hasAttribute('data-level')).toBe(false);
  });

  it('a dot wears the status store’s colour where a subsystem owns the service, and never a colour of its own', async () => {
    await renderServices(SERVICES, {
      sync: { subsystem: 'sync', state: 'red', message: 'Extension pipe offline', timestamp: SAMPLED_AT },
      live: { subsystem: 'live', state: 'yellow', message: 'Refreshing…', timestamp: SAMPLED_AT },
    });
    const levels = screen
      .getAllByTestId('activity-monitor-service')
      .map((row) => row.querySelector('.oh-am-dot')?.getAttribute('data-level') ?? null);
    expect(levels).toEqual(['red', 'yellow', 'green', 'green', null]);
  });

  it('the arrow names where it leads and asks the shell to front that service’s owner', async () => {
    const revealed: string[] = [];
    await renderServices(SERVICES, {}, (kind) => revealed.push(kind));
    for (const name of [
      'Open Backup and Sync',
      'Open Workflow Status',
      'Open Git · Version Control',
      'Open AI · MCP Server',
      'Open Traffic',
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(revealed).toEqual(['sync-server', 'workflows', 'git', 'mcp-server', 'proxy-capture']);
  });

  it('draws no RUNNING group for an answer that carries no service', async () => {
    await renderServices([]);
    expect(screen.queryByText('Running')).toBeNull();
    expect(screen.queryAllByTestId('activity-monitor-service')).toHaveLength(0);
  });

  const ENGINE = makeRow({ kind: 'engine', pid: 4312, startedAt: SAMPLED_AT - 6 * 3_600_000 - 600_000 });
  const WINDOW = makeRow({ kind: 'window', pid: 61_007, startedAt: SAMPLED_AT - 300_000, memoryBytes: 310 * MB });
  const GRAPHICS = makeRow({ kind: 'graphics', pid: 4318, startedAt: ENGINE.startedAt, memoryBytes: 74 * MB });

  const graphPaths = (row: Element): Array<string | null> =>
    Array.from(row.querySelectorAll('svg path'), (path) => path.getAttribute('d'));

  const rowNames = (): string[] => screen.getAllByTestId('activity-monitor-row').map((row) => cells(row)[0]);

  it('draws a row’s history as one path on the one scale, edge to edge, and nothing for a row with no beat yet', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        processes: [ENGINE, WINDOW],
        history: [
          makeBeat(1, SAMPLED_AT - HALF_HOUR, { [ENGINE.id]: { cpuRate: 0, memoryBytes: 200 * MB } }),
          makeBeat(2, SAMPLED_AT, { [ENGINE.id]: { cpuRate: 1, memoryBytes: 212 * MB } }),
        ],
        cursor: 2,
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);

    const [windowRow, engineRow] = screen.getAllByTestId('activity-monitor-row');
    expect(engineRow.querySelectorAll('svg')).toHaveLength(1);
    // The half hour held fills the box: its oldest beat at zero, now at one full core — the top of the scale.
    expect(graphPaths(engineRow)).toEqual(['M0.0 13.0L100.0 1.0']);
    expect(graphPaths(windowRow)).toEqual(['']);
  });

  it('tops the scale at the whole machine where the host is Windows', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        platform: 'win32',
        logicalCores: 8,
        processes: [ENGINE],
        history: [
          makeBeat(1, SAMPLED_AT - HALF_HOUR, { [ENGINE.id]: { cpuRate: 8, memoryBytes: 200 * MB } }),
          makeBeat(2, SAMPLED_AT, { [ENGINE.id]: { cpuRate: 1, memoryBytes: 212 * MB } }),
        ],
        cursor: 2,
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    // Every core busy is the top; one core of eight is an eighth of the way up.
    expect(graphPaths(screen.getByTestId('activity-monitor-row'))).toEqual(['M0.0 1.0L100.0 11.5']);
  });

  it('keeps a process that ended as a muted row: a dash for CPU, its hour, when it ended and its peak', async () => {
    const runtime = makeRow({ kind: 'script-runtime', pid: 61_377, startedAt: SAMPLED_AT - 20 * 60_000 });
    const endedAt = SAMPLED_AT - 17 * 60_000;
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        processes: [ENGINE],
        history: [
          makeBeat(1, SAMPLED_AT - HALF_HOUR, { [ENGINE.id]: { cpuRate: 0.006, memoryBytes: 212 * MB } }),
          makeBeat(2, SAMPLED_AT - 18 * 60_000, {
            [ENGINE.id]: { cpuRate: 0.006, memoryBytes: 212 * MB },
            [runtime.id]: { cpuRate: 1, memoryBytes: 96 * MB },
          }),
          makeBeat(3, SAMPLED_AT, { [ENGINE.id]: { cpuRate: 0.006, memoryBytes: 212 * MB } }),
        ],
        ended: [{ id: runtime.id, kind: 'script-runtime', pid: 61_377, startedAt: runtime.startedAt, endedAt }],
        cursor: 3,
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);

    expect(rowNames()).toEqual(['Open Headers']);
    const ended = screen.getByTestId('activity-monitor-ended');
    expect(ended.className).toBe('oh-am-row oh-am-row--ended');
    expect(cells(ended)).toEqual([
      'Script runtime · Developer',
      '—',
      `ended ${formatStartTime(endedAt, SAMPLED_AT, 'en')} · peak 100.0%`,
    ]);
    // One beat of it: a level at the top of the scale, over the beat it was measured across.
    expect(graphPaths(ended)).toEqual(['M0.0 1.0L40.0 1.0']);
  });

  it('says only when a process ended where the hour holds no rate of it', async () => {
    const runtime = makeRow({ kind: 'script-runtime', pid: 61_377, startedAt: SAMPLED_AT - 60_000 });
    const endedAt = SAMPLED_AT - 20_000;
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        processes: [ENGINE],
        history: [makeBeat(1, SAMPLED_AT - 30_000, { [runtime.id]: { cpuRate: null, memoryBytes: 96 * MB } })],
        ended: [{ id: runtime.id, kind: 'script-runtime', pid: 61_377, startedAt: runtime.startedAt, endedAt }],
        cursor: 1,
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    expect(cells(screen.getByTestId('activity-monitor-ended'))[2]).toBe(
      `ended ${formatStartTime(endedAt, SAMPLED_AT, 'en')}`,
    );
  });

  it('adds every process up on the one line under the title, with the count and how long the app has run', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({
        processes: [
          { ...ENGINE, cpuRate: 0.006 },
          { ...WINDOW, cpuRate: 0.011 },
        ],
        history: [
          makeBeat(1, SAMPLED_AT - HALF_HOUR, { [ENGINE.id]: { cpuRate: 0.5, memoryBytes: 200 * MB } }),
          makeBeat(2, SAMPLED_AT, {
            [ENGINE.id]: { cpuRate: 0.25, memoryBytes: 212 * MB },
            [WINDOW.id]: { cpuRate: 0.25, memoryBytes: 188 * MB },
          }),
        ],
        cursor: 2,
      }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);

    const summary = screen.getByTestId('activity-monitor-summary');
    expect(Array.from(summary.querySelectorAll('strong'), (figure) => figure.textContent)).toEqual(['1.7%', '522 MB']);
    expect(summary.querySelector('.oh-am-count')?.textContent).toBe('2 processes · up 6 hr');
    // The label says the span the graphs hold — half an hour here, not the hour they will grow to.
    expect(summary.querySelector('.oh-am-range')?.textContent).toBe('last 30 min');
    // CPU on the rows' scale; memory from zero to the history's own highest total (400 MB, now).
    expect(graphPaths(summary)).toEqual(['M0.0 8.0L120.0 8.0', 'M0.0 8.0L120.0 1.0']);
  });

  it('says the whole hour once the history holds one, and no span before the first beat', async () => {
    const hour = Array.from({ length: 240 }, (_, index) =>
      makeBeat(index + 1, SAMPLED_AT - (239 - index) * 15_000, { [ENGINE.id]: { cpuRate: 0, memoryBytes: 200 * MB } }),
    );
    let next = makeSnapshot({ processes: [ENGINE] });
    setHostBridge(createBridgeFake(async () => next).bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    expect(screen.getByTestId('activity-monitor-summary').querySelector('.oh-am-range')).toBeNull();

    next = makeSnapshot({ processes: [ENGINE], history: hour, cursor: 240 });
    await tick(2_000);
    expect(screen.getByTestId('activity-monitor-summary').querySelector('.oh-am-range')?.textContent).toBe(
      'last 60 min',
    );
  });

  it('reads a dash for a total nothing could be read of, and says one process as one', async () => {
    const fake = createBridgeFake(async () =>
      makeSnapshot({ processes: [{ ...ENGINE, cpuRate: null, memoryBytes: null }] }),
    );
    setHostBridge(fake.bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    const summary = screen.getByTestId('activity-monitor-summary');
    expect(Array.from(summary.querySelectorAll('strong'), (figure) => figure.textContent)).toEqual(['—', '—']);
    expect(summary.querySelector('.oh-am-count')?.textContent).toBe('1 process · up 6 hr');
  });

  it('says on hover that the memory total is an upper bound', async () => {
    setHostBridge(createBridgeFake(async () => makeSnapshot({ processes: [ENGINE] })).bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    const memory = screen.getByTestId('activity-monitor-summary').querySelectorAll('.oh-am-stat')[1];
    fireEvent.mouseEnter(memory);
    await tick(500);
    expect(
      screen.getByText('An upper bound — memory that processes share is counted once for each of them.'),
    ).toBeTruthy();
  });

  it('draws no line of totals while there is no answer', async () => {
    setHostBridge(
      createBridgeFake(async () => {
        throw new Error('no handler');
      }).bridge,
    );
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    expect(screen.queryByTestId('activity-monitor-summary')).toBeNull();
  });

  const SORTABLE = [
    { ...WINDOW, cpuRate: 0.001 },
    { ...ENGINE, cpuRate: 0.006 },
    { ...GRAPHICS, cpuRate: 0.4 },
  ];

  it('sorts on a heading click — highest first, then lowest first, then the fixed order again', async () => {
    setHostBridge(createBridgeFake(async () => makeSnapshot({ processes: SORTABLE })).bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    expect(rowNames()).toEqual(['Workbench window', 'Open Headers', 'Graphics']);
    const head = (): HTMLElement => screen.getByRole('columnheader', { name: 'CPU' });
    expect(head().hasAttribute('aria-sort')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'CPU' }));
    expect(rowNames()).toEqual(['Graphics', 'Open Headers', 'Workbench window']);
    expect(head().getAttribute('aria-sort')).toBe('descending');
    expect(head().textContent).toBe('CPU ▾');

    fireEvent.click(screen.getByRole('button', { name: 'CPU' }));
    expect(rowNames()).toEqual(['Workbench window', 'Open Headers', 'Graphics']);
    expect(head().getAttribute('aria-sort')).toBe('ascending');
    expect(head().textContent).toBe('CPU ▴');

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    expect(rowNames()).toEqual(['Workbench window', 'Open Headers', 'Graphics']);
    expect(head().hasAttribute('aria-sort')).toBe(false);
    expect(screen.getByRole('columnheader', { name: 'Memory' }).getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    fireEvent.click(screen.getByRole('button', { name: 'Memory' }));
    expect(screen.getByRole('columnheader', { name: 'Memory' }).hasAttribute('aria-sort')).toBe(false);
    expect(rowNames()).toEqual(['Workbench window', 'Open Headers', 'Graphics']);
  });

  it('holds a sorted order while figures change, applies it again on a history beat, never under the pointer', async () => {
    let next = makeSnapshot({ processes: SORTABLE, history: [makeBeat(1, SAMPLED_AT, {})], cursor: 1 });
    setHostBridge(createBridgeFake(async () => next).bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    fireEvent.click(screen.getByRole('button', { name: 'CPU' }));
    expect(rowNames()).toEqual(['Graphics', 'Open Headers', 'Workbench window']);

    // The window is now the busiest. An answer with no new beat changes its figure in place and moves no row.
    const busy = [{ ...WINDOW, cpuRate: 0.9 }, SORTABLE[1], SORTABLE[2]];
    next = makeSnapshot({ processes: busy, cursor: 1 });
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(cells(screen.getAllByTestId('activity-monitor-row')[2])).toEqual(
      expect.arrayContaining(['Workbench window', '90.0%']),
    );
    expect(rowNames()).toEqual(['Graphics', 'Open Headers', 'Workbench window']);

    // A beat arrives while the pointer is over the table: the order is held.
    fireEvent.mouseEnter(screen.getByRole('table'));
    next = makeSnapshot({ processes: busy, history: [makeBeat(2, SAMPLED_AT + 15_000, {})], cursor: 2 });
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(rowNames()).toEqual(['Graphics', 'Open Headers', 'Workbench window']);

    // The pointer leaves: still held until the next beat, and applied on it.
    fireEvent.mouseLeave(screen.getByRole('table'));
    next = makeSnapshot({ processes: busy, cursor: 2 });
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(rowNames()).toEqual(['Graphics', 'Open Headers', 'Workbench window']);

    next = makeSnapshot({ processes: busy, history: [makeBeat(3, SAMPLED_AT + 30_000, {})], cursor: 3 });
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(rowNames()).toEqual(['Workbench window', 'Graphics', 'Open Headers']);
  });

  it('places a process that started since the sort was applied after the rows it holds', async () => {
    let next = makeSnapshot({ processes: SORTABLE, cursor: 0 });
    setHostBridge(createBridgeFake(async () => next).bridge);
    render(<ActivityMonitorPanel info={INFO} active onHide={() => {}} onRevealService={() => {}} />);
    await tick(0);
    fireEvent.click(screen.getByRole('button', { name: 'CPU' }));

    const sandbox = makeRow({ kind: 'script-sandbox', pid: 61_377, startedAt: SAMPLED_AT, cpuRate: 2 });
    next = makeSnapshot({ processes: [...SORTABLE, sandbox], cursor: 0 });
    await tick(ACTIVITY_MONITOR_PULL_MS);
    expect(rowNames()).toEqual(['Graphics', 'Open Headers', 'Workbench window', 'Script sandbox · Safe']);
  });
});

describe('where a service’s reveal leads', () => {
  it('fronts the surface that owns each service — a tool window or a Settings category', () => {
    expect(SERVICE_REVEAL_TARGETS).toMatchObject({
      'sync-server': { settingsCategory: 'backend' },
      workflows: { toolWindow: 'workflow-status' },
      git: { toolWindow: 'git' },
      'mcp-server': { settingsCategory: 'mcpAccess' },
      'proxy-capture': { toolWindow: 'traffic-monitor' },
    });
  });
});
