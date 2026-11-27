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
 *   - duplicateDraftStep puts a copy last, waiting for what the
 *     original waits for, under fresh uids and with no capture exposed.
 */

import { callStepsOf, type DraftCallStep, type DraftWorkflow } from '@openheaders/core/live';
import type { ExpectWorkflowStep, ListenWorkflowStep } from '@openheaders/core/types';
import {
  addGraphDependency,
  appendDraftStep,
  duplicateDraftStep,
  nextStepId,
  removeDraftStep,
  removeGraphDependency,
} from '@openheaders/ui/workbench/components/live/graph-edit';
import { describe, expect, it } from 'vitest';

/** The draft's call step at an index — every step of these fixtures is one. */
const stepAt = (draft: DraftWorkflow | null, index: number) => callStepsOf(draft ?? { steps: [] })[index];

function mkStep(id: string, overrides: Partial<DraftCallStep> = {}): DraftCallStep {
  return { uid: `stp${id.padEnd(5, 'x').slice(0, 5)}`, id, requestUid: 'req00000', captures: [], ...overrides };
}

function mkDraft(steps: DraftCallStep[]): DraftWorkflow {
  return { name: 'test', description: '', steps, refresh: { kind: 'manual' }, enabled: true };
}

describe('addGraphDependency', () => {
  it('materializes an implicit prior-step dep into an explicit array before appending', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c')]);
    const next = addGraphDependency(draft, 'a', 'c');
    expect(stepAt(next, 2).dependsOn).toEqual(['a', 'b']);
  });

  it('orders known parents by declared-step order', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] }), mkStep('c', { dependsOn: ['b'] })]);
    const next = addGraphDependency(draft, 'a', 'c');
    expect(stepAt(next, 2).dependsOn).toEqual(['a', 'b']);
  });

  it('adds onto an explicit root', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] })]);
    const next = addGraphDependency(draft, 'a', 'b');
    expect(stepAt(next, 1).dependsOn).toEqual(['a']);
  });

  it('preserves unknown existing parents at the end', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: ['ghost'] })]);
    const next = addGraphDependency(draft, 'a', 'b');
    expect(stepAt(next, 1).dependsOn).toEqual(['a', 'ghost']);
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
    expect(stepAt(next, 0).dependsOn).toEqual(['b']);
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
    expect(stepAt(next, 1).dependsOn).toEqual([]);
  });

  it('removes one parent from an explicit list', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] }), mkStep('c', { dependsOn: ['a', 'b'] })]);
    const next = removeGraphDependency(draft, 'a', 'c');
    expect(stepAt(next, 2).dependsOn).toEqual(['b']);
  });

  it('writes explicit [] (root) when the last parent goes', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: ['a'] })]);
    const next = removeGraphDependency(draft, 'a', 'b');
    expect(stepAt(next, 1).dependsOn).toEqual([]);
  });

  it('no-ops when the edge is not an effective parent', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b', { dependsOn: [] })]);
    expect(removeGraphDependency(draft, 'a', 'b')).toBeNull();
    expect(removeGraphDependency(draft, 'ghost', 'b')).toBeNull();
    expect(removeGraphDependency(draft, 'a', 'ghost')).toBeNull();
  });
});

