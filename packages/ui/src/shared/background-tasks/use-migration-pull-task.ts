/**
 * useMigrationPullTask — the migration pull run as a background-tasks
 * tenant. Hydrates from `oh.migration.postmanPull.getState`, then folds
 * every `migrationPullEvent` with the core `foldPullEvent` reducer (the
 * ONE derivation of run state — never a parallel reducer here) and
 * mirrors the folded state into the store: per-item progress while
 * pulling, a live 429 pause countdown, the remaining monthly API
 * budget, a stop affordance while the pull phase can still be canceled
 * (wired to `oh.migration.postmanPull.stop`), and the "Import finished"
 * flip whose "View report" action button the host supplies via
 * `onViewReport`. Task ids are per run so a dismissed entry never
 * hides a later run's progress.
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
import {
  type BackgroundTask,
  type BackgroundTaskFootnote,
  type BackgroundTaskStat,
  removeBackgroundTask,
  upsertBackgroundTask,
} from './store';

/**
 * Task identity is PER RUN — the ✕ dismissal is remembered by id, so a
 * constant id would keep every later run's progress hidden once one
 * entry was dismissed. A new run minting a new id starts visible; the
 * hook removes the previous run's entry when the id changes.
 */
function migrationPullTaskId(runId: string): string {
  return `migration-pull:${runId}`;
}

/** Confirmation the ✕ shows while the pull can still be stopped. */
const STOP_CONFIRM = 'Stop the Postman import? Nothing has been imported yet — items already pulled are discarded.';

/**
 * Pure task derivation from the folded run state. `pauseSecondsLeft` is
 * the hook's live countdown (the folded `pause.retryAfterSeconds` is
 * the pause's initial value, not a ticking clock). `onCancel` is the
 * host stop RPC — attached while the pull phase can still be stopped
 * (materialization can't be: the data is already local and the landing
 * finishes). Returns null when there is nothing to show.
 */
export function deriveMigrationPullTask(
  state: MigrationPullRunState,
  pauseSecondsLeft: number | null,
  onViewReport?: () => void,
  onCancel?: () => void,
): BackgroundTask | null {
  if (state.runId === null || state.phase === 'idle') return null;
  const TASK_ID = migrationPullTaskId(state.runId);
  const cancelable = onCancel ? { cancel: { confirm: STOP_CONFIRM, run: onCancel } } : {};

  const footnote: BackgroundTaskFootnote | undefined =
    state.budget.remainingMonth !== undefined
      ? {
          text: `${state.budget.remainingMonth.toLocaleString()} API calls left this month`,
          hint:
            'Postman meters its own API — this is your Postman account’s remaining monthly quota, ' +
            'not an Open Headers limit. The import paces itself to stay within it.',
        }
      : undefined;
  const budgetNote = footnote ? { footnote } : {};

  switch (state.phase) {
    case 'enumerating':
      return {
        id: TASK_ID,
        title: 'Migrating from Postman',
        detail: 'Finding workspaces, collections, and environments…',
        percent: null,
        ...budgetNote,
        ...cancelable,
      };
    case 'pulling': {
      if (state.pause) {
        const seconds = pauseSecondsLeft ?? state.pause.retryAfterSeconds;
        return {
          id: TASK_ID,
          title: 'Migrating from Postman',
          detail: `Rate limited — resuming in ${seconds}s`,
          percent: state.totalItems > 0 ? Math.round((state.completedItems / state.totalItems) * 100) : null,
          ...budgetNote,
          ...cancelable,
        };
      }
      const last = state.lastItem;
      const itemLine = last ? `${last.status === 'pulled' ? 'Pulled' : 'Skipped'} ${last.name ?? last.id}` : '';
      const itemsText = `${state.completedItems}/${state.totalItems} items`;
      const percent = state.totalItems > 0 ? Math.round((state.completedItems / state.totalItems) * 100) : null;
      // With a known budget the items count and the quota share one
      // dot-separated footnote line; otherwise the count stays in the
      // detail.
      if (footnote) {
        return {
          id: TASK_ID,
          title: 'Migrating from Postman',
          ...(itemLine ? { detail: itemLine } : {}),
          footnote: { ...footnote, text: `${itemsText} · ${footnote.text}` },
          percent,
          ...cancelable,
        };
      }
      return {
        id: TASK_ID,
        title: 'Migrating from Postman',
        detail: itemLine ? `${itemLine}\n${itemsText}` : itemsText,
        percent,
        ...cancelable,
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
        const stat = (count: number, singular: string, plural: string): BackgroundTaskStat => ({
          value: count.toLocaleString(),
          label: count === 1 ? singular : plural,
        });
        const stats: BackgroundTaskStat[] = [
          stat(s.workspaces.length, 'workspace', 'workspaces'),
          stat(s.collections, 'collection', 'collections'),
          stat(s.environments, 'environment', 'environments'),
          stat(s.requests, 'request', 'requests'),
        ];
        if (s.examples > 0) stats.push(stat(s.examples, 'saved example', 'saved examples'));
        if (s.globals > 0) stats.push(stat(s.globals, 'global variable', 'global variables'));
        // The stat grid already counts the workspaces — the detail line
        // only carries what the grid can't: the single-workspace landing
        // name, the partial marker, and the notes count when there is no
        // report click-through.
        const only = s.workspaces.length === 1 ? s.workspaces[0] : undefined;
        const notes = s.drops > 0 ? `${s.drops} import notes` : undefined;
        const detailParts: string[] = [];
        if (state.outcome === 'partial')
          detailParts.push(only ? `Partial import into “${only.workspaceName}”` : 'Partial import');
        else if (only) detailParts.push(`Imported into “${only.workspaceName}”`);
        if (!onViewReport && notes) detailParts.push(notes);
        return {
          id: TASK_ID,
          title: 'Import finished',
          ...(detailParts.length > 0 ? { detail: detailParts.join(' · ') } : {}),
          stats,
          percent: 100,
          done: true,
          ...(onViewReport
            ? { action: { label: 'View report', ...(notes ? { note: notes } : {}), run: onViewReport } }
            : {}),
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
      if (state.outcome === 'canceled') {
        return {
          id: TASK_ID,
          title: 'Postman import stopped',
          detail: state.stopReason ?? 'You stopped the import — nothing was imported.',
          percent: 100,
          done: true,
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
        done: true,
      };
    }
  }
}

export interface MigrationPullTaskOptions {
  /** "View report" action for the completion flip — landing workspace + report. */
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
    /** The id last upserted — removed when a new run mints a new one. */
    let taskId: string | null = null;

    // One stable closure per effect run — the store compares
    // `action.run` / `cancel.run` by identity on upsert.
    const activate = (): void => {
      const summary = state?.imported;
      if (summary) onViewReportRef.current?.(summary);
    };
    const requestStop = (): void => {
      // The stopped state arrives like any other run end — a
      // `finished` event with the `canceled` outcome. A host with
      // nothing stoppable answers `stopped: false` and nothing changes.
      void bridge.call('oh.migration.postmanPull.stop').catch(() => {});
    };

    const apply = (): void => {
      if (!state) return;
      const task = deriveMigrationPullTask(state, pauseSecondsLeft, activate, requestStop);
      if (task) {
        if (taskId !== null && taskId !== task.id) removeBackgroundTask(taskId);
        upsertBackgroundTask(task);
        taskId = task.id;
      } else if (taskId !== null) {
        removeBackgroundTask(taskId);
        taskId = null;
      }
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
