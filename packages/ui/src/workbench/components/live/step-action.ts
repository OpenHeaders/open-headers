/**
 * A step's action in the workflow form (the workflow runs plan,
 * Decisions log, S16): the card's type selector is the action — a call,
 * or `listen`, `send` and `expect` on a session.
 *
 * Changing the action keeps the step's id, description, dependencies and
 * run condition, and drops the rest. The defaults carry the arming: a
 * send or an expect is on the nearest listen above it, and an expect
 * waits after the step before it. The first session step of a workflow
 * makes it a verdict: its refresh is manual, and a capture no live
 * variable is bound to yet is no longer exposed.
 */

import {
  type DraftKnownStep,
  type DraftStep,
  type DraftWorkflow,
  isCallStep,
  isKnownStep,
  isListenStep,
  isSessionStep,
} from '@openheaders/core/live';
import type { ListenWorkflowStep, MqttRequest, SessionWorkflowStep } from '@openheaders/core/types';

export type StepAction = 'call' | SessionWorkflowStep['action'];

/** The actions in the order the selector lists them. */
export const STEP_ACTIONS: readonly StepAction[] = ['call', 'listen', 'send', 'expect'];

/** What a new `listen` waits to be ready, and a new `expect` for its message — the session's own number. */
export const DEFAULT_SESSION_TIMEOUT_MS = 10_000;

export function stepActionOf(step: DraftKnownStep): StepAction {
  return isSessionStep(step) ? step.action : 'call';
}

/** The `listen` step a session step names, when it names one. */
export function listenStepOf(steps: readonly DraftStep[], listenId: string): ListenWorkflowStep | undefined {
  const step = steps.find((each) => each.id === listenId);
  return step !== undefined && isListenStep(step) ? step : undefined;
}

/** The MQTT request a `listen` step opens, when the workspace holds it. */
export function sessionRequestOf(
  steps: readonly DraftStep[],
  listenId: string,
  mqttRequests: readonly MqttRequest[],
): MqttRequest | undefined {
  const listen = listenStepOf(steps, listenId);
  return listen === undefined ? undefined : mqttRequests.find((request) => request.uid === listen.sessionRequestUid);
}

function nearestListenAbove(steps: readonly DraftStep[], index: number): string {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (isListenStep(steps[i])) return steps[i].id;
  }
  return '';
}

function stepUnderAction(
  step: DraftKnownStep,
  steps: readonly DraftStep[],
  index: number,
  action: StepAction,
): DraftKnownStep {
  const kept = {
    uid: step.uid,
    id: step.id,
    ...(step.description !== undefined ? { description: step.description } : {}),
    ...(step.dependsOn !== undefined ? { dependsOn: step.dependsOn } : {}),
    ...(step.runIf !== undefined ? { runIf: step.runIf } : {}),
  };
  switch (action) {
    case 'call':
      return { ...kept, requestUid: '', captures: [] };
    case 'listen':
      return { ...kept, action, sessionRequestUid: '', timeoutMs: DEFAULT_SESSION_TIMEOUT_MS, captures: [] };
    case 'send':
      return { ...kept, action, on: nearestListenAbove(steps, index), captures: [] };
    case 'expect':
      return {
        ...kept,
        action,
        on: nearestListenAbove(steps, index),
        after: steps[index - 1]?.id ?? '',
        match: [],
        timeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
        captures: [],
      };
  }
}

/** A workflow that just gained a session step: refreshed by hand, and exposing nothing no live variable holds yet. */
function asVerdictWorkflow(draft: DraftWorkflow): DraftWorkflow {
  return {
    ...draft,
    refresh: { kind: 'manual' },
    steps: draft.steps.map((step) =>
      isCallStep(step) && step.captures.some((capture) => capture.exposed && capture.liveUid === undefined)
        ? {
            ...step,
            captures: step.captures.map((capture) =>
              capture.exposed && capture.liveUid === undefined ? { ...capture, exposed: false } : capture,
            ),
          }
        : step,
    ),
  };
}

/** The draft with the step at `index` under another action; the same draft when the step already has it. */
export function withStepAction(draft: DraftWorkflow, index: number, action: StepAction): DraftWorkflow {
  const step = draft.steps[index];
  if (step === undefined || !isKnownStep(step) || stepActionOf(step) === action) return draft;
  const steps = draft.steps.slice();
  steps[index] = stepUnderAction(step, draft.steps, index, action);
  const next = { ...draft, steps };
  return action === 'call' || draft.steps.some(isSessionStep) ? next : asVerdictWorkflow(next);
}
