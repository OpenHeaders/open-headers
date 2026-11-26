/**
 * A step's mark on the workflow graph (the workflows redesign, Step
 * states): which glyph it wears and what its node's last line says.
 * While the page keeps a run the mark is that run's own row, in the
 * row's own words; with none kept it is what the cache row says of the
 * last run. Pure.
 *
 * The design draws eight states. The engine has four more, each with a
 * mark of its own: a step that never ran because an earlier one failed,
 * a step this host cannot run, a call held on the rate limit, and an
 * attempt after the first.
 */

import type { LiveWorkflowRunSnapshot } from '@openheaders/core/bridge';
import type { WorkflowRunStepRow } from '@openheaders/core/live';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { classifyStepRun, describeStepRun } from './live-display';
import { describeRunRow, type RunRowContext } from './run-display';

export type StepMarkKind =
  | 'idle'
  | 'waiting'
  | 'running'
  | 'retrying'
  | 'held'
  | 'open'
  | 'passed'
  | 'failed'
  | 'timed-out'
  | 'skipped'
  | 'not-run'
  | 'cannot-run';

export interface StepMark {
  kind: StepMarkKind;
  /** The node's last line — empty for a step no run has reached. */
  text: string;
  /** The glyph's name: the line, or what an empty line stands for. */
  label: string;
  /** The sentence behind the line — a failure's reason, a skip's, how a session opened. */
  detail?: string;
}

function kindOfRunRow(row: WorkflowRunStepRow, context: RunRowContext): StepMarkKind {
  if (row.state === 'waiting') return 'waiting';
  if (row.state === 'running') {
    if (row.held === true) return 'held';
    return row.attempt > 1 ? 'retrying' : 'running';
  }
  switch (row.settlement.state) {
    case 'ready':
      return context.session === 'open' ? 'open' : 'passed';
    case 'sent':
    case 'matched':
    case 'passed':
      return 'passed';
    case 'failed':
      return row.settlement.timedOut === true ? 'timed-out' : 'failed';
    case 'skipped':
      return 'skipped';
    case 'not-run':
      return 'not-run';
    case 'cannot-run':
      return 'cannot-run';
  }
}

export function markOfRunRow(row: WorkflowRunStepRow, t: Translate, context: RunRowContext = {}): StepMark {
  const display = describeRunRow(row, t, context);
  const text = display.facts.join(' · ');
  return {
    kind: kindOfRunRow(row, context),
    text,
    label: text,
    ...(display.sub !== undefined ? { detail: display.sub.text } : {}),
  };
}

/** `run` is the active environment's cache row — `null` or absent where the workflow has none. */
export function markOfCacheRow(
  run: LiveWorkflowRunSnapshot | null | undefined,
  stepId: string,
  t: Translate,
): StepMark {
  const state = classifyStepRun(run ?? null, stepId);
  if (state === 'not-run') return idleMark(t);
  const label = describeStepRun(state, t);
  const reason = run != null && run.lastErrorStepId === stepId ? run.lastErrorMessage : undefined;
  return {
    kind: state === 'completed' ? 'passed' : state === 'skipped' ? 'skipped' : 'failed',
    text: label,
    label,
    ...(reason !== undefined ? { detail: reason } : {}),
  };
}

/** A step no run has reached and no cache row speaks of. */
export function idleMark(t: Translate): StepMark {
  return { kind: 'idle', text: '', label: describeStepRun('not-run', t) };
}
