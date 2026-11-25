/**
 * What a run needs of its host before its first step (the workflow runs
 * plan, Laws — "A run that cannot run every step runs none"): a session
 * step needs a host that opens sessions, and a template outside a
 * request — an `expect`'s address, a criterion's value — needs a host
 * that resolves one. The check is before the run, so nothing is sent
 * that cannot be judged.
 */

import type { ChainWorkflow, KnownWorkflowStep } from '../types/live';
import { criteriaHoldTemplate } from './criteria';
import { isCallStep, isExpectStep, isSessionStep } from './step-actions';

export interface RunRefusal {
  stepId: string;
  /** One sentence that states the condition. */
  reason: string;
}

export function stepsThisRunCannotRun(
  workflow: ChainWorkflow,
  host: { opensSessions: boolean; resolvesTemplates: boolean },
): RunRefusal[] {
  const refusals: RunRefusal[] = [];
  for (const step of workflow.steps) {
    if (isSessionStep(step) && !host.opensSessions) {
      refusals.push({ stepId: step.id, reason: `Step "${step.id}" cannot run here: this host opens no session.` });
    } else if (holdsTemplate(step) && !host.resolvesTemplates) {
      refusals.push({
        stepId: step.id,
        reason: `Step "${step.id}" cannot run here: this host resolves no template outside a request.`,
      });
    }
  }
  return refusals;
}

function holdsTemplate(step: KnownWorkflowStep): boolean {
  if (isCallStep(step)) return criteriaHoldTemplate(step.successCriteria ?? []);
  if (!isExpectStep(step)) return false;
  return (step.address ?? '').includes('{{') || criteriaHoldTemplate(step.match);
}
