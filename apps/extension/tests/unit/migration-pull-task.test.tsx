/**
 * Migration pull as a background-tasks tenant.
 *
 * Pins the surface contract over the S8 plumbing:
 *   - `deriveMigrationPullTask` maps every folded run phase to its
 *     corner entry (per-item progress, 429 pause countdown, monthly
 *     budget note, the "Import finished — view report" flip, failure
 *     states) and to nothing when idle;
 *   - `useMigrationPullTask` hydrates from `getState`, folds live
 *     `migrationPullEvent` broadcasts with the core reducer, prefers
 *     the live stream over a stale snapshot, ticks the pause countdown
 *     locally, and routes the click-through to `onViewReport`;
 *   - hosts without the migration ladder (the RPC rejects) never mint
 *     a task;
 *   - the indicator renders a task's `onActivate` as its click-through.
 */

import { type HostBridge, setHostBridge } from '@openheaders/core/bridge';
import {
  foldPullEvent,
  initialPullRunState,
  type MigrationPullRunState,
  type PostmanPullEvent,
  startPullRunState,
} from '@openheaders/core/import';
import {
  __resetBackgroundTasksForTests,
  BackgroundTasksIndicator,
  deriveMigrationPullTask,
  upsertBackgroundTask,
  useBackgroundTasks,
  useMigrationPullTask,
} from '@openheaders/ui/shared/background-tasks';
import { act, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const RUN_ID = 'run-1';

function fold(...events: PostmanPullEvent[]): MigrationPullRunState {
  return events.reduce(foldPullEvent, startPullRunState(RUN_ID));
}

const PLANNED: PostmanPullEvent = { kind: 'planned', workspaces: 2, collections: 8, environments: 4, totalCalls: 15 };
const PROGRESS: PostmanPullEvent = {
  kind: 'item-progress',
  item: 'collection',
  id: 'col-1',
  name: 'Users API',
  status: 'pulled',
  completedItems: 3,
  totalItems: 12,
};
const IMPORTED: PostmanPullEvent = {
  kind: 'imported',
  summary: {
    workspaceId: 'ws-landing',
    workspaceName: 'Imported from Postman',
    collections: 8,
    environments: 4,
    requests: 42,
    drops: 3,
  },
};

interface BridgeFake {
  bridge: HostBridge;
  emit: (runId: string, seq: number, event: PostmanPullEvent) => void;
}

function createBridgeFake(getState: () => Promise<MigrationPullRunState>): BridgeFake {
  const listeners = new Set<(payload: unknown) => void>();
  const bridge: HostBridge = {
    async call(type, ..._args) {
      if (type === 'oh.migration.postmanPull.getState') return (await getState()) as never;
      throw new Error(`unexpected rpc ${String(type)}`);
    },
    broadcast: () => {},
    subscribe(type, handler) {
      const fn = handler as (payload: unknown) => void;
      if (type === 'migrationPullEvent') listeners.add(fn);
      return () => listeners.delete(fn);
    },
    presence: () => () => {},
  };
  return {
    bridge,
    emit: (runId, seq, event) => {
      for (const fn of listeners) fn({ runId, seq, event });
    },
  };
}

beforeEach(() => {
  __resetBackgroundTasksForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveMigrationPullTask', () => {
  it('returns null before any run exists', () => {
    expect(deriveMigrationPullTask(initialPullRunState(), null)).toBeNull();
  });

  it('shows an indeterminate enumerating entry when a run starts', () => {
    const task = deriveMigrationPullTask(startPullRunState(RUN_ID), null);
    expect(task).toMatchObject({ title: 'Migrating from Postman', percent: null });
    expect(task?.detail).toContain('Finding workspaces');
  });

  it('shows per-item progress with the last item and the monthly budget', () => {
    const state = fold(PLANNED, PROGRESS, { kind: 'budget', limitMonth: 10000, remainingMonth: 9876 });
    const task = deriveMigrationPullTask(state, null);
    expect(task?.percent).toBe(25);
    expect(task?.detail).toContain('Pulled Users API');
    expect(task?.detail).toContain('3/12 items');
    // Grouping separator is locale-dependent — match around it.
    expect(task?.detail).toMatch(/9.?876 API calls left this month/);
  });

  it('shows the pause countdown while rate limited, preferring the live tick', () => {
    const state = fold(PLANNED, PROGRESS, { kind: 'rate-limit-pause', retryAfterSeconds: 7 });
    expect(deriveMigrationPullTask(state, null)?.detail).toContain('resuming in 7s');
    expect(deriveMigrationPullTask(state, 4)?.detail).toContain('resuming in 4s');
    // Progress stays visible under the pause.
    expect(deriveMigrationPullTask(state, 4)?.percent).toBe(25);
  });

  it('shows an indeterminate importing entry during materialization', () => {
    const state = fold(PLANNED, PROGRESS, {
      kind: 'finished',
      outcome: 'complete',
      collections: 8,
      environments: 4,
      skipped: 0,
    });
    const task = deriveMigrationPullTask(foldPullEvent(state, { kind: 'importing' }), null);
    expect(task).toMatchObject({ percent: null });
    expect(task?.detail).toContain('Importing into Open Headers');
  });

  it('flips to "view report" with the summary counts and click-through', () => {
    const state = fold(
      PLANNED,
      PROGRESS,
      { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 },
      { kind: 'importing' },
      IMPORTED,
    );
    const onViewReport = vi.fn();
    const task = deriveMigrationPullTask(state, null, onViewReport);
    expect(task?.title).toBe('Import finished — view report');
    expect(task?.percent).toBe(100);
    expect(task?.detail).toContain('8 collections, 4 environments, 42 requests');
    expect(task?.detail).toContain('“Imported from Postman”');
    expect(task?.detail).toContain('3 import notes');
    task?.onActivate?.();
    expect(onViewReport).toHaveBeenCalledTimes(1);
  });

  it('labels a partial run on the completion flip', () => {
    const state = fold(
      PLANNED,
      PROGRESS,
      {
        kind: 'finished',
        outcome: 'partial',
        stopReason: 'Monthly service limit exhausted',
        collections: 3,
        environments: 1,
        skipped: 8,
      },
      { kind: 'importing' },
      IMPORTED,
    );
    expect(deriveMigrationPullTask(state, null)?.detail).toContain('Partial import:');
  });

  it('surfaces a failed pull as an error entry with the stop reason', () => {
    const state = fold({
      kind: 'finished',
      outcome: 'failed',
      stopReason: 'The API key was rejected.',
      collections: 0,
      environments: 0,
      skipped: 0,
    });
    const task = deriveMigrationPullTask(state, null);
    expect(task).toMatchObject({ title: 'Postman migration failed', error: true });
    expect(task?.detail).toBe('The API key was rejected.');
  });

  it('surfaces a materialization crash as an error entry', () => {
    const state = fold(
      PLANNED,
      { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 },
      { kind: 'importing' },
      { kind: 'import-failed', reason: 'workspace service unavailable' },
    );
    const task = deriveMigrationPullTask(state, null);
    expect(task).toMatchObject({ title: 'Postman import failed', error: true });
    expect(task?.detail).toBe('workspace service unavailable');
  });

  it('reports an empty complete run without an error state', () => {
    const state = fold({ kind: 'finished', outcome: 'complete', collections: 0, environments: 0, skipped: 0 });
    const task = deriveMigrationPullTask(state, null);
    expect(task?.title).toBe('Postman migration finished');
    expect(task?.error).toBeUndefined();
  });
});

describe('useMigrationPullTask', () => {
  it('hydrates a late-joining surface from getState', async () => {
    const midRun = fold(PLANNED, PROGRESS);
    const fake = createBridgeFake(async () => midRun);
    setHostBridge(fake.bridge);
    renderHook(() => useMigrationPullTask());
    const tasks = renderHook(() => useBackgroundTasks());
    await waitFor(() => expect(tasks.result.current).toHaveLength(1));
    expect(tasks.result.current[0].detail).toContain('3/12 items');
  });

  it('folds live events and prefers the stream over a stale snapshot', async () => {
    let resolveSnapshot: (state: MigrationPullRunState) => void = () => {};
    const snapshot = new Promise<MigrationPullRunState>((resolve) => {
      resolveSnapshot = resolve;
    });
    const fake = createBridgeFake(() => snapshot);
    setHostBridge(fake.bridge);
    renderHook(() => useMigrationPullTask());
    const tasks = renderHook(() => useBackgroundTasks());

    // The terminal event lands before hydration answers…
    act(() => {
      fake.emit(RUN_ID, 1, PLANNED);
      fake.emit(RUN_ID, 2, { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 });
      fake.emit(RUN_ID, 3, { kind: 'importing' });
      fake.emit(RUN_ID, 4, IMPORTED);
    });
    expect(tasks.result.current[0].title).toBe('Import finished — view report');

    // …so the older mid-run snapshot must not regress the entry.
    await act(async () => {
      resolveSnapshot(fold(PLANNED, PROGRESS));
      await snapshot;
    });
    expect(tasks.result.current[0].title).toBe('Import finished — view report');
  });

  it('ticks the pause countdown locally and clears it on the next progress', async () => {
    vi.useFakeTimers();
    const fake = createBridgeFake(async () => fold(PLANNED));
    setHostBridge(fake.bridge);
    renderHook(() => useMigrationPullTask());
    const tasks = renderHook(() => useBackgroundTasks());

    act(() => {
      fake.emit(RUN_ID, 1, PLANNED);
      fake.emit(RUN_ID, 2, PROGRESS);
      fake.emit(RUN_ID, 3, { kind: 'rate-limit-pause', retryAfterSeconds: 3 });
    });
    expect(tasks.result.current[0].detail).toContain('resuming in 3s');

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(tasks.result.current[0].detail).toContain('resuming in 1s');

    // The countdown floors at zero while the pull is still waiting.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(tasks.result.current[0].detail).toContain('resuming in 0s');

    act(() => {
      fake.emit(RUN_ID, 4, { ...PROGRESS, completedItems: 4 });
    });
    expect(tasks.result.current[0].detail).not.toContain('resuming');
    expect(tasks.result.current[0].detail).toContain('4/12 items');
  });

  it('routes the completion click-through to onViewReport with the summary', async () => {
    const fake = createBridgeFake(async () => fold(PLANNED));
    setHostBridge(fake.bridge);
    const onViewReport = vi.fn();
    renderHook(() => useMigrationPullTask({ onViewReport }));
    const tasks = renderHook(() => useBackgroundTasks());

    act(() => {
      fake.emit(RUN_ID, 1, PLANNED);
      fake.emit(RUN_ID, 2, { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 });
      fake.emit(RUN_ID, 3, { kind: 'importing' });
      fake.emit(RUN_ID, 4, IMPORTED);
    });
    tasks.result.current[0].onActivate?.();
    expect(onViewReport).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-landing', workspaceName: 'Imported from Postman' }),
    );
  });

  it('starts fresh when a new runId appears on the stream', async () => {
    const fake = createBridgeFake(async () => fold(PLANNED));
    setHostBridge(fake.bridge);
    renderHook(() => useMigrationPullTask());
    const tasks = renderHook(() => useBackgroundTasks());

    act(() => {
      fake.emit(RUN_ID, 1, PLANNED);
      fake.emit(RUN_ID, 2, { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 });
      fake.emit('run-2', 1, { kind: 'enumerating', step: 'workspace-list', completedCalls: 0 });
    });
    expect(tasks.result.current[0].detail).toContain('Finding workspaces');
  });

  it('mints no task on a host without the migration ladder', async () => {
    const fake = createBridgeFake(async () => {
      throw new Error('no handler');
    });
    setHostBridge(fake.bridge);
    renderHook(() => useMigrationPullTask());
    const tasks = renderHook(() => useBackgroundTasks());
    await act(async () => {});
    expect(tasks.result.current).toHaveLength(0);
  });
});

describe('BackgroundTasksIndicator click-through', () => {
  it('invokes onActivate from the inline title of a settled task', () => {
    const onActivate = vi.fn();
    const { getByText } = render(<BackgroundTasksIndicator />);
    act(() => {
      upsertBackgroundTask({
        id: 'migration-pull',
        title: 'Import finished — view report',
        percent: 100,
        onActivate,
      });
    });
    fireEvent.click(getByText('Import finished — view report'));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
