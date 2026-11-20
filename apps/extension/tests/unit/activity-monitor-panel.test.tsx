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
 *     owns the service; the arrow asks the shell to front the owner.
 */

import type {
  ActivityMonitorProcessRow,
  ActivityMonitorServiceRow,
  ActivityMonitorSnapshot,
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
    cursor: 0,
    ...overrides,
  };
}

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
