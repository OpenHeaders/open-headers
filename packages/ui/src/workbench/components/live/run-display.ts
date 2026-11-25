/**
 * Display helpers for the workflow Run view (the workflow runs plan,
 * The Run view — the row vocabulary). Pure: a row's facts and its one
 * sentence derive here from the run record alone.
 */

import type { WorkflowRunStepRow, WorkflowRunVerdict } from '@openheaders/core/live';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { formatDurationRolled } from '../request-editor/response/response-meta';

export type RunRowTone = 'waiting' | 'running' | 'passed' | 'failed' | 'skipped' | 'not-run' | 'cannot-run';

export interface RunRowDisplay {
  tone: RunRowTone;
  /** Short facts, shown joined on the row's right. */
  facts: string[];
  /** The line under the row — a failure's sentence, a skip's reason. */
  sub?: { text: string; tone: 'secondary' | 'danger' | 'warning' };
}

export function describeRunRow(row: WorkflowRunStepRow, t: Translate): RunRowDisplay {
  if (row.state === 'waiting') return { tone: 'waiting', facts: [t('workbench.editors.live.run.row.waiting')] };
  if (row.state === 'running') {
    return {
      tone: 'running',
      facts: [
        t('workbench.editors.live.run.row.sending'),
        ...(row.maxAttempts > 1
          ? [t('workbench.editors.live.run.row.attempt', { attempt: row.attempt, max: row.maxAttempts })]
          : []),
      ],
    };
  }
  const { settlement } = row;
  switch (settlement.state) {
    case 'passed':
      return {
        tone: 'passed',
        facts: [
          String(settlement.status),
          ...(settlement.durationMs !== undefined ? [formatDurationRolled(settlement.durationMs)] : []),
          ...(settlement.captureNames.length > 0
            ? [t('workbench.editors.live.run.row.captures', { count: settlement.captureNames.length })]
            : []),
          ...(settlement.attempts > 1
            ? [
                t('workbench.editors.live.run.row.passedOnAttempt', {
                  attempt: settlement.attempts,
                  max: settlement.maxAttempts,
                }),
              ]
            : []),
        ],
      };
    case 'failed': {
      const facts = [
        ...(settlement.status !== undefined ? [String(settlement.status)] : []),
        ...(settlement.durationMs !== undefined ? [formatDurationRolled(settlement.durationMs)] : []),
      ];
      return {
        tone: 'failed',
        facts: facts.length > 0 ? facts : [t('workbench.editors.live.run.row.failed')],
        sub: { text: settlement.reason, tone: 'danger' },
      };
    }
    case 'skipped':
      return {
        tone: 'skipped',
        facts: [t('workbench.editors.live.run.row.skipped')],
        sub: { text: t('workbench.editors.live.run.row.skippedReason'), tone: 'secondary' },
      };
    case 'not-run':
      return { tone: 'not-run', facts: [t('workbench.editors.live.run.row.notRun')] };
    case 'cannot-run':
      return {
        tone: 'cannot-run',
        facts: [t('workbench.editors.live.run.row.cannotRun')],
        sub: { text: settlement.reason, tone: 'warning' },
      };
  }
}

export function describeRunVerdict(verdict: WorkflowRunVerdict, t: Translate): string {
  switch (verdict) {
    case 'running':
      return t('workbench.editors.live.run.verdict.running');
    case 'passed':
      return t('workbench.editors.live.run.verdict.passed');
    case 'failed':
      return t('workbench.editors.live.run.verdict.failed');
    case 'cannot-run':
      return t('workbench.editors.live.run.verdict.cannotRun');
  }
}

/** The step a view opens on when none was picked: where the run stopped, else nothing. */
export function defaultRunSelection(rows: readonly WorkflowRunStepRow[]): string | null {
  const stopped = rows.find(
    (row) => row.state === 'settled' && (row.settlement.state === 'failed' || row.settlement.state === 'cannot-run'),
  );
  return stopped?.id ?? null;
}
