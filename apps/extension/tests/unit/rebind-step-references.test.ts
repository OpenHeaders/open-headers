import type { DraftWorkflow } from '@openheaders/core/live';
import { describe, expect, it } from 'vitest';
import { rebindStepReferences } from '@/workbench/components/live/rebind-step-references';

function makeDraft(overrides: Partial<DraftWorkflow> = {}): DraftWorkflow {
  return {
    name: 'auth chain',
    description: '',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [],
    ...overrides,
  };
}

describe('rebindStepReferences', () => {
  it('returns the input draft unchanged when oldId === newId', () => {
    const draft = makeDraft();
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'step1', newId: 'step1' });
    expect(out).toBe(draft);
  });

  it('returns the input draft when no references match', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'aaaaaaaa', id: 'step1', requestUid: 'req-a', captures: [] },
        { uid: 'bbbbbbbb', id: 'step2', requestUid: 'req-b', captures: [] },
      ],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'oldname', newId: 'newname' });
    expect(out).toBe(draft);
  });

  it('rewrites dependsOn entries on other steps', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'aaaaaaaa', id: 'auth', requestUid: 'req-a', captures: [] },
        { uid: 'bbbbbbbb', id: 'fetch', requestUid: 'req-b', captures: [], dependsOn: ['login', 'other'] },
      ],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'login', newId: 'auth' });
    expect(out.steps[1].dependsOn).toEqual(['auth', 'other']);
    // Renamed step itself is left alone.
    expect(out.steps[0]).toBe(draft.steps[0]);
  });

  it('rewrites runIf clauses on other steps without touching unrelated clauses', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'aaaaaaaa', id: 'login', requestUid: 'req-a', captures: [] },
        {
          uid: 'bbbbbbbb',
          id: 'fetch',
          requestUid: 'req-b',
          captures: [],
          runIf: {
            all: [
              { kind: 'capture-exists', uid: 'cl000001', stepId: 'login', captureName: 'token' },
              { kind: 'status', uid: 'cl000002', stepId: 'health', match: '2xx' },
            ],
          },
        },
      ],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'login', newId: 'auth' });
    expect(out.steps[1].runIf?.all[0].stepId).toBe('auth');
    expect(out.steps[1].runIf?.all[1].stepId).toBe('health');
  });

  it('rewrites priorityFrom.stepId when it matches', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'aaaaaaaa', id: 'login', requestUid: 'req-a', captures: [] },
        {
          uid: 'bbbbbbbb',
          id: 'fetch',
          requestUid: 'req-b',
          captures: [],
          priorityFrom: { stepId: 'login', captureName: 'priority' },
        },
      ],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'login', newId: 'auth' });
    expect(out.steps[1].priorityFrom?.stepId).toBe('auth');
  });

  it('rewrites refresh.stepId when refresh.kind is expires-in or expires-at', () => {
    const draft = makeDraft({
      refresh: { kind: 'expires-in', stepId: 'login', captureName: 'expiresIn', leadSeconds: 30 },
      steps: [{ uid: 'aaaaaaaa', id: 'login', requestUid: 'req-a', captures: [] }],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'login', newId: 'auth' });
    expect(out.refresh).toEqual({ kind: 'expires-in', stepId: 'auth', captureName: 'expiresIn', leadSeconds: 30 });
  });

  it('leaves refresh untouched when refresh.kind is interval / manual', () => {
    const draft = makeDraft({
      refresh: { kind: 'interval', seconds: 60 },
      steps: [{ uid: 'aaaaaaaa', id: 'login', requestUid: 'req-a', captures: [] }],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'login', newId: 'auth' });
    expect(out.refresh).toBe(draft.refresh);
  });

  it('does not touch the renamed step itself even if its dependsOn coincidentally contains oldId', () => {
    // A self-reference would be a cycle the validator already rejects;
    // we still don't rewrite it because the caller already updated the
    // step's own id, and rewriting its dependsOn would mask the cycle.
    const draft = makeDraft({
      steps: [{ uid: 'aaaaaaaa', id: 'auth', requestUid: 'req-a', captures: [], dependsOn: ['login'] }],
    });
    const out = rebindStepReferences({ draft, targetUid: 'aaaaaaaa', oldId: 'login', newId: 'auth' });
    expect(out.steps[0].dependsOn).toEqual(['login']);
  });
});
