/**
 * Rewrite every in-workflow reference to a capture's `name` from
 * `oldName` to `newName`, scoped to references that target
 * `ownerStepId` (the step that owns the renamed capture). Returns a
 * fresh `DraftWorkflow` — original untouched.
 *
 * Capture references appear as the `(stepId, captureName)` pair
 * inside `runIf.all[]` `capture-exists` / `capture-equals` /
 * `capture-matches` clauses, `priorityFrom`, and `refresh`
 * (`expires-in` / `expires-at`), and as a `{{step.<id>.<capture>}}`
 * token in an expect's address and in a criterion's value. Only
 * references whose `stepId`
 * matches `ownerStepId` AND whose `captureName` matches `oldName`
 * get rewritten — captures with the same name on a different step
 * are independent.
 *
 * Out of scope: cross-entity rebinding. Bound `LiveVariable`
 * `(workflowUid, stepId, captureName)` triples that point at this
 * capture are NOT rewritten — see `rebind-step-references.ts` for
 * the same trade-off (within-workflow is high-frequency; cross-
 * entity gets its own UX).
 */

import { type DraftKnownStep, type DraftWorkflow, isKnownStep, rewriteStepReferences } from '@openheaders/core/live';
import type { CallWorkflowStep, LiveWorkflow } from '@openheaders/core/types';
import { rewriteStepTemplates } from './rebind-templates';

function rewriteRefresh(
  refresh: LiveWorkflow['refresh'],
  ownerStepId: string,
  oldName: string,
  newName: string,
): LiveWorkflow['refresh'] {
  if (refresh.kind === 'expires-in' || refresh.kind === 'expires-at') {
    if (refresh.stepId === ownerStepId && refresh.captureName === oldName) {
      return { ...refresh, captureName: newName };
    }
  }
  return refresh;
}

function rewriteStepGate(
  gate: CallWorkflowStep['runIf'],
  ownerStepId: string,
  oldName: string,
  newName: string,
): CallWorkflowStep['runIf'] {
  if (!gate) return gate;
  let changed = false;
  const all = gate.all.map((clause) => {
    if (clause.kind === 'status') return clause;
    if (clause.stepId === ownerStepId && clause.captureName === oldName) {
      changed = true;
      return { ...clause, captureName: newName };
    }
    return clause;
  });
  return changed ? { all } : gate;
}

function rewritePriority(
  priority: CallWorkflowStep['priorityFrom'],
  ownerStepId: string,
  oldName: string,
  newName: string,
): CallWorkflowStep['priorityFrom'] {
  if (!priority) return priority;
  if (priority.stepId === ownerStepId && priority.captureName === oldName) {
    return { ...priority, captureName: newName };
  }
  return priority;
}

/**
 * Walk the draft and rebind every reference to capture `oldName` on
 * step `ownerStepId` → `newName`. The capture itself is left to the
 * caller — pass the already-renamed step in `draft.steps` and this
 * helper rewrites everything that references it.
 *
 * No-op when `oldName === newName` or no reference matches.
 */
export function rebindCaptureReferences(args: {
  draft: DraftWorkflow;
  ownerStepId: string;
  oldName: string;
  newName: string;
}): DraftWorkflow {
  const { draft, ownerStepId, oldName, newName } = args;
  if (oldName === newName) return draft;
  let stepsChanged = false;
  const nextSteps = draft.steps.map((step) => {
    if (!isKnownStep(step)) return step;
    const runIf = rewriteStepGate(step.runIf, ownerStepId, oldName, newName);
    const priorityFrom = rewritePriority(step.priorityFrom, ownerStepId, oldName, newName);
    const shared: DraftKnownStep =
      runIf === step.runIf && priorityFrom === step.priorityFrom ? step : { ...step, runIf, priorityFrom };
    const next = rewriteStepTemplates(shared, (template) =>
      rewriteStepReferences(template, (ref) =>
        ref.stepId === ownerStepId && ref.captureName === oldName ? { ...ref, captureName: newName } : null,
      ),
    );
    if (next !== step) stepsChanged = true;
    return next;
  });
  const refresh = rewriteRefresh(draft.refresh, ownerStepId, oldName, newName);
  if (!stepsChanged && refresh === draft.refresh) return draft;
  return { ...draft, steps: stepsChanged ? nextSteps : draft.steps, refresh };
}
