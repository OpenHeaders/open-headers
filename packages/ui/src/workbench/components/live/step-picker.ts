/**
 * What the workflow view's step picker offers and hands over (the
 * workflow runs plan, Decisions log, S31): the step kinds, then the saved
 * requests a step can act on. Pure.
 */

import { STEP_ACTIONS, type StepAction } from './step-action';
import type { StepRequestChoice } from './workflow-step-request-options';

/** A row of the picker, taken: a kind with nothing picked yet, or a saved request to act on. */
export type StepPick =
  | { kind: 'action'; action: StepAction }
  /** A call on an HTTP or a GraphQL request. */
  | { kind: 'request'; uid: string; name: string }
  /** A listen on the session request it opens. */
  | { kind: 'session-request'; uid: string; name: string };

/** What a picker lists, from the workflow's form model. */
export interface StepPickerChoices {
  /** Listen, Send and Wait are offered, and with them the requests a Listen opens. */
  sessionAuthoring: boolean;
  requests: readonly StepRequestChoice[];
  sessionRequests: readonly StepRequestChoice[];
}

/** The kinds a picker offers, in the order the step's own selector lists them. */
export function offeredStepActions(sessionAuthoring: boolean): readonly StepAction[] {
  return sessionAuthoring ? STEP_ACTIONS : ['call'];
}

/** The requests a picker offers: a call's, then — where a Listen is offered — the ones a Listen opens. */
export function offeredStepRequests(choices: StepPickerChoices): StepRequestChoice[] {
  return [...choices.requests, ...(choices.sessionAuthoring ? choices.sessionRequests : [])];
}

export function pickOfRequest(request: StepRequestChoice): StepPick {
  return { kind: request.kind === 'mqtt' ? 'session-request' : 'request', uid: request.uid, name: request.name };
}

/** Whether a row's words hold what was typed, whatever the case. An empty search holds every row. */
export function matchesStepSearch(text: string, query: string): boolean {
  const wanted = query.trim().toLowerCase();
  return wanted === '' || text.toLowerCase().includes(wanted);
}
