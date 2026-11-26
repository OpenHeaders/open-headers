/**
 * What a host refuses before a run's first step (the workflow runs plan,
 * Laws — "A run that cannot run every step runs none"): a step of an
 * action the model does not know, whatever the model's own validators
 * refuse of the session steps and of the requests they open, and a
 * session step the host has no script runtime for. The check is before
 * the run, so nothing is sent that cannot be judged.
 *
 * Host-neutral: every host that runs a session step asks the one check
 * and differs only in how it finds a request and whether it runs scripts.
 */

import {
  isChainWorkflow,
  isKnownStep,
  isListenStep,
  isSessionStep,
  isUnknownStep,
  type RunRefusal,
  unknownStepMessage,
  validateSessionRequests,
  validateSessionSteps,
} from '@openheaders/core/live';
import type { ChainWorkflow, LiveWorkflow, MqttRequest } from '@openheaders/core/types';

export type WorkflowRunCheck = { ok: true; workflow: ChainWorkflow } | { ok: false; refusals: RunRefusal[] };

export interface WorkflowRunHost {
  findMqttRequest(uid: string): MqttRequest | null;
  /** This host has a script runtime — a `listen` that runs its request's scripts can run here. */
  runsScripts: boolean;
}

export function checkWorkflowRun(workflow: LiveWorkflow, host: WorkflowRunHost): WorkflowRunCheck {
  if (!isChainWorkflow(workflow)) {
    return {
      ok: false,
      refusals: workflow.steps
        .filter(isUnknownStep)
        .filter((step) => !isKnownStep(step))
        .map((step) => ({ stepId: step.id, reason: unknownStepMessage(step) })),
    };
  }

  const sessionSteps = workflow.steps.filter(isSessionStep);
  if (sessionSteps.length === 0) return { ok: true, workflow };

  const refusals: RunRefusal[] = validateSessionSteps(workflow).map((error) => ({
    // A refusal of the workflow as a whole is named on its first session step.
    stepId: error.stepId ?? sessionSteps[0].id,
    reason: error.message,
  }));
  // The request validator answers in step order, one error a step at most:
  // each step takes its own, so a host's refusal lands where the step is.
  const requestErrors = validateSessionRequests(workflow, (uid) => host.findMqttRequest(uid));
  let next = 0;
  for (const step of sessionSteps) {
    if (requestErrors[next]?.stepId === step.id) {
      refusals.push({ stepId: step.id, reason: requestErrors[next].message });
      next += 1;
    } else if (isListenStep(step) && step.runScripts === true && !host.runsScripts) {
      refusals.push({
        stepId: step.id,
        reason: `Step "${step.id}" cannot run here: this host runs no script on a run's session.`,
      });
    }
  }
  return refusals.length > 0 ? { ok: false, refusals } : { ok: true, workflow };
}
