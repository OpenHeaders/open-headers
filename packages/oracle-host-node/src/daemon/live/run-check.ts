/**
 * What this host refuses before a run's first step (the workflow runs
 * plan, Laws — "A run that cannot run every step runs none"): a step of
 * an action the model does not know, whatever the model's own validator
 * refuses of the session steps, and a session step this host has no
 * adapter for — it runs a session on an MQTT request, and on no other
 * kind. The check is before the run, so nothing is sent that cannot be
 * judged.
 */

import {
  isChainWorkflow,
  isKnownStep,
  isListenStep,
  isSendStep,
  isSessionStep,
  isUnknownStep,
  type RunRefusal,
  unknownStepMessage,
  validateSessionSteps,
} from '@openheaders/core/live';
import type { ChainWorkflow, LiveWorkflow, MqttRequest } from '@openheaders/core/types';

export type WorkflowRunCheck = { ok: true; workflow: ChainWorkflow } | { ok: false; refusals: RunRefusal[] };

export function checkWorkflowRun(
  workflow: LiveWorkflow,
  findMqttRequest: (uid: string) => MqttRequest | null,
): WorkflowRunCheck {
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
  for (const step of sessionSteps) {
    if (isListenStep(step)) {
      if (findMqttRequest(step.sessionRequestUid) === null) {
        refusals.push({
          stepId: step.id,
          reason: `Step "${step.id}" names a session request that is not an MQTT request in this workspace.`,
        });
      } else if (step.runScripts === true) {
        refusals.push({
          stepId: step.id,
          reason: `Step "${step.id}" cannot run here: this host runs no script on a run's session.`,
        });
      }
    } else if (isSendStep(step) && step.endInput === true) {
      refusals.push({
        stepId: step.id,
        reason: `Step "${step.id}" cannot run here: an MQTT session has no end of input.`,
      });
    }
  }
  return refusals.length > 0 ? { ok: false, refusals } : { ok: true, workflow };
}
