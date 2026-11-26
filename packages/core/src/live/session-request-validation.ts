/**
 * Pure validator for what a workflow's session steps ask of their
 * session requests (the workflow runs plan, The model) — the checks
 * `validateSessionSteps` cannot make, because they read a request:
 *
 *   - A `listen` opens an MQTT request of the workspace: a session runs
 *     on an MQTT request, and on no other kind.
 *   - A `send` that ends the input has nothing to end: an MQTT session
 *     has no end of input.
 *   - An `expect` that passes over stored messages is refused where a
 *     row of its session's request makes the stored mark unsure ("Stored,
 *     not live"): a 5.0 session that subscribes with Retain As Published
 *     on hands a live message over with the retain flag as published.
 *
 * The editor, the agent's save and the check before a run ask the one
 * function, so a workflow is refused by the same sentence wherever it is
 * read. Returns `StructuralError[]` in declared step order — empty means
 * valid. Never throws.
 */

import { topicFiltersOverlap } from '../mqtt/topic';
import type { LiveWorkflow } from '../types/live';
import type { MqttRequest } from '../types/mqtt-request';
import { isExpectStep, isListenStep, isSendStep, isSessionStep } from './step-actions';
import type { StructuralError } from './step-validation';

/** How a reader finds an MQTT request of the workspace by uid; `null` when there is none. */
export type MqttRequestLookup = (uid: string) => MqttRequest | null;

export function validateSessionRequests(workflow: LiveWorkflow, findMqttRequest: MqttRequestLookup): StructuralError[] {
  const errors: StructuralError[] = [];
  for (const step of workflow.steps) {
    if (!isSessionStep(step)) continue;
    if (isListenStep(step)) {
      if (findMqttRequest(step.sessionRequestUid) === null) {
        errors.push({
          issue: 'listen-request-missing',
          stepId: step.id,
          message: `Step "${step.id}" names a session request that is not an MQTT request in this workspace.`,
        });
      }
    } else if (isSendStep(step) && step.endInput === true) {
      errors.push({
        issue: 'send-end-input-unsupported',
        stepId: step.id,
        message: `Step "${step.id}" cannot run here: an MQTT session has no end of input.`,
      });
    } else if (isExpectStep(step) && step.includeStored !== true) {
      const listen = workflow.steps.find((each) => each.id === step.on);
      const request = listen !== undefined && isListenStep(listen) ? findMqttRequest(listen.sessionRequestUid) : null;
      const filter = request === null ? null : filterThatBlursStored(request, step.address);
      if (request !== null && filter !== null) {
        errors.push({
          issue: 'expect-stored-unsure',
          stepId: step.id,
          referencedStepId: step.on,
          message: `Step "${step.id}" passes over stored messages, but "${request.name}" subscribes to ${filter} with Retain As Published on, so a live message can look stored.`,
        });
      }
    }
  }
  return errors;
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
