/**
 * What this host refuses before a run's first step (the workflow runs
 * plan, Laws — "A run that cannot run every step runs none"): a step of
 * an action the model does not know, whatever the model's own validator
 * refuses of the session steps, and a session step this host has no
 * adapter for — it runs a session on an MQTT request, and on no other
 * kind — or no script runtime for. An `expect` that passes over stored
 * messages is refused where a row of its session's request makes the
 * stored mark unsure (The model — "Stored, not live"). The check is
 * before the run, so nothing is sent that cannot be judged.
 */

import {
  isChainWorkflow,
  isExpectStep,
  isKnownStep,
  isListenStep,
  isSendStep,
  isSessionStep,
  isUnknownStep,
  type RunRefusal,
  unknownStepMessage,
  validateSessionSteps,
} from '@openheaders/core/live';
import { topicFiltersOverlap } from '@openheaders/core/mqtt';
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
  for (const step of sessionSteps) {
    if (isListenStep(step)) {
      if (host.findMqttRequest(step.sessionRequestUid) === null) {
        refusals.push({
          stepId: step.id,
          reason: `Step "${step.id}" names a session request that is not an MQTT request in this workspace.`,
        });
      } else if (step.runScripts === true && !host.runsScripts) {
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
    } else if (isExpectStep(step) && step.includeStored !== true) {
      const listen = workflow.steps.find((each) => each.id === step.on);
      const request =
        listen !== undefined && isListenStep(listen) ? host.findMqttRequest(listen.sessionRequestUid) : null;
      const filter = request === null ? null : filterThatBlursStored(request, step.address);
      if (request !== null && filter !== null) {
        refusals.push({
          stepId: step.id,
          reason: `Step "${step.id}" passes over stored messages, but "${request.name}" subscribes to ${filter} with Retain As Published on, so a live message can look stored.`,
        });
      }
    }
  }
  return refusals.length > 0 ? { ok: false, refusals } : { ok: true, workflow };
}

const SHARED_SUBSCRIPTION_PREFIX = /^\$share\/[^/]+\//;

/**
 * The filter of the first row that can hand `address` a live message
 * marked retained, or `null`: a row a 5.0 session subscribes as it opens
 * with Retain As Published on, whose filter takes a topic the address
 * takes. A `{{…}}` in either is not resolved before the run and is read
 * as taking it; an absent address takes every topic.
 */
function filterThatBlursStored(request: MqttRequest, address: string | undefined): string | null {
  if (request.protocolVersion === '3.1.1') return null;
  for (const row of request.topics) {
    const filter = row.topicFilter.trim();
    if (row.subscribe === false || filter === '' || row.retainAsPublished !== true) continue;
    if (address === undefined || address.includes('{{') || filter.includes('{{')) return filter;
    if (topicFiltersOverlap(filter.replace(SHARED_SUBSCRIPTION_PREFIX, ''), address)) return filter;
  }
  return null;
}