describe('a session step', () => {
  const listen: ListenWorkflowStep = {
    uid: 'stplistn',
    id: 'probe',
    action: 'listen',
    sessionRequestUid: 'mqttreq1',
    timeoutMs: 10_000,
    captures: [],
  };
  const expectStep: ExpectWorkflowStep = {
    uid: 'stpexpct',
    id: 'status',
    action: 'expect',
    on: 'probe',
    after: 'reboot',
    match: [],
    timeoutMs: 10_000,
    captures: [],
  };
  const draft: DraftWorkflow = {
    name: 'Reboot',
    description: '',
    steps: [listen, mkStep('reboot'), expectStep],
    refresh: { kind: 'manual' },
    enabled: true,
  };

  it('takes an edge as a call does, its own keys kept', () => {
    expect(addGraphDependency(draft, 'probe', 'status')?.steps[2]).toEqual({
      ...expectStep,
      dependsOn: ['probe', 'reboot'],
    });
  });

  it('gives one up as a call does', () => {
    expect(removeGraphDependency(draft, 'reboot', 'status')?.steps[2]).toEqual({ ...expectStep, dependsOn: [] });
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
    expect(stepAt(next, 0).dependsOn).toEqual(['a']);
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

describe('duplicateDraftStep', () => {
  it('puts the copy last, under an id and a uid of its own, and returns the copy’s uid', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c')]);
    const copied = duplicateDraftStep(draft, draft.steps[1].uid);
    expect(copied?.draft.steps.map((s) => s.id)).toEqual(['a', 'b', 'c', 'b-copy']);
    expect(copied?.draft.steps[3].uid).toBe(copied?.stepUid);
    expect(copied?.stepUid).not.toBe(draft.steps[1].uid);
    expect(copied?.stepUid).toHaveLength(8);
  });

  it('waits for what the original waits for, by name — the step before it where it names none', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c', { dependsOn: ['a'] })]);
    expect(stepAt(duplicateDraftStep(draft, draft.steps[1].uid)?.draft ?? null, 3).dependsOn).toEqual(['a']);
    expect(stepAt(duplicateDraftStep(draft, draft.steps[2].uid)?.draft ?? null, 3).dependsOn).toEqual(['a']);
    expect(stepAt(duplicateDraftStep(draft, draft.steps[0].uid)?.draft ?? null, 3).dependsOn).toEqual([]);
  });

  it('leaves every other step as it was', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c')]);
    expect(duplicateDraftStep(draft, draft.steps[0].uid)?.draft.steps.slice(0, 3)).toEqual(draft.steps);
  });

  it('skips over taken ids', () => {
    const draft = mkDraft([mkStep('a'), mkStep('a-copy'), mkStep('a-copy2')]);
    expect(duplicateDraftStep(draft, draft.steps[0].uid)?.draft.steps[3].id).toBe('a-copy3');
  });

  it('gives what the copy holds fresh uids, and exposes none of its captures', () => {
    const original = mkStep('a', {
      runIf: { all: [{ uid: 'gatstat0', kind: 'status', stepId: 'root', match: '2xx' }] },
      successCriteria: [{ kind: 'status', uid: 'crtstat0', match: '2xx' }],
      captures: [
        {
          uid: 'captoken',
          name: 'token',
          extractor: { kind: 'whole-body' },
          exposed: true,
          liveName: 'token',
          liveUid: 'lvtoken0',
        },
      ],
    });
    const draft = mkDraft([mkStep('root'), original]);
    const copy = stepAt(duplicateDraftStep(draft, original.uid)?.draft ?? null, 2);
    expect(copy.runIf?.all).toEqual([{ uid: expect.any(String), kind: 'status', stepId: 'root', match: '2xx' }]);
    expect(copy.runIf?.all[0].uid).not.toBe('gatstat0');
    expect(copy.successCriteria?.[0].uid).not.toBe('crtstat0');
    expect(copy.captures).toEqual([
      { uid: expect.any(String), name: 'token', extractor: { kind: 'whole-body' }, exposed: false, liveName: 'token' },
    ]);
    expect(copy.captures[0].uid).not.toBe('captoken');
  });

  it('copies a session step with its own keys, its match rows under fresh uids', () => {
    const listen: ListenWorkflowStep = {
      uid: 'stplistn',
      id: 'probe',
      action: 'listen',
      sessionRequestUid: 'mqttreq1',
      timeoutMs: 10_000,
      captures: [],
    };
    const wait: ExpectWorkflowStep = {
      uid: 'stpexpct',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'probe',
      match: [{ kind: 'exists', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' } }],
      timeoutMs: 10_000,
      captures: [],
    };
    const draft: DraftWorkflow = {
      name: 'Reboot',
      description: '',
      steps: [listen, wait],
      refresh: { kind: 'manual' },
      enabled: true,
    };
    const copied = duplicateDraftStep(draft, wait.uid);
    expect(copied?.draft.steps[2]).toEqual({
      ...wait,
      uid: copied?.stepUid,
      id: 'status-copy',
      dependsOn: ['probe'],
      match: [{ kind: 'exists', uid: expect.any(String), extractor: { kind: 'json-path', path: '$.state' } }],
    });
  });

  it('takes no copy of a step of an action the model does not know, nor of a step that is not there', () => {
    const draft: DraftWorkflow = {
      ...mkDraft([mkStep('a')]),
      steps: [mkStep('a'), { uid: 'stpwatch', id: 'probe', action: 'watch' }],
    };
    expect(duplicateDraftStep(draft, 'stpwatch')).toBeNull();
    expect(duplicateDraftStep(draft, 'stpghost')).toBeNull();
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
    expect(stepAt(next, 1).dependsOn).toBeUndefined();
  });

  it('seeds a requestUid when provided', () => {
    const { draft: next } = appendDraftStep(mkDraft([mkStep('a')]), 'req12345');
    expect(stepAt(next, 1).requestUid).toBe('req12345');
  });

  it('skips over taken ids', () => {
    expect(nextStepId([mkStep('step2'), mkStep('step3')])).toBe('step4');
    expect(nextStepId([mkStep('a'), mkStep('step2')])).toBe('step3');
    expect(nextStepId([])).toBe('step1');
  });
});
