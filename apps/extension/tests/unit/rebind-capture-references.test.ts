import type { DraftWorkflow } from '@openheaders/core/live';
import { describe, expect, it } from 'vitest';
import { rebindCaptureReferences } from '@/workbench/components/live/rebind-capture-references';

function makeDraft(overrides: Partial<DraftWorkflow> = {}): DraftWorkflow {
  return {
    name: 'wf',
    description: '',
    enabled: true,
    refresh: { kind: 'manual' },
    steps: [],
    ...overrides,
  };
}

describe('rebindCaptureReferences', () => {
  it('returns the input draft unchanged when oldName === newName', () => {
    const draft = makeDraft();
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'token', newName: 'token' });
    expect(out).toBe(draft);
  });

  it('rewrites capture-exists clauses on other steps that match the (stepId, captureName) pair', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'step0001', id: 'login', requestUid: 'reqaaaa1', captures: [] },
        {
          uid: 'step0002',
          id: 'fetch',
          requestUid: 'reqbbbb1',
          captures: [],
          runIf: {
            all: [
              { kind: 'capture-exists', uid: 'cl000001', stepId: 'login', captureName: 'token' },
              { kind: 'capture-exists', uid: 'cl000002', stepId: 'login', captureName: 'other' },
            ],
          },
        },
      ],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'token', newName: 'access_token' });
    const clauses = out.steps[1].runIf?.all ?? [];
    expect(clauses[0].kind === 'capture-exists' && clauses[0].captureName).toBe('access_token');
    expect(clauses[1].kind === 'capture-exists' && clauses[1].captureName).toBe('other');
  });

  it('does not rewrite clauses whose stepId does not match the owner step', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'step0001', id: 'login', requestUid: 'reqaaaa1', captures: [] },
        {
          uid: 'step0002',
          id: 'fetch',
          requestUid: 'reqbbbb1',
          captures: [],
          runIf: {
            all: [{ kind: 'capture-equals', uid: 'cl000001', stepId: 'other', captureName: 'token', value: 'x' }],
          },
        },
      ],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'token', newName: 'access_token' });
    const clause = out.steps[1].runIf?.all[0];
    expect(clause?.kind === 'capture-equals' && clause.captureName).toBe('token');
  });

  it('rewrites priorityFrom.captureName when stepId matches', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'step0001', id: 'login', requestUid: 'reqaaaa1', captures: [] },
        {
          uid: 'step0002',
          id: 'fetch',
          requestUid: 'reqbbbb1',
          captures: [],
          priorityFrom: { stepId: 'login', captureName: 'priority' },
        },
      ],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'priority', newName: 'rank' });
    expect(out.steps[1].priorityFrom?.captureName).toBe('rank');
  });

  it('rewrites refresh.captureName for expires-in / expires-at when stepId matches', () => {
    const draft = makeDraft({
      refresh: { kind: 'expires-at', stepId: 'login', captureName: 'exp', leadSeconds: 30 },
      steps: [{ uid: 'step0001', id: 'login', requestUid: 'reqaaaa1', captures: [] }],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'exp', newName: 'expires_at' });
    expect(out.refresh).toEqual({ kind: 'expires-at', stepId: 'login', captureName: 'expires_at', leadSeconds: 30 });
  });

  it('leaves status clauses untouched (no captureName)', () => {
    const draft = makeDraft({
      steps: [
        { uid: 'step0001', id: 'login', requestUid: 'reqaaaa1', captures: [] },
        {
          uid: 'step0002',
          id: 'fetch',
          requestUid: 'reqbbbb1',
          captures: [],
          runIf: {
            all: [{ kind: 'status', uid: 'cl000001', stepId: 'login', match: '2xx' }],
          },
        },
      ],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'token', newName: 'access_token' });
    expect(out).toBe(draft);
  });

  it('returns the input draft when no reference matches', () => {
    const draft = makeDraft({
      steps: [{ uid: 'step0001', id: 'login', requestUid: 'reqaaaa1', captures: [] }],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'login', oldName: 'unrelated', newName: 'whatever' });
    expect(out).toBe(draft);
  });
});
