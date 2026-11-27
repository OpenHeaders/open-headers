/**
 * Who reads a capture (the workflows redesign, Step panel): the captures
 * of other steps that a step reads, and where it reads each — in the
 * request it names, in a Wait's topic or match values, in a Call's
 * success criteria, in its run condition, as its priority. Pure.
 */

import {
  collectGraphqlRequestTemplateStrings,
  collectMqttRequestTemplateStrings,
  collectRequestTemplateStrings,
  isCallStep,
  isExpectStep,
  isKnownStep,
  isListenStep,
  isSessionStep,
  isUnknownStep,
  scanTemplateReferencesMany,
} from '@openheaders/core/live';
import type { Criterion, WorkflowStep } from '@openheaders/core/types';
import type { StepRequests } from './use-step-requests';

/** Where a step reads a capture — each a card of its panel. */
export type CaptureUsePlace = 'request' | 'connection' | 'topic' | 'match' | 'criteria' | 'condition' | 'priority';

export interface CaptureUse {
  /** The step that captured the value. */
  stepId: string;
  captureName: string;
  place: CaptureUsePlace;
}

export interface TemplateSource {
  place: CaptureUsePlace;
  templates: readonly string[];
}

const criterionTemplates = (criteria: readonly Criterion[]): string[] =>
  criteria.flatMap((criterion) => (criterion.kind === 'equals' ? [criterion.value] : []));

/** The templates a step holds itself, by where: a Wait's topic and match values, a Call's success criteria. */
export function stepOwnTemplateSources(step: WorkflowStep): TemplateSource[] {
  if (!isKnownStep(step)) return [];
  if (isExpectStep(step)) {
    return [
      { place: 'topic', templates: step.address !== undefined ? [step.address] : [] },
      { place: 'match', templates: criterionTemplates(step.match) },
    ];
  }
  if (isCallStep(step)) return [{ place: 'criteria', templates: criterionTemplates(step.successCriteria ?? []) }];
  return [];
}

/** The templates of the request a step names: a call's own, the one a listen opens. */
export function stepRequestTemplates(step: WorkflowStep, requests: StepRequests): readonly string[] {
  if (isSessionStep(step)) {
    const request = isListenStep(step)
      ? requests.mqttRequests.find((each) => each.uid === step.sessionRequestUid)
      : undefined;
    return request !== undefined ? collectMqttRequestTemplateStrings(request) : [];
  }
  if (isUnknownStep(step)) return [];
  const http = requests.requestsByUid.get(step.requestUid);
  if (http !== undefined) return collectRequestTemplateStrings(http);
  const graphql = requests.graphqlByUid.get(step.requestUid);
  return graphql !== undefined ? collectGraphqlRequestTemplateStrings(graphql) : [];
}

/** Every capture a step reads and where, first seen first — one entry for a capture read twice in one place. */
export function captureUsesOf(step: WorkflowStep, requests: StepRequests): CaptureUse[] {
  if (!isKnownStep(step)) return [];
  const uses: CaptureUse[] = [];
  const seen = new Set<string>();
  const add = (stepId: string, captureName: string, place: CaptureUsePlace) => {
    const key = `${place}\n${stepId}\n${captureName}`;
    if (seen.has(key)) return;
    seen.add(key);
    uses.push({ stepId, captureName, place });
  };

  const sources: TemplateSource[] = [
    { place: isSessionStep(step) ? 'connection' : 'request', templates: stepRequestTemplates(step, requests) },
    ...stepOwnTemplateSources(step),
  ];
  for (const source of sources) {
    for (const ref of scanTemplateReferencesMany(source.templates).step) add(ref.stepId, ref.captureName, source.place);
  }
  for (const clause of step.runIf?.all ?? []) {
    if (clause.kind !== 'status' && clause.captureName !== '') add(clause.stepId, clause.captureName, 'condition');
  }
  const priority = step.priorityFrom;
  if (priority !== undefined && priority.captureName !== '') add(priority.stepId, priority.captureName, 'priority');
  return uses;
}
