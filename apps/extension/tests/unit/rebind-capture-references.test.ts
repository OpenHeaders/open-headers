import { callStepsOf, type DraftWorkflow } from '@openheaders/core/live';
import type { ExpectWorkflowStep } from '@openheaders/core/types';
import { rebindCaptureReferences } from '@openheaders/ui/workbench/components/live/rebind-capture-references';
import { describe, expect, it } from 'vitest';

/** The draft's call step at an index — every step of these fixtures is one. */
const stepAt = (draft: DraftWorkflow | null, index: number) => callStepsOf(draft ?? { steps: [] })[index];

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
    const clauses = stepAt(out, 1).runIf?.all ?? [];
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
    const clause = stepAt(out, 1).runIf?.all[0];
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
    expect(stepAt(out, 1).priorityFrom?.captureName).toBe('rank');
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

  it('follows a renamed capture into an expect’s topic filter and a criterion’s value', () => {
    const expectStep: ExpectWorkflowStep = {
      uid: 'stpexpct',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      address: 'devices/{{step.reboot.id}}/status',
      match: [
        {
          kind: 'equals',
          uid: 'crtcmd00',
          extractor: { kind: 'json-path', path: '$.commandId' },
          value: '{{step.reboot.id}}',
        },
        {
          kind: 'equals',
          uid: 'crtname0',
          extractor: { kind: 'json-path', path: '$.name' },
          value: '{{step.probe.id}}',
        },
      ],
      timeoutMs: 10_000,
      captures: [],
    };
    const draft = makeDraft({
      steps: [{ uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] }, expectStep],
    });
    const out = rebindCaptureReferences({ draft, ownerStepId: 'reboot', oldName: 'id', newName: 'commandId' });
    expect(out.steps[1]).toEqual({
      ...expectStep,
      address: 'devices/{{step.reboot.commandId}}/status',
      match: [{ ...expectStep.match[0], value: '{{step.reboot.commandId}}' }, expectStep.match[1]],
    });
    expect(out.steps[0]).toBe(draft.steps[0]);
  });
});
