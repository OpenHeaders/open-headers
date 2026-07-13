/**
 * useMigrationPullTask — the migration pull run as a background-tasks
 * tenant. Hydrates from `oh.migration.postmanPull.getState`, then folds
 * every `migrationPullEvent` with the core `foldPullEvent` reducer (the
 * ONE derivation of run state — never a parallel reducer here) and
 * mirrors the folded state into the store: per-item progress while
 * pulling, a live 429 pause countdown, the remaining monthly API
 * budget, and the "Import finished — view report" flip whose
 * click-through the host supplies via `onViewReport`.
 *
 * No-op on hosts without the migration ladder (the hydration RPC
 * rejects and no `migrationPullEvent` ever arrives).
 */

import { getHostBridge } from '@openheaders/core/bridge';
import {
  foldPullEvent,
  type MigrationPullRunState,
  type PostmanImportSummary,
  startPullRunState,
} from '@openheaders/core/import';
import { useEffect, useRef } from 'react';
import { type BackgroundTask, removeBackgroundTask, upsertBackgroundTask } from './store';

const TASK_ID = 'migration-pull';

/**
 * Pure task derivation from the folded run state. `pauseSecondsLeft` is
 * the hook's live countdown (the folded `pause.retryAfterSeconds` is
 * the pause's initial value, not a ticking clock). Returns null when
 * there is nothing to show.
 */
export function deriveMigrationPullTask(
  state: MigrationPullRunState,
  pauseSecondsLeft: number | null,
  onViewReport?: () => void,
): BackgroundTask | null {
  if (state.runId === null || state.phase === 'idle') return null;

  const budgetNote =
    state.budget.remainingMonth !== undefined
      ? ` · ${state.budget.remainingMonth.toLocaleString()} API calls left this month`
      : '';

  switch (state.phase) {
    case 'enumerating':
      return {
        id: TASK_ID,
        title: 'Migrating from Postman',
        detail: `Finding workspaces, collections, and environments…${budgetNote}`,
        percent: null,
      };
    case 'pulling': {
      if (state.pause) {
        const seconds = pauseSecondsLeft ?? state.pause.retryAfterSeconds;
        return {
          id: TASK_ID,
          title: 'Migrating from Postman',
          detail: `Rate limited — resuming in ${seconds}s${budgetNote}`,
          percent: state.totalItems > 0 ? Math.round((state.completedItems / state.totalItems) * 100) : null,
        };
      }
      const last = state.lastItem;
      const itemNote = last ? `${last.status === 'pulled' ? 'Pulled' : 'Skipped'} ${last.name ?? last.id} · ` : '';
      return {
        id: TASK_ID,
        title: 'Migrating from Postman',
        detail: `${itemNote}${state.completedItems}/${state.totalItems} items${budgetNote}`,
        percent: state.totalItems > 0 ? Math.round((state.completedItems / state.totalItems) * 100) : null,
      };
    }
    case 'importing':
      return {
        id: TASK_ID,
        title: 'Migrating from Postman',
        detail: 'Importing into Open Headers…',
        percent: null,
      };
    case 'done': {
      if (state.imported) {
        const s = state.imported;
        const counts = `${s.collections} collections, ${s.environments} environments, ${s.requests} requests`;
        const notes = s.drops > 0 ? ` · ${s.drops} import notes` : '';
        const partial = state.outcome === 'partial' ? 'Partial import: ' : '';
        return {
          id: TASK_ID,
          title: 'Import finished — view report',
          detail: `${partial}${counts} into “${s.workspaceName}”${notes}`,
          percent: 100,
          ...(onViewReport ? { onActivate: onViewReport } : {}),
        };
      }
      if (state.importError) {
        return {
          id: TASK_ID,
          title: 'Postman import failed',
          detail: state.importError,
          percent: 100,
          error: true,
        };
      }
      if (state.outcome === 'failed') {
        return {
          id: TASK_ID,
          title: 'Postman migration failed',
          detail: state.stopReason ?? 'The pull could not start.',
          percent: 100,
          error: true,
        };
      }
      // Finished without a materialization tail — nothing was pulled.
      return {
        id: TASK_ID,
        title: 'Postman migration finished',
        detail: state.stopReason ?? 'No collections or environments to import.',
        percent: 100,
      };
    }
  }
}

export interface MigrationPullTaskOptions {
  /** Click-through for the completion flip — landing workspace + report. */
  onViewReport?: (summary: PostmanImportSummary) => void;
}

export function useMigrationPullTask(options?: MigrationPullTaskOptions): void {
  const onViewReportRef = useRef(options?.onViewReport);
  onViewReportRef.current = options?.onViewReport;

  useEffect(() => {
    const bridge = getHostBridge();
    if (!bridge) return;

    let cancelled = false;
    let state: MigrationPullRunState | null = null;
    let pauseSecondsLeft: number | null = null;
    let ticker: ReturnType<typeof setInterval> | null = null;

    // One stable closure per effect run — the store compares
    // `onActivate` by identity on upsert.
    const activate = (): void => {
      const summary = state?.imported;
      if (summary) onViewReportRef.current?.(summary);
    };

    const apply = (): void => {
      if (!state) return;
      const task = deriveMigrationPullTask(state, pauseSecondsLeft, activate);
      if (task) upsertBackgroundTask(task);
      else removeBackgroundTask(TASK_ID);
      syncTicker();
    };

    // The pause countdown ticks locally — the host only broadcasts the
    // pause once, with its initial RetryAfter seconds.
    function syncTicker(): void {
      const paused = state?.pause != null;
      if (paused && ticker === null) {
        ticker = setInterval(() => {
          if (pauseSecondsLeft !== null && pauseSecondsLeft > 0) pauseSecondsLeft -= 1;
          apply();
        }, 1000);
      } else if (!paused && ticker !== null) {
        clearInterval(ticker);
        ticker = null;
      }
    }

    const unsubscribe = bridge.subscribe('migrationPullEvent', ({ runId, event }) => {
      if (cancelled) return;
      if (!state || state.runId !== runId) state = startPullRunState(runId);
      const prevPause = state.pause;
      state = foldPullEvent(state, event);
      if (!state.pause) pauseSecondsLeft = null;
      else if (state.pause !== prevPause) pauseSecondsLeft = state.pause.retryAfterSeconds;
      apply();
    });

    void bridge
      .call('oh.migration.postmanPull.getState')
      .then((snapshot) => {
        // Events already flowing win — folding a snapshot older than a
        // folded event could regress a terminal state.
        if (cancelled || state !== null || snapshot.runId === null) return;
        state = snapshot;
        pauseSecondsLeft = snapshot.pause?.retryAfterSeconds ?? null;
        apply();
      })
      .catch(() => {
        // Host without the migration ladder — nothing to track.
      });

    return () => {
      cancelled = true;
      if (ticker !== null) clearInterval(ticker);
      unsubscribe();
    };
  }, []);
}
