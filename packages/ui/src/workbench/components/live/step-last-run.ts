/**
 * What a step's Last run card says (the workflows redesign, Step panel):
 * the state in a word, one sentence, the figures the run holds, and for
 * a step that waits under a deadline how far into it the wait went. Pure.
 *
 * The figures come from the run the page keeps — its row for the step.
 * With none kept the card says what the cache row says and no more.
 */

import {
  type DraftStep,
  isExpectStep,
  isKnownStep,
  isListenStep,
  type WorkflowRunStepRow,
} from '@openheaders/core/live';
import type { MessageKey } from '@openheaders/i18n';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { formatBytes } from '../request-editor/response/response-format';
import { formatDurationRolled } from '../request-editor/response/response-meta';
import type { StepMark, StepMarkKind } from './step-mark';

/** A state in a word, as the card's head and its Status figure say it. */
const STATE_WORD: Record<StepMarkKind, MessageKey> = {
  idle: 'workbench.editors.live.lastRun.stateIdle',
  waiting: 'workbench.editors.live.run.row.waiting',
  running: 'workbench.editors.live.run.verdict.running',
  retrying: 'workbench.editors.live.lastRun.stateRetrying',
  held: 'workbench.editors.live.run.row.heldByRateLimit',
  open: 'workbench.editors.live.lastRun.stateOpen',
  passed: 'workbench.editors.live.run.verdict.passed',
  failed: 'workbench.editors.live.run.row.failed',
  'timed-out': 'workbench.editors.live.run.row.timedOut',
  skipped: 'workbench.editors.live.run.row.skipped',
  'not-run': 'workbench.editors.live.run.row.notRun',
  'cannot-run': 'workbench.editors.live.run.row.cannotRun',
};

export function stepStateWord(kind: StepMarkKind, t: Translate): string {
  return t(STATE_WORD[kind]);
}

export interface LastRunFigure {
  /** Names the figure for a test; never shown. */
  key: string;
  label: string;
  value: string;
}

export interface LastRunTiming {
  /** How much of the deadline went by, 0 to 1. */
  fraction: number;
  tone: 'met' | 'missed' | 'going';
  note: string;
  limit: string;
}

export interface StepLastRun {
  kind: StepMarkKind;
  word: string;
  sentence: string;
  figures: LastRunFigure[];
  timing?: LastRunTiming;
}

export interface StepLastRunInput {
  step: DraftStep;
  mark: StepMark;
  /** The step's row in the run the page keeps — absent where it keeps none. */
  row: WorkflowRunStepRow | undefined;
  /** The clock, for a wait that is still going. */
  now: number;
  /** The word on the button that runs the workflow. */
  runButton: string;
}

/** The deadline a step waits under: a listen's to be ready, an expect's for its message. */
function deadlineOf(step: DraftStep): number | undefined {
  return isKnownStep(step) && (isListenStep(step) || isExpectStep(step)) ? step.timeoutMs : undefined;
}

function sentenceOf({ mark, row, runButton }: StepLastRunInput, t: Translate): string {
  if (mark.detail !== undefined) return mark.detail;
  if (mark.kind === 'idle') return t('workbench.editors.live.lastRun.idle', { button: runButton });
  if (row === undefined) return mark.label;
  if (row.state === 'waiting') return t('workbench.editors.live.lastRun.waiting');
  if (row.state === 'running') return mark.text;
  switch (row.settlement.state) {
    case 'passed':
      return t('workbench.editors.live.lastRun.returned', { status: row.settlement.status });
    case 'ready':
      return t('workbench.editors.live.lastRun.ready');
    case 'sent':
      return t('workbench.editors.live.lastRun.sent');
    case 'matched':
      return t('workbench.editors.live.lastRun.matched');
    case 'not-run':
      return t('workbench.editors.live.lastRun.notRun');
    default:
      return mark.text;
  }
}

