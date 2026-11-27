/**
 * Pure draft-mutation helpers for the workflow graph view's editing
 * gestures (the workflow-graph plan slice 4). Sibling of
 * `graph-layout.ts`: layout projects the draft, these mutate it — the
 * graph stays a projection of the ONE canonical `DraftWorkflow`, so
 * every helper returns a new draft shaped exactly as the form's own
 * setters would produce it.
 *
 * dependsOn encoding (mirrors the form's dependency editor):
 *   - `undefined` = implicit prior-step dependency;
 *   - `[]`        = explicit root;
 *   - `[ids...]`  = explicit DAG, ordered by declared-step order.
 * A graph edit on a step with an implicit dep materializes the
 * effective parents into an explicit array first, so the gesture's
 * intent (add/remove exactly one edge) survives later reorders.
 *
 * A step of an action the model does not know takes no edge edit: its
 * dependencies are its own keys, not this build's to write. A session
 * step takes one as a call does.
 *
 * Cycle-creating edges are NOT blocked here — the form allows invalid
 * drafts and badges them via `validateWorkflowShape`; the graph does
 * the same (warn during the gesture, badge after the drop).
 */

import type { DraftKnownStep, DraftStep, DraftWorkflow } from '@openheaders/core/live';
import { effectiveDependsOn, isExpectStep, isKnownStep, isSessionStep } from '@openheaders/core/live';
import type { LiveWorkflow } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';

/** Minimal synthetic workflow — `effectiveDependsOn` only reads steps. */
function syntheticWorkflow(draft: DraftWorkflow): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: '________',
    path: 'live-workflows/draft',
    name: draft.name,
    enabled: draft.enabled,
    steps: draft.steps,
    refresh: draft.refresh,
  };
}

function effectiveParentsAt(draft: DraftWorkflow, index: number): string[] {
  return effectiveDependsOn(draft.steps[index], index, syntheticWorkflow(draft));
}

function withStepDependsOn(draft: DraftWorkflow, index: number, dependsOn: string[]): DraftWorkflow {
  const steps = draft.steps.slice();
  steps[index] = { ...steps[index], dependsOn };
  return { ...draft, steps };
}

/**
 * Add a `parentId → childId` dependency edge. Returns the new draft,
 * or `null` when the gesture is a no-op: self-edge, unknown child,
 * unknown parent, or the edge is already an effective parent.
 *
 * Known parents are re-ordered by declared-step order (the form's
 * normalization); parents referencing unknown step ids are preserved
 * at the end — the validator flags them, and destroying them is not
 * this gesture's intent.
 */
export function addGraphDependency(draft: DraftWorkflow, parentId: string, childId: string): DraftWorkflow | null {
  if (parentId === childId) return null;
  const index = draft.steps.findIndex((s) => s.id === childId);
  if (index < 0 || !isKnownStep(draft.steps[index])) return null;
  if (!draft.steps.some((s) => s.id === parentId)) return null;
  const current = effectiveParentsAt(draft, index);
  if (current.includes(parentId)) return null;
  const wanted = new Set([...current, parentId]);
  const known = new Set(draft.steps.map((s) => s.id));
  const ordered = draft.steps.filter((s) => s.id !== childId && wanted.has(s.id)).map((s) => s.id);
  const unknown = current.filter((p) => !known.has(p));
  return withStepDependsOn(draft, index, [...ordered, ...unknown]);
}

/**
 * Remove the `parentId → childId` dependency edge. Returns the new
 * draft, or `null` when `parentId` is not an effective parent of the
 * child. Removing the last parent writes an explicit `[]` (root) —
 * never a fall-back to the implicit prior-step dep, so the user's
 * intent survives a reorder.
 */
export function removeGraphDependency(draft: DraftWorkflow, parentId: string, childId: string): DraftWorkflow | null {
  const index = draft.steps.findIndex((s) => s.id === childId);
  if (index < 0 || !isKnownStep(draft.steps[index])) return null;
  const current = effectiveParentsAt(draft, index);
  if (!current.includes(parentId)) return null;
  return withStepDependsOn(
    draft,
    index,
    current.filter((p) => p !== parentId),
  );
}

