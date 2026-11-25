/**
 * The session actions of a step (the workflow runs plan, The model).
 *
 * The model knows four actions: a call, and `listen`, `send` and `expect`
 * on a session. A reader that knows only calls asks `isUnknownStep` and
 * passes every other step by; the validator and the runner ask here and
 * read a session step's own keys.
 */

import { SESSION_STEP_ACTIONS } from '../schemas/live';
import type {
  CallWorkflowStep,
  ChainWorkflow,
  ExpectWorkflowStep,
  KnownWorkflowStep,
  ListenWorkflowStep,
  LiveWorkflow,
  SendWorkflowStep,
  SessionWorkflowStep,
  WorkflowStep,
} from '../types/live';
import { isUnknownStep } from './unknown-step';

export function isCallStep(step: WorkflowStep): step is CallWorkflowStep {
  return !isUnknownStep(step);
}

export function isListenStep(step: WorkflowStep): step is ListenWorkflowStep {
  return isUnknownStep(step) && step.action === 'listen';
}

export function isSendStep(step: WorkflowStep): step is SendWorkflowStep {
  return isUnknownStep(step) && step.action === 'send';
}

export function isExpectStep(step: WorkflowStep): step is ExpectWorkflowStep {
  return isUnknownStep(step) && step.action === 'expect';
}

export function isSessionStep(step: WorkflowStep): step is SessionWorkflowStep {
  return isUnknownStep(step) && SESSION_STEP_ACTIONS.some((action) => action === step.action);
}

/** A step of an action the model knows: a call or a session step. */
export function isKnownStep(step: WorkflowStep): step is KnownWorkflowStep {
  return !isUnknownStep(step) || isSessionStep(step);
}

/** A workflow whose every step is of an action the model knows — what the runner takes. */
export function isChainWorkflow(workflow: LiveWorkflow): workflow is ChainWorkflow {
  return workflow.steps.every(isKnownStep);
}
