/**
 * Step events of a workflow run (the workflow runs plan, The Run view).
 *
 * What ran, in order, as the run goes: `begin`, then per step a
 * `step-start`, an `attempt-end` for each attempt another one follows,
 * and one `step-settle`; `end` closes the run on every path. Every step
 * settles exactly once — a skipped step and a step that never ran settle
 * without starting.
 *
 * Events are additive: the run's outcome, its report and what the cache
 * is handed are the same with or without a listener.
 */

import type { ExecutedRequestSnapshot } from '../types';
import type { LiveWorkflow } from '../types/live';
import { isUnknownStep, unknownStepMessage } from './unknown-step';

/** What a step produced, for whoever opens it — a call's is its exchange. */
export type StepProduct = { kind: 'response'; snapshot: ExecutedRequestSnapshot };

/** Why an attempt is followed by another. */
export type AttemptRetryCause = { kind: 'error'; message: string } | { kind: 'status'; status: number };

/** How a step ended. Capture names only — a value never rides an event. */
export type StepSettlement =
  | {
      state: 'passed';
      status: number;
      /** The executor's own figure for the exchange, when the adapter has one. */
      durationMs?: number;
      responseBytes: number;
      attempts: number;
      maxAttempts: number;
      captureNames: string[];
    }
  | {
      state: 'failed';
      phase: 'fetch' | 'extract' | 'graph';
      /** One sentence that states the condition. */
      reason: string;
      attempts: number;
      maxAttempts: number;
      /** Present when a response head arrived before the failure. */
      status?: number;
      durationMs?: number;
    }
  /** Its run condition was not met. */
  | { state: 'skipped' }
  /** An earlier step failed, or the run was refused before it. */
  | { state: 'not-run' }
  /** This build cannot run the step — an error, never a skip, never a failed test. */
  | { state: 'cannot-run'; reason: string };

interface StepSettleEvent {
  type: 'step-settle';
  at: number;
  stepId: string;
  settlement: StepSettlement;
  product?: StepProduct;
}

export type WorkflowRunEvent =
  | { type: 'begin'; at: number; steps: Array<{ id: string; uid: string }> }
  | { type: 'step-start'; at: number; stepId: string; maxAttempts: number }
  | {
      type: 'attempt-end';
      at: number;
      stepId: string;
      attempt: number;
      maxAttempts: number;
      cause: AttemptRetryCause;
      /** The wait before the next attempt starts. */
      retryInMs: number;
    }
  | StepSettleEvent
  | { type: 'end'; at: number; ok: boolean; durationMs: number };

/**
 * An event as it crosses to a page: the same facts, the product left
 * with whoever ran the step and named by `hasProduct` alone — a body
 * travels on a call's answer, never on a broadcast.
 */
export type WorkflowRunFact =
  | Exclude<WorkflowRunEvent, StepSettleEvent>
  | (Omit<StepSettleEvent, 'product'> & { hasProduct: boolean });

export function runFactOf(event: WorkflowRunEvent): WorkflowRunFact {
  if (event.type !== 'step-settle') return event;
  const { product, ...facts } = event;
  return { ...facts, hasProduct: product !== undefined };
}

/**
 * The events of a run refused before its first step for a step this
 * build does not know: each such step cannot run, by its sentence; no
 * other step ran.
 */
export function refusedRunEvents(workflow: LiveWorkflow, at: number): WorkflowRunEvent[] {
  return [
    { type: 'begin', at, steps: workflow.steps.map(({ id, uid }) => ({ id, uid })) },
    ...workflow.steps.map(
      (step): WorkflowRunEvent => ({
        type: 'step-settle',
        at,
        stepId: step.id,
        settlement: isUnknownStep(step)
          ? { state: 'cannot-run', reason: unknownStepMessage(step) }
          : { state: 'not-run' },
      }),
    ),
    { type: 'end', at, ok: false, durationMs: 0 },
  ];
}