/** First `step<n>` id not already taken, counting up from steps+1. */
export function nextStepId(steps: readonly DraftStep[]): string {
  const existing = new Set(steps.map((s) => s.id));
  let n = steps.length + 1;
  let candidate = `step${n}`;
  while (existing.has(candidate)) {
    n += 1;
    candidate = `step${n}`;
  }
  return candidate;
}

/**
 * Remove a step by id — the graph's delete gesture (context menu /
 * ⌫ on a selected node). Mirrors the form's remove button exactly:
 * the last remaining step can't be removed, and references to the
 * deleted id are left in place for the validator to badge — same as
 * deleting from the form.
 */
export function removeDraftStep(draft: DraftWorkflow, stepId: string): DraftWorkflow | null {
  if (draft.steps.length <= 1) return null;
  if (!draft.steps.some((s) => s.id === stepId)) return null;
  return { ...draft, steps: draft.steps.filter((s) => s.id !== stepId) };
}

/** First `<id>-copy`, `<id>-copy2`, … not already taken. */
function copyStepId(steps: readonly DraftStep[], id: string): string {
  const existing = new Set(steps.map((s) => s.id));
  let n = 1;
  let candidate = `${id}-copy`;
  while (existing.has(candidate)) {
    n += 1;
    candidate = `${id}-copy${n}`;
  }
  return candidate;
}

const withFreshUid = <T extends { uid: string }>(held: T): T => ({ ...held, uid: generateUid() });

/** A step's own fields under fresh uids; a call's captures are no longer exposed — a live variable has one source. */
function copyOfStep(step: DraftKnownStep): DraftKnownStep {
  const runIf = step.runIf !== undefined ? { runIf: { all: step.runIf.all.map(withFreshUid) } } : {};
  if (isSessionStep(step)) {
    const captures = step.captures.map(withFreshUid);
    return isExpectStep(step)
      ? { ...step, ...runIf, captures, match: step.match.map(withFreshUid) }
      : { ...step, ...runIf, captures };
  }
  return {
    ...step,
    ...runIf,
    ...(step.successCriteria !== undefined ? { successCriteria: step.successCriteria.map(withFreshUid) } : {}),
    captures: step.captures.map(({ liveUid: _bound, ...capture }) => ({
      ...capture,
      uid: generateUid(),
      exposed: false,
    })),
  };
}

/**
 * A copy of a step, as the workflow's last step — the step panel's
 * Duplicate. The copy waits for what the original waits for, by name: a
 * step placed anywhere else would become the step before another one,
 * and so the dependency of every step that names none. Returns the new
 * draft and the copy's uid, or `null` for a step of an action the model
 * does not know.
 */
export function duplicateDraftStep(
  draft: DraftWorkflow,
  stepUid: string,
): { draft: DraftWorkflow; stepUid: string } | null {
  const index = draft.steps.findIndex((s) => s.uid === stepUid);
  const step = draft.steps[index];
  if (step === undefined || !isKnownStep(step)) return null;
  const copy: DraftKnownStep = {
    ...copyOfStep(step),
    uid: generateUid(),
    id: copyStepId(draft.steps, step.id),
    dependsOn: effectiveParentsAt(draft, index),
  };
  return { draft: { ...draft, steps: [...draft.steps, copy] }, stepUid: copy.uid };
}

/**
 * Append a fresh step (implicit prior-step dep, no captures) — the
 * same defaults the form's "+ Step" button produces. Returns the new
 * draft plus the generated step id so callers can select it.
 */
export function appendDraftStep(draft: DraftWorkflow, requestUid = ''): { draft: DraftWorkflow; stepId: string } {
  const stepId = nextStepId(draft.steps);
  const step: DraftStep = { uid: generateUid(), id: stepId, requestUid, captures: [] };
  return { draft: { ...draft, steps: [...draft.steps, step] }, stepId };
}
