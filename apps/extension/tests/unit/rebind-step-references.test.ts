import { callStepsOf, type DraftCallStep, type DraftWorkflow } from '@openheaders/core/live';
import type { Criterion, ExpectWorkflowStep, ListenWorkflowStep, SendWorkflowStep } from '@openheaders/core/types';
import { rebindStepReferences } from '@openheaders/ui/workbench/components/live/rebind-step-references';
import { describe, expect, it } from 'vitest';

/** The draft's call step at an index — every step of these fixtures is one. */
const stepAt = (draft: DraftWorkflow | null, index: number) => callStepsOf(draft ?? { steps: [] })[index];

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
    expect(stepAt(out, 1).dependsOn).toEqual(['auth', 'other']);
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
    expect(stepAt(out, 1).runIf?.all[0].stepId).toBe('auth');
    expect(stepAt(out, 1).runIf?.all[1].stepId).toBe('health');
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
    expect(stepAt(out, 1).priorityFrom?.stepId).toBe('auth');
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
    expect(stepAt(out, 0).dependsOn).toEqual(['login']);
  });

  // ── A session step's own references ─────────────────────────────

  const LISTEN: ListenWorkflowStep = {
    uid: 'stplistn',
    id: 'probe',
    action: 'listen',
    sessionRequestUid: 'mqttreq1',
    timeoutMs: 10_000,
    captures: [],
  };
  const CALL: DraftCallStep = { uid: 'stpcall0', id: 'reboot', requestUid: 'httpreq1', captures: [] };
  const SEND: SendWorkflowStep = {
    uid: 'stpsend0',
    id: 'rename',
    action: 'send',
    on: 'probe',
    messageUid: 'msgname1',
    captures: [],
  };
  const EXPECT: ExpectWorkflowStep = {
    uid: 'stpexpct',
    id: 'status',
    action: 'expect',
    on: 'probe',
    after: 'reboot',
    address: 'devices/{{step.reboot.deviceId}}/status',
    match: [
      {
        kind: 'equals',
        uid: 'crtcmd00',
        extractor: { kind: 'json-path', path: '$.commandId' },
        value: '{{step.reboot.commandId}}',
      },
      { kind: 'exists', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' } },
    ],
    timeoutMs: 10_000,
    captures: [],
  };

  it('follows a renamed listen into the On of a send and of an expect', () => {
    const draft = makeDraft({ steps: [{ ...LISTEN, id: 'device' }, CALL, SEND, EXPECT] });
    const out = rebindStepReferences({ draft, targetUid: 'stplistn', oldId: 'probe', newId: 'device' });
    expect(out.steps[2]).toEqual({ ...SEND, on: 'device' });
    expect(out.steps[3]).toEqual({ ...EXPECT, on: 'device' });
    expect(out.steps[1]).toBe(draft.steps[1]);
  });

  it('follows a renamed trigger into an expect’s After, its topic filter and a criterion’s value', () => {
    const draft = makeDraft({ steps: [LISTEN, { ...CALL, id: 'restart' }, EXPECT] });
    const out = rebindStepReferences({ draft, targetUid: 'stpcall0', oldId: 'reboot', newId: 'restart' });
    expect(out.steps[2]).toEqual({
      ...EXPECT,
      after: 'restart',
      address: 'devices/{{step.restart.deviceId}}/status',
      match: [{ ...EXPECT.match[0], value: '{{step.restart.commandId}}' }, EXPECT.match[1]],
    });
  });

  it('follows a renamed step into the value of a call’s success criterion', () => {
    const criterion: Criterion = {
      kind: 'equals',
      uid: 'crtname0',
      extractor: { kind: 'json-path', path: '$.name' },
      value: '{{step.reboot.name}}',
    };
    const polled: DraftCallStep = {
      uid: 'stppoll0',
      id: 'poll',
      requestUid: 'httpreq2',
      captures: [],
      successCriteria: [criterion],
    };
    const draft = makeDraft({ steps: [{ ...CALL, id: 'restart' }, polled] });
    const out = rebindStepReferences({ draft, targetUid: 'stpcall0', oldId: 'reboot', newId: 'restart' });
    expect(stepAt(out, 1).successCriteria).toEqual([{ ...criterion, value: '{{step.restart.name}}' }]);
  });

  it('returns the input draft when no session step names the renamed one', () => {
    const draft = makeDraft({ steps: [LISTEN, CALL, SEND, EXPECT] });
    expect(rebindStepReferences({ draft, targetUid: 'zzzzzzzz', oldId: 'other', newId: 'another' })).toBe(draft);
  });
});
