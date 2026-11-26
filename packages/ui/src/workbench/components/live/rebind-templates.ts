/**
 * The templates a step holds in its own keys — an expect's address and
 * the value of an `equals` criterion, on an expect's match rows or a
 * call's success criteria — each handed to `rewrite`. Returns the same
 * step when no template changed.
 *
 * Shared by the step-id and the capture-name rename helpers: both follow
 * a rename into `{{step.<id>.<capture>}}`, and differ only in which half
 * of the reference they move.
 */

import { type DraftKnownStep, isExpectStep, isSessionStep } from '@openheaders/core/live';
import type { Criterion } from '@openheaders/core/types';

function rewriteCriteria(criteria: Criterion[], rewrite: (template: string) => string): Criterion[] {
  let changed = false;
  const next = criteria.map((criterion) => {
    if (criterion.kind !== 'equals') return criterion;
    const value = rewrite(criterion.value);
    if (value === criterion.value) return criterion;
    changed = true;
    return { ...criterion, value };
  });
  return changed ? next : criteria;
}

export function rewriteStepTemplates(step: DraftKnownStep, rewrite: (template: string) => string): DraftKnownStep {
  if (isExpectStep(step)) {
    const address = step.address === undefined ? undefined : rewrite(step.address);
    const match = rewriteCriteria(step.match, rewrite);
    if (address === step.address && match === step.match) return step;
    return { ...step, ...(address === undefined ? {} : { address }), match };
  }
  if (isSessionStep(step) || step.successCriteria === undefined) return step;
  const successCriteria = rewriteCriteria(step.successCriteria, rewrite);
  return successCriteria === step.successCriteria ? step : { ...step, successCriteria };
}
