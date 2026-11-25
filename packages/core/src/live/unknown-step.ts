/**
 * A step this build does not know (the workflow runs plan, Laws —
 * "A tolerant reader ships first").
 *
 * A workflow a newer build wrote may hold a step whose `action` names
 * something other than a call. Every reader of a step asks here first,
 * assumes only that step's `uid`, `id` and `action`, and passes it by:
 * it is shown as needing a newer version, never run, never read as a
 * call, never thrown on.
 */

import { hasUnknownStepAction } from '../schemas/live';
import type { LiveWorkflow, RunnableWorkflow, UnknownWorkflowStep, WorkflowStep } from '../types/live';

export function isUnknownStep(step: WorkflowStep): step is UnknownWorkflowStep {
  return hasUnknownStepAction(step);
}

/**
 * The steps of a workflow that send a request, in declared order — what
 * a reader of step requests walks. Generic over the step so an editor's
 * draft keeps its own call-step type.
 */
export function callStepsOf<S extends WorkflowStep>(workflow: {
  steps: readonly S[];
}): Exclude<S, UnknownWorkflowStep>[] {
  return workflow.steps.filter((step): step is Exclude<S, UnknownWorkflowStep> => !isUnknownStep(step));
}

/** The steps of a workflow this build does not know, in declared order. */
export function unknownStepsOf(workflow: LiveWorkflow): UnknownWorkflowStep[] {
  return workflow.steps.filter(isUnknownStep);
}

/** Whether this build can run every step of a workflow — a run that cannot run every step runs none. */
export function isRunnableWorkflow(workflow: LiveWorkflow): workflow is RunnableWorkflow {
  return !workflow.steps.some(isUnknownStep);
}

/** What a workflow that holds such a step is refused with, where no step is the one to name. */
export const WORKFLOW_NEEDS_UPDATE_MESSAGE =
  'This workflow has steps that need a newer version of OpenHeaders. Update to edit or run it.';

/**
 * The phase a run is refused in for a step this build does not know —
 * before its first step, so nothing is sent that cannot be judged.
 */
export const UNKNOWN_STEP_PHASE = 'unsupported';

/** The one sentence a step this build does not know is refused with, by name. */
export function unknownStepMessage(step: UnknownWorkflowStep): string {
  return `Step "${step.id}" needs a newer version of OpenHeaders (action "${step.action}").`;
}
