/**
 * Step events of a workflow run (the workflow runs plan, The Run view).
 *
 * What ran, in order, as the run goes: `begin`, then per step a
 * `step-start`, an `attempt-end` for each attempt another one follows,
 * and one `step-settle`; `end` closes the run on every path. Every step
 * settles exactly once — a skipped step and a step that never ran settle
 * without starting. A `listen` settles when its session is ready; how
 * that session closed rides `end`.
 *
 * Events are additive: the run's outcome, its report and what the cache
 * is handed are the same with or without a listener.
 */

import type { ExecutedRequestSnapshot } from '../types';
import type { LiveWorkflow } from '../types/live';
import type { SessionMessage } from './session-port';
import { isUnknownStep, unknownStepMessage } from './unknown-step';

/** A message an `expect` held in its window, and what became of it. */
export interface WindowEntry {
  message: SessionMessage;
  /** `stored`: passed over as stored, not live. */
  outcome: 'matched' | 'not-matched' | 'stored';
}

/**
 * What a step produced, for whoever opens it. A call's is its exchange.
 * A `send`'s is the message as sent, with the reply where the kind
 * answers a send; an `expect`'s is the message it matched — `null` when
 * none did — and what its window held.
 */
export type StepProduct =
  | { kind: 'response'; snapshot: ExecutedRequestSnapshot }
  | { kind: 'message'; message: SessionMessage | null; reply?: SessionMessage; window?: WindowEntry[] };

/** Why an attempt is followed by another. */
export type AttemptRetryCause =
  | { kind: 'error'; message: string }
  | { kind: 'status'; status: number }
  /** A poll: the response came and a success criterion did not hold. */
  | { kind: 'criteria'; message: string };

/** Which part of a step broke: of a call, or the session action itself. */
export type StepFailurePhase = 'fetch' | 'extract' | 'graph' | 'criteria' | 'listen' | 'send' | 'expect';

/** How a session closed when its run ended. */
export interface SessionClose {
  /** The `listen` step that opened it. */
  stepId: string;
  /** How long it was open, from ready to closed. */
  openForMs: number;
  /** What did not go cleanly. A warning never changes a verdict. */
  warning?: string;
}

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
  /** A `listen`: its session is ready to receive. */
  | { state: 'ready'; readyMs: number; captureNames: string[] }
  /** A `send`: the message has left, acknowledged where the kind acknowledges. */
  | { state: 'sent'; ackMs?: number; captureNames: string[] }
  /** An `expect`: a message matched, `afterMs` from its trigger's start. */
  | { state: 'matched'; afterMs: number; captureNames: string[] }
  | {
      state: 'failed';
      phase: StepFailurePhase;
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
  | {
      type: 'end';
      at: number;
      ok: boolean;
      durationMs: number;
      /** Present only for a run that opened a session: each one's close, last opened first. */
      sessions?: SessionClose[];
    };

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
