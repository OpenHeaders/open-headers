/**
 * Migration pull as a background-tasks tenant.
 *
 * Pins the surface contract over the S8 plumbing:
 *   - `deriveMigrationPullTask` maps every folded run phase to its
 *     corner entry (per-item progress, 429 pause countdown, monthly
 *     budget note, the "Import finished" flip with its "View report"
 *     action, failure states) and to nothing when idle;
 *   - `useMigrationPullTask` hydrates from `getState`, folds live
 *     `migrationPullEvent` broadcasts with the core reducer, prefers
 *     the live stream over a stale snapshot, ticks the pause countdown
 *     locally, and routes the action to `onViewReport`;
 *   - hosts without the migration ladder (the RPC rejects) never mint
 *     a task;
 *   - the indicator opens the Processes panel from the footer slot and
 *     renders a task's `action` as a button under its panel row.
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
  removeBackgroundTask,
  upsertBackgroundTask,
  useBackgroundTasks,
  useMigrationPullTask,
} from '@openheaders/ui/shared/background-tasks';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The stop confirm rides an antd Popconfirm; jsdom has no ResizeObserver.
beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

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
    workspaces: [
      {
        workspaceId: 'ws-landing',
        workspaceName: 'Imported from Postman',
        collections: 8,
        environments: 4,
        requests: 42,
        examples: 0,
        globals: 0,
        drops: 3,
      },
    ],
    collections: 8,
    environments: 4,
    requests: 42,
    examples: 0,
    globals: 0,
    drops: 3,
  },
};

interface BridgeFake {
  bridge: HostBridge;
  emit: (runId: string, seq: number, event: PostmanPullEvent) => void;
  calls: string[];
}

function createBridgeFake(getState: () => Promise<MigrationPullRunState>): BridgeFake {
  const listeners = new Set<(payload: unknown) => void>();
  const calls: string[] = [];
  const bridge: HostBridge = {
    async call(type, ..._args) {
      calls.push(String(type));
      if (type === 'oh.migration.postmanPull.getState') return (await getState()) as never;
      if (type === 'oh.migration.postmanPull.stop') return { stopped: true } as never;
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
    calls,
  };
}

beforeEach(() => {
  __resetBackgroundTasksForTests();
});

afterEach(() => {
  cleanup();
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
    expect(task?.detail).toBe('Pulled Users API');
    // The items count and the budget share one dot-separated footnote
    // line, with the hover hint naming Postman as the quota's source.
    // Grouping separator is locale-dependent — match around it.
    expect(task?.footnote?.text).toMatch(/^3\/12 items · 9.?876 API calls left this month$/);
    expect(task?.footnote?.hint).toContain('Postman');
    expect(task?.footnote?.hint).toContain('not an Open Headers limit');
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

  it('flips to "Import finished" with the summary counts and a View report action', () => {
    const state = fold(
      PLANNED,
      PROGRESS,
      { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 },
      { kind: 'importing' },
      IMPORTED,
    );
    const onViewReport = vi.fn();
    const task = deriveMigrationPullTask(state, null, onViewReport);
    expect(task?.title).toBe('Import finished');
    expect(task?.percent).toBe(100);
    // The summary counts render as aligned stat rows, not a sentence.
    expect(task?.stats).toEqual([
      { value: '1', label: 'workspace' },
      { value: '8', label: 'collections' },
      { value: '4', label: 'environments' },
      { value: '42', label: 'requests' },
    ]);
    expect(task?.detail).toContain('“Imported from Postman”');
    // The notes count moves next to the action button, out of the detail line.
    expect(task?.detail).not.toContain('import notes');
    expect(task?.action?.label).toBe('View report');
    expect(task?.action?.note).toBe('3 import notes');
    task?.action?.run();
    expect(onViewReport).toHaveBeenCalledTimes(1);
  });

  it('keeps the notes count in the detail line when no report click-through exists', () => {
    const state = fold(
      PLANNED,
      PROGRESS,
      { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 },
      { kind: 'importing' },
      IMPORTED,
    );
    const task = deriveMigrationPullTask(state, null);
    expect(task?.action).toBeUndefined();
    expect(task?.detail).toContain('3 import notes');
  });

  it('drops the detail line when several workspaces land — the stat grid counts them', () => {
    const twoWorkspaces = {
      ...IMPORTED,
      summary: {
        ...IMPORTED.summary,
        drops: 0,
        workspaces: [
          { ...IMPORTED.summary.workspaces[0], drops: 0 },
          {
            ...IMPORTED.summary.workspaces[0],
            workspaceId: 'ws-2',
            workspaceName: 'Imported from Postman 2',
            drops: 0,
          },
        ],
      },
    } satisfies PostmanPullEvent;
    const state = fold(
      PLANNED,
      PROGRESS,
      { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 },
      { kind: 'importing' },
      twoWorkspaces,
    );
    const task = deriveMigrationPullTask(state, null, vi.fn());
    expect(task?.detail).toBeUndefined();
    expect(task?.stats?.[0]).toEqual({ value: '2', label: 'workspaces' });
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
    expect(deriveMigrationPullTask(state, null)?.detail).toContain('Partial import');
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

  it('mints per-run task ids so a dismissed entry never hides a later run', () => {
    const first = deriveMigrationPullTask(startPullRunState('run-a'), null);
    const second = deriveMigrationPullTask(startPullRunState('run-b'), null);
    expect(first?.id).toBeTruthy();
    expect(first?.id).not.toBe(second?.id);
  });

  it('offers the stop affordance while the pull can still be canceled — and only then', () => {
    const onCancel = vi.fn();
    const enumerating = deriveMigrationPullTask(startPullRunState(RUN_ID), null, undefined, onCancel);
    expect(enumerating?.cancel?.confirm).toContain('Stop the Postman import?');
    const pulling = deriveMigrationPullTask(fold(PLANNED, PROGRESS), null, undefined, onCancel);
    expect(pulling?.cancel).toBeTruthy();
    const paused = deriveMigrationPullTask(
      fold(PLANNED, PROGRESS, { kind: 'rate-limit-pause', retryAfterSeconds: 7 }),
      null,
      undefined,
      onCancel,
    );
    expect(paused?.cancel).toBeTruthy();
    pulling?.cancel?.run();
    expect(onCancel).toHaveBeenCalledTimes(1);

    // Materialization can't be stopped — the data is already local.
    const importing = deriveMigrationPullTask(
      fold(
        PLANNED,
        { kind: 'finished', outcome: 'complete', collections: 8, environments: 4, skipped: 0 },
        {
          kind: 'importing',
        },
      ),
      null,
      undefined,
      onCancel,
    );
    expect(importing?.cancel).toBeUndefined();
    const done = deriveMigrationPullTask(
      fold(PLANNED, { kind: 'finished', outcome: 'complete', collections: 0, environments: 0, skipped: 0 }),
      null,
      undefined,
      onCancel,
    );
    expect(done?.cancel).toBeUndefined();
  });

  it('surfaces a canceled run as a settled stop, not a failure', () => {
    const state = fold({
      kind: 'finished',
      outcome: 'canceled',
      stopReason: 'You stopped the import — nothing was imported.',
      collections: 0,
      environments: 0,
      skipped: 0,
    });
    const task = deriveMigrationPullTask(state, null);
    expect(task?.title).toBe('Postman import stopped');
    expect(task?.detail).toContain('nothing was imported');
    expect(task?.error).toBeUndefined();
    expect(task?.done).toBe(true);
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
    expect(tasks.result.current[0].title).toBe('Import finished');

    // …so the older mid-run snapshot must not regress the entry.
    await act(async () => {
      resolveSnapshot(fold(PLANNED, PROGRESS));
      await snapshot;
    });
    expect(tasks.result.current[0].title).toBe('Import finished');
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

  it('routes the completion action to onViewReport with the summary', async () => {
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
    tasks.result.current[0].action?.run();
    expect(onViewReport).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaces: [expect.objectContaining({ workspaceId: 'ws-landing', workspaceName: 'Imported from Postman' })],
      }),
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
    // The previous run's entry is removed with its id — one task, the new run's.
    expect(tasks.result.current).toHaveLength(1);
    expect(tasks.result.current[0].detail).toContain('Finding workspaces');
  });

  it('routes the stop affordance to the host stop RPC', async () => {
    const fake = createBridgeFake(async () => fold(PLANNED));
    setHostBridge(fake.bridge);
    renderHook(() => useMigrationPullTask());
    const tasks = renderHook(() => useBackgroundTasks());

    act(() => {
      fake.emit(RUN_ID, 1, PLANNED);
      fake.emit(RUN_ID, 2, PROGRESS);
    });
    expect(tasks.result.current[0].cancel).toBeTruthy();
    await act(async () => {
      tasks.result.current[0].cancel?.run();
    });
    expect(fake.calls).toContain('oh.migration.postmanPull.stop');
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

describe('BackgroundTasksIndicator', () => {
  it('opens the Processes panel from the footer title and runs the action button', () => {
    const run = vi.fn();
    const { getByText, getByRole, queryByRole } = render(<BackgroundTasksIndicator />);
    act(() => {
      upsertBackgroundTask({
        id: 'migration-pull',
        title: 'Import finished',
        percent: 100,
        done: true,
        action: { label: 'View report', note: '3 import notes', run },
      });
    });
    expect(queryByRole('dialog', { name: 'Processes' })).toBeNull();

    // The whole footer slot — title included — toggles the panel; the
    // title is no longer its own click-through.
    fireEvent.click(getByText('Import finished'));
    expect(getByRole('dialog', { name: 'Processes' })).toBeTruthy();
    expect(run).not.toHaveBeenCalled();

    // The follow-up renders as a button under the row, with its note.
    expect(getByText('3 import notes')).toBeTruthy();
    fireEvent.click(getByText('View report'));
    expect(run).toHaveBeenCalledTimes(1);

    // While the panel is up, the footer slot reads as the dismiss
    // affordance with the visible-task count; clicking it closes.
    fireEvent.click(getByText('Hide processes (1)'));
    expect(queryByRole('dialog', { name: 'Processes' })).toBeNull();
  });

  it('a dismissed entry stays hidden only for its own run — a new run shows again', () => {
    const { getByText, getByLabelText, queryByText } = render(<BackgroundTasksIndicator />);
    act(() => {
      upsertBackgroundTask({ id: 'migration-pull:run-a', title: 'Postman import failed', percent: 100, error: true });
    });
    fireEvent.click(getByLabelText('Hide background task'));
    expect(queryByText('Postman import failed')).toBeNull();

    // The next run mints a new id; its entry must be visible even
    // though the previous one was dismissed.
    act(() => {
      removeBackgroundTask('migration-pull:run-a');
      upsertBackgroundTask({ id: 'migration-pull:run-b', title: 'Migrating from Postman', percent: 10 });
    });
    expect(getByText('Migrating from Postman')).toBeTruthy();
  });

  it('a cancelable task’s ✕ confirms, then stops the work instead of hiding the entry', async () => {
    const stop = vi.fn();
    const { getByText, getByLabelText, findByText } = render(<BackgroundTasksIndicator />);
    act(() => {
      upsertBackgroundTask({
        id: 'migration-pull:run-a',
        title: 'Migrating from Postman',
        percent: 25,
        cancel: { confirm: 'Stop the Postman import?', run: stop },
      });
    });

    fireEvent.click(getByLabelText('Stop background task'));
    // The confirm renders with the producer's prompt; nothing hidden yet.
    await findByText('Stop the Postman import?');
    expect(getByText('Migrating from Postman')).toBeTruthy();
    expect(stop).not.toHaveBeenCalled();

    fireEvent.click(getByText('Stop'));
    expect(stop).toHaveBeenCalledTimes(1);
    // The entry stays — the terminal state arrives from the producer.
    expect(getByText('Migrating from Postman')).toBeTruthy();
  });
});
