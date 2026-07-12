/**
 * Pure-function tests for the graph view's edit helpers. Covers:
 *
 *   - addGraphDependency materializes an implicit prior-step dep into
 *     an explicit array before appending, orders known parents by
 *     declared-step order, preserves unknown parents, and no-ops on
 *     self-edges / unknown ids / already-effective parents.
 *   - Cycle-creating edges are NOT blocked (allow-and-badge — the
 *     validator flags them, matching the form's invalid-draft policy).
 *   - removeGraphDependency materializes the remainder explicitly,
 *     writes explicit `[]` when the last parent goes, and no-ops when
 *     the edge isn't an effective parent.
 *   - appendDraftStep / nextStepId mirror the form's "+ Step"
 *     defaults with collision-safe ids.
 *   - removeDraftStep mirrors the form's remove button: last step
 *     stays, dangling references are left for the validator.
 */

import type { DraftStep, DraftWorkflow } from '@openheaders/core/live';
import {
  addGraphDependency,
  appendDraftStep,
  nextStepId,
  removeDraftStep,
  removeGraphDependency,
} from '@openheaders/ui/workbench/components/live/graph-edit';
import { describe, expect, it } from 'vitest';

function mkStep(id: string, overrides: Partial<DraftStep> = {}): DraftStep {
  return { uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`, id, requestUid: 'req00000', captures: [], ...overrides };
}

function mkDraft(steps: DraftStep[]): DraftWorkflow {
  return { name: 'test', description: '', steps, refresh: { kind: 'manual' }, enabled: true };
}

describe('addGraphDependency', () => {
  it('materializes an implicit prior-step dep into an explicit array before appending', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c')]);
    const next = addGraphDependency(draft, 'a', 'c');
    expect(next?.steps[2].dependsOn).toEqual(['a', 'b']);
  });

  it('orders known parents by declared-step order', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] }), mkStep('c', { dependsOn: ['b'] })]);
    const next = addGraphDependency(draft, 'a', 'c');
    expect(next?.steps[2].dependsOn).toEqual(['a', 'b']);
  });

  it('adds onto an explicit root', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] })]);
    const next = addGraphDependency(draft, 'a', 'b');
    expect(next?.steps[1].dependsOn).toEqual(['a']);
  });

  it('preserves unknown existing parents at the end', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: ['ghost'] })]);
    const next = addGraphDependency(draft, 'a', 'b');
    expect(next?.steps[1].dependsOn).toEqual(['a', 'ghost']);
  });

  it('no-ops on a self-edge', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b')]);
    expect(addGraphDependency(draft, 'b', 'b')).toBeNull();
  });

  it('no-ops on unknown parent or child', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b')]);
    expect(addGraphDependency(draft, 'ghost', 'b')).toBeNull();
    expect(addGraphDependency(draft, 'a', 'ghost')).toBeNull();
  });

  it('no-ops when the parent is already effective (implicit or explicit)', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c', { dependsOn: ['a'] })]);
    expect(addGraphDependency(draft, 'a', 'b')).toBeNull(); // implicit a→b
    expect(addGraphDependency(draft, 'a', 'c')).toBeNull(); // explicit a→c
  });

  it('does not block cycle-creating edges — allow-and-badge', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: ['a'] })]);
    const next = addGraphDependency(draft, 'b', 'a');
    expect(next?.steps[0].dependsOn).toEqual(['b']);
  });

  it('does not mutate the input draft', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b')]);
    const frozen = JSON.stringify(draft);
    addGraphDependency(draft, 'a', 'b');
    expect(JSON.stringify(draft)).toBe(frozen);
  });
});

describe('removeGraphDependency', () => {
  it('materializes the remainder explicitly when removing from an implicit dep', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b')]);
    const next = removeGraphDependency(draft, 'a', 'b');
    expect(next?.steps[1].dependsOn).toEqual([]);
  });

  it('removes one parent from an explicit list', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] }), mkStep('c', { dependsOn: ['a', 'b'] })]);
    const next = removeGraphDependency(draft, 'a', 'c');
    expect(next?.steps[2].dependsOn).toEqual(['b']);
  });

  it('writes explicit [] (root) when the last parent goes', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: ['a'] })]);
    const next = removeGraphDependency(draft, 'a', 'b');
    expect(next?.steps[1].dependsOn).toEqual([]);
  });

  it('no-ops when the edge is not an effective parent', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] })]);
    expect(removeGraphDependency(draft, 'a', 'b')).toBeNull();
    expect(removeGraphDependency(draft, 'ghost', 'b')).toBeNull();
    expect(removeGraphDependency(draft, 'a', 'ghost')).toBeNull();
  });
});

describe('removeDraftStep', () => {
  it('removes the step by id', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c')]);
    const next = removeDraftStep(draft, 'b');
    expect(next?.steps.map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('leaves dangling references for the validator — same as the form', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: ['a'] })]);
    const next = removeDraftStep(draft, 'a');
    expect(next?.steps.map((s) => s.id)).toEqual(['b']);
    expect(next?.steps[0].dependsOn).toEqual(['a']);
  });

  it('refuses to remove the last remaining step', () => {
    expect(removeDraftStep(mkDraft([mkStep('a')]), 'a')).toBeNull();
  });

  it('no-ops on an unknown id', () => {
    expect(removeDraftStep(mkDraft([mkStep('a'), mkStep('b')]), 'ghost')).toBeNull();
  });

  it('does not mutate the input draft', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b')]);
    const frozen = JSON.stringify(draft);
    removeDraftStep(draft, 'a');
    expect(JSON.stringify(draft)).toBe(frozen);
  });
});

describe('appendDraftStep / nextStepId', () => {
  it('appends the form defaults with a fresh id and returns it', () => {
    const draft = mkDraft([mkStep('step1')]);
    const { draft: next, stepId } = appendDraftStep(draft);
    expect(stepId).toBe('step2');
    expect(next.steps).toHaveLength(2);
    expect(next.steps[1]).toMatchObject({ id: 'step2', requestUid: '', captures: [] });
    expect(next.steps[1].uid).toHaveLength(8);
    expect(next.steps[1].dependsOn).toBeUndefined();
  });

  it('seeds a requestUid when provided', () => {
    const { draft: next } = appendDraftStep(mkDraft([mkStep('a')]), 'req12345');
    expect(next.steps[1].requestUid).toBe('req12345');
  });

  it('skips over taken ids', () => {
    expect(nextStepId([mkStep('step2'), mkStep('step3')])).toBe('step4');
    expect(nextStepId([mkStep('a'), mkStep('step2')])).toBe('step3');
    expect(nextStepId([])).toBe('step1');
  });
});
