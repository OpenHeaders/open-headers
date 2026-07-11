/**
 * Pure draft-mutation helpers for the workflow graph view's editing
 * gestures (WORKFLOW_GRAPH_PLAN.md slice 4). Sibling of
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
 * Cycle-creating edges are NOT blocked here — the form allows invalid
 * drafts and badges them via `validateWorkflowShape`; the graph does
 * the same (warn during the gesture, badge after the drop).
 */

import type { DraftStep, DraftWorkflow } from '@openheaders/core/live';
import { effectiveDependsOn } from '@openheaders/core/live';
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
  if (index < 0) return null;
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
  if (index < 0) return null;
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
 * Append a fresh step (implicit prior-step dep, no captures) — the
 * same defaults the form's "+ Step" button produces. Returns the new
 * draft plus the generated step id so callers can select it.
 */
export function appendDraftStep(draft: DraftWorkflow, requestUid = ''): { draft: DraftWorkflow; stepId: string } {
  const stepId = nextStepId(draft.steps);
  const step: DraftStep = { uid: generateUid(), id: stepId, requestUid, captures: [] };
  return { draft: { ...draft, steps: [...draft.steps, step] }, stepId };
}