function figuresOf({ step, row }: StepLastRunInput, word: string, t: Translate): LastRunFigure[] {
  const figure = (key: string, label: MessageKey, value: string): LastRunFigure => ({ key, label: t(label), value });
  const status = figure('status', 'workbench.editors.live.lastRun.status', word);
  const limitMs = row?.state === 'running' && row.awaiting !== undefined ? row.awaiting.timeoutMs : deadlineOf(step);
  const limit =
    limitMs !== undefined
      ? [figure('limit', 'workbench.editors.live.lastRun.limit', formatDurationRolled(limitMs))]
      : [];
  const attempts = (attempt: number, max: number): LastRunFigure[] =>
    max > 1
      ? [
          figure(
            'attempts',
            'workbench.editors.live.lastRun.attempts',
            t('workbench.editors.live.lastRun.attemptOf', { attempt, max }),
          ),
        ]
      : [];
  const duration = (ms: number | undefined): LastRunFigure[] =>
    ms !== undefined ? [figure('duration', 'workbench.editors.live.lastRun.duration', formatDurationRolled(ms))] : [];

  if (row === undefined || row.state === 'waiting') return [status];
  if (row.state === 'running') return [status, ...attempts(row.attempt, row.maxAttempts), ...limit];
  const { settlement } = row;
  switch (settlement.state) {
    case 'passed':
      return [
        status,
        figure('response', 'workbench.editors.live.lastRun.response', String(settlement.status)),
        ...duration(settlement.durationMs),
        figure('size', 'workbench.editors.live.lastRun.size', formatBytes(settlement.responseBytes)),
        ...attempts(settlement.attempts, settlement.maxAttempts),
      ];
    case 'failed':
      return [
        status,
        ...(settlement.status !== undefined
          ? [figure('response', 'workbench.editors.live.lastRun.response', String(settlement.status))]
          : []),
        ...duration(settlement.durationMs),
        ...attempts(settlement.attempts, settlement.maxAttempts),
        ...limit,
      ];
    case 'ready':
      return [
        status,
        figure('ready-in', 'workbench.editors.live.lastRun.readyIn', formatDurationRolled(settlement.readyMs)),
        ...limit,
      ];
    case 'matched':
      return [
        status,
        figure(
          'matched-after',
          'workbench.editors.live.lastRun.matchedAfter',
          formatDurationRolled(settlement.afterMs),
        ),
        ...limit,
      ];
    case 'sent':
      return [
        status,
        ...(settlement.ackMs !== undefined
          ? [
              figure(
                'acknowledged-in',
                'workbench.editors.live.lastRun.acknowledgedIn',
                formatDurationRolled(settlement.ackMs),
              ),
            ]
          : []),
      ];
    default:
      return [status];
  }
}

function timingOf({ step, mark, row, now }: StepLastRunInput, t: Translate): LastRunTiming | undefined {
  if (row === undefined || row.state === 'waiting') return undefined;
  const limitOf = (ms: number) => t('workbench.editors.live.lastRun.limitOf', { duration: formatDurationRolled(ms) });
  if (row.state === 'running') {
    if (row.awaiting === undefined) return undefined;
    const { since, timeoutMs } = row.awaiting;
    return {
      fraction: Math.min(1, Math.max(0, (now - since) / timeoutMs)),
      tone: 'going',
      note: mark.text,
      limit: limitOf(timeoutMs),
    };
  }
  const deadline = deadlineOf(step);
  if (deadline === undefined) return undefined;
  const { settlement } = row;
  const met = (ms: number): LastRunTiming => ({
    fraction: Math.min(1, ms / deadline),
    tone: 'met',
    note: mark.text,
    limit: limitOf(deadline),
  });
  if (settlement.state === 'matched') return met(settlement.afterMs);
  if (settlement.state === 'ready') return met(settlement.readyMs);
  if (settlement.state === 'failed' && settlement.timedOut === true) {
    return { fraction: 1, tone: 'missed', note: mark.text, limit: limitOf(deadline) };
  }
  return undefined;
}

export function describeStepLastRun(input: StepLastRunInput, t: Translate): StepLastRun {
  const word = stepStateWord(input.mark.kind, t);
  const timing = timingOf(input, t);
  return {
    kind: input.mark.kind,
    word,
    sentence: sentenceOf(input, t),
    figures: figuresOf(input, word, t),
    ...(timing !== undefined ? { timing } : {}),
  };
}
