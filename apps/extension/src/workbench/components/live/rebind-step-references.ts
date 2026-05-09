/**
 * Rewrite every in-workflow reference to a step's `id` from `oldId` to
 * `newId`. Returns a fresh `DraftWorkflow` — original untouched.
 *
 * Steps reference each other by their user-facing `id` (the
 * `{{step.<id>.<capture>}}` token), not by the content-stable `uid`.
 * Renaming a step's id without rewriting references would leave every
 * `dependsOn`, `runIf.all[].stepId`, `priorityFrom.stepId`, and
 * `refresh.{stepId}` pointing at a stepId that no longer exists — the
 * validator surfaces the dangling reference as `step-unknown-dep`,
 * but the user shouldn't have to chase the rename through the
 * workflow themselves.
 *
 * Out of scope: cross-entity rebinding. Bound `LiveVariable.stepId`
 * values that point at this workflow are NOT rewritten here — those
 * live in a separate entity store and the rebind has its own UX
 * (the user re-points the LV explicitly, or it surfaces as a
 * resolution error). Within-workflow rebinding is the high-frequency
 * case (a single rename inside the editor); cross-entity is the
 * rare case that gets manual treatment.
 */

import type { DraftWorkflow } from '@openheaders/core/live';
import type { V5 } from '@openheaders/core/types';

function rewriteRefresh(refresh: V5.LiveWorkflow['refresh'], oldId: string, newId: string): V5.LiveWorkflow['refresh'] {
  if (refresh.kind === 'expires-in' || refresh.kind === 'expires-at') {
    if (refresh.stepId === oldId) return { ...refresh, stepId: newId };
  }
  return refresh;
}

function rewriteStepGate(
  gate: NonNullable<V5.WorkflowStep['runIf']> | undefined,
  oldId: string,
  newId: string,
): NonNullable<V5.WorkflowStep['runIf']> | undefined {
  if (!gate) return gate;
  let changed = false;
  const all = gate.all.map((clause) => {
    if (clause.stepId === oldId) {
      changed = true;
      return { ...clause, stepId: newId };
    }
    return clause;
  });
  return changed ? { all } : gate;
}

function rewritePriority(
  priority: V5.WorkflowStep['priorityFrom'],
  oldId: string,
  newId: string,
): V5.WorkflowStep['priorityFrom'] {
  if (!priority) return priority;
  if (priority.stepId === oldId) return { ...priority, stepId: newId };
  return priority;
}

function rewriteDependsOn(
  dependsOn: V5.WorkflowStep['dependsOn'],
  oldId: string,
  newId: string,
): V5.WorkflowStep['dependsOn'] {
  if (!dependsOn || dependsOn.length === 0) return dependsOn;
  let changed = false;
  const next = dependsOn.map((d) => {
    if (d === oldId) {
      changed = true;
      return newId;
    }
    return d;
  });
  return changed ? next : dependsOn;
}

/**
 * Walk the draft and rebind every reference to `oldId` → `newId`. The
 * step whose own `id` is being changed (`targetUid`) is left to the
 * caller — pass the already-renamed step in `draft.steps` and this
 * helper rewrites everything else.
 *
 * No-op when `oldId === newId` or `oldId` doesn't appear anywhere.
 */
export function rebindStepReferences(args: {
  draft: DraftWorkflow;
  targetUid: string;
  oldId: string;
  newId: string;
}): DraftWorkflow {
  const { draft, targetUid, oldId, newId } = args;
  if (oldId === newId) return draft;
  let stepsChanged = false;
  const nextSteps = draft.steps.map((step) => {
    // The renamed step itself stays as the caller wrote it. Its own
    // `id` is `newId`; we don't rewrite anything inside the renamed
    // step (a self-reference in dependsOn would be a cycle the
    // validator already rejects).
    if (step.uid === targetUid) return step;
    const dependsOn = rewriteDependsOn(step.dependsOn, oldId, newId);
    const runIf = rewriteStepGate(step.runIf, oldId, newId);
    const priorityFrom = rewritePriority(step.priorityFrom, oldId, newId);
    if (dependsOn === step.dependsOn && runIf === step.runIf && priorityFrom === step.priorityFrom) {
      return step;
    }
    stepsChanged = true;
    return { ...step, dependsOn, runIf, priorityFrom };
  });
  const refresh = rewriteRefresh(draft.refresh, oldId, newId);
  if (!stepsChanged && refresh === draft.refresh) return draft;
  return { ...draft, steps: stepsChanged ? nextSteps : draft.steps, refresh };
}
