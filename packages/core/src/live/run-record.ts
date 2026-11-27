/**
 * The record a page keeps of one run of a workflow (the workflow runs
 * plan, The Run view): the run's steps as rows, built from its step
 * events alone — never from the run report, which marks the steps that
 * completed before a failure as skipped.
 */

import type { RunTrigger, SessionClose, StepAwaiting, StepSettlement, WorkflowRunFact } from './run-events';

export type WorkflowRunStepRow = { id: string; uid: string } & (
  | { state: 'waiting' }
  | { state: 'running'; attempt: number; maxAttempts: number; held?: true; awaiting?: StepAwaiting }
  | { state: 'settled'; settlement: StepSettlement; hasProduct: boolean }
);

export interface WorkflowRunRecord {
  runId: string;
  /** `null` = "No environment". */
  environmentId: string | null;
  startedAt: number;
  /** What started the run; absent where its first fact named nothing. */
  trigger?: RunTrigger;
  /** The run's steps in declared order. */
  steps: WorkflowRunStepRow[];
  /** `null` while the run is going. `sessions`: how each session it opened closed. */
  ended: { ok: boolean; durationMs: number; sessions?: SessionClose[] } | null;
}

/**
 * The record after one more fact. A `begin` opens a record in place of
 * whatever was kept; a fact of any other run than the kept one changes
 * nothing.
 */
export function applyRunFact(
  record: WorkflowRunRecord | null,
  run: { runId: string; environmentId: string | null },
  fact: WorkflowRunFact,
): WorkflowRunRecord | null {
  if (fact.type === 'begin') {
    return {
      runId: run.runId,
      environmentId: run.environmentId,
      startedAt: fact.at,
      ...(fact.trigger !== undefined ? { trigger: fact.trigger } : {}),
      steps: fact.steps.map(({ id, uid }) => ({ id, uid, state: 'waiting' })),
      ended: null,
    };
  }
  if (record === null || record.runId !== run.runId) return record;
  switch (fact.type) {
    case 'step-start':
      return withRow(record, fact.stepId, ({ id, uid }) => ({
        id,
        uid,
        state: 'running',
        attempt: 1,
        maxAttempts: fact.maxAttempts,
        ...(fact.awaiting !== undefined ? { awaiting: fact.awaiting } : {}),
      }));
    case 'attempt-end':
      return withRow(record, fact.stepId, ({ id, uid }) => ({
        id,
        uid,
        state: 'running',
        attempt: fact.attempt + 1,
        maxAttempts: fact.maxAttempts,
      }));
    case 'step-hold':
      return withRow(record, fact.stepId, (row) => {
        if (row.state !== 'running') return row;
        const { held: _held, ...running } = row;
        return fact.held ? { ...running, held: true } : running;
      });
    case 'step-settle':
      return withRow(record, fact.stepId, ({ id, uid }) => ({
        id,
        uid,
        state: 'settled',
        settlement: fact.settlement,
        hasProduct: fact.hasProduct,
      }));
    case 'end':
      return {
        ...record,
        ended: {
          ok: fact.ok,
          durationMs: fact.durationMs,
          ...(fact.sessions !== undefined ? { sessions: fact.sessions } : {}),
        },
      };
  }
}

function withRow(
  record: WorkflowRunRecord,
  stepId: string,
  next: (row: WorkflowRunStepRow) => WorkflowRunStepRow,
): WorkflowRunRecord {
  return { ...record, steps: record.steps.map((row) => (row.id === stepId ? next(row) : row)) };
}

export type WorkflowRunVerdict = 'running' | 'passed' | 'failed' | 'cannot-run';

/** The run's verdict: a step that cannot run outranks a failure — nothing was judged. */
export function runVerdict(record: WorkflowRunRecord): WorkflowRunVerdict {
  if (record.ended === null) return 'running';
  if (record.steps.some((row) => row.state === 'settled' && row.settlement.state === 'cannot-run')) return 'cannot-run';
  return record.ended.ok ? 'passed' : 'failed';
}

export interface WorkflowRunTotals {
  passed: number;
  failed: number;
  skipped: number;
  notRun: number;
  cannotRun: number;
}

export function runTotals(record: WorkflowRunRecord): WorkflowRunTotals {
  const count = (...states: StepSettlement['state'][]): number =>
    record.steps.filter((row) => row.state === 'settled' && states.includes(row.settlement.state)).length;
  return {
    passed: count('passed', 'ready', 'sent', 'matched'),
    failed: count('failed'),
    skipped: count('skipped'),
    notRun: count('not-run'),
    cannotRun: count('cannot-run'),
  };
}
