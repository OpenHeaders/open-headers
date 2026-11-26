/**
 * A step's action in the workflow form (the workflow runs plan,
 * Decisions log, S16): what changing it keeps and drops, the defaults
 * that carry the arming, and what a workflow's first session step does
 * to its refresh and its captures.
 */

import type { DraftCallStep, DraftWorkflow } from '@openheaders/core/live';
import type { ListenWorkflowStep, MqttRequest } from '@openheaders/core/types';
import {
  DEFAULT_SESSION_TIMEOUT_MS,
  sessionRequestOf,
  stepActionOf,
  withStepAction,
} from '@openheaders/ui/workbench/components/live/step-action';
import { describe, expect, it } from 'vitest';

const LISTEN: ListenWorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 5_000,
  captures: [],
};

function call(uid: string, id: string, overrides: Partial<DraftCallStep> = {}): DraftCallStep {
  return { uid, id, requestUid: 'httpreq1', captures: [], ...overrides };
}

function draftOf(steps: DraftWorkflow['steps'], overrides: Partial<DraftWorkflow> = {}): DraftWorkflow {
  return { name: 'Reboot', description: '', steps, refresh: { kind: 'manual' }, enabled: true, ...overrides };
}

describe('withStepAction', () => {
  it('keeps the id, description, dependencies and run condition, and drops the rest', () => {
    const step = call('stpcall0', 'reboot', {
      description: 'Ask the device to reboot',
      dependsOn: ['probe'],
      runIf: { all: [{ kind: 'status', uid: 'gate0001', stepId: 'probe', match: '2xx' }] },
      priorityFrom: { stepId: 'probe', captureName: 'rank' },
      retry: { maxAttempts: 3 },
      captures: [
        { uid: 'capcmd00', name: 'commandId', extractor: { kind: 'whole-body' }, exposed: false, liveName: '' },
      ],
    });
    const out = withStepAction(draftOf([LISTEN, step]), 1, 'send');
    expect(out.steps[1]).toEqual({
      uid: 'stpcall0',
      id: 'reboot',
      description: 'Ask the device to reboot',
      dependsOn: ['probe'],
      runIf: step.runIf,
      action: 'send',
      on: 'probe',
      captures: [],
    });
  });

  it('starts a listen with no request and the session’s deadline', () => {
    const out = withStepAction(draftOf([call('stpcall0', 'step1')]), 0, 'listen');
    expect(out.steps[0]).toEqual({
      uid: 'stpcall0',
      id: 'step1',
      action: 'listen',
      sessionRequestUid: '',
      timeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
      captures: [],
    });
  });

  it('puts a send and an expect on the nearest listen above, and an expect after the step before it', () => {
    const later: ListenWorkflowStep = { ...LISTEN, uid: 'stplist2', id: 'second' };
    const steps = [LISTEN, call('stpcall0', 'reboot'), later, call('stpcall1', 'again'), call('stpcall2', 'status')];
    expect(withStepAction(draftOf(steps), 1, 'send').steps[1]).toMatchObject({ action: 'send', on: 'probe' });
    expect(withStepAction(draftOf(steps), 4, 'expect').steps[4]).toEqual({
      uid: 'stpcall2',
      id: 'status',
      action: 'expect',
      on: 'second',
      after: 'again',
      match: [],
      timeoutMs: DEFAULT_SESSION_TIMEOUT_MS,
      captures: [],
    });
  });

  it('leaves On empty where no listen is above', () => {
    const out = withStepAction(draftOf([call('stpcall0', 'reboot'), LISTEN]), 0, 'send');
    expect(out.steps[0]).toMatchObject({ action: 'send', on: '' });
  });

  it('turns a session step back into a call with no request', () => {
    const out = withStepAction(draftOf([LISTEN]), 0, 'call');
    expect(out.steps[0]).toEqual({ uid: 'stplistn', id: 'probe', requestUid: '', captures: [] });
  });

  it('returns the same draft when the step already has the action', () => {
    const draft = draftOf([LISTEN, call('stpcall0', 'reboot')]);
    expect(withStepAction(draft, 0, 'listen')).toBe(draft);
    expect(withStepAction(draft, 1, 'call')).toBe(draft);
  });

  it('takes no action onto a step of an action the model does not know', () => {
    const draft = draftOf([{ uid: 'stpwatch', id: 'probe', action: 'watch' }]);
    expect(withStepAction(draft, 0, 'listen')).toBe(draft);
  });
});

describe('a workflow’s first session step', () => {
  const bound = { uid: 'capbound', name: 'token', extractor: { kind: 'whole-body' as const } };
  const fresh = { uid: 'capfresh', name: 'expiry', extractor: { kind: 'whole-body' as const } };

  it('sets the refresh to manual, and exposes no capture a live variable does not hold yet', () => {
    const login = call('stpcall0', 'login', {
      captures: [
        { ...bound, exposed: true, liveName: 'token', liveUid: 'lvtoken1' },
        { ...fresh, exposed: true, liveName: 'expiry' },
      ],
    });
    const draft = draftOf([login, call('stpcall1', 'step2')], { refresh: { kind: 'interval', seconds: 300 } });
    const out = withStepAction(draft, 1, 'listen');
    expect(out.refresh).toEqual({ kind: 'manual' });
    expect(out.steps[0]).toEqual({
      ...login,
      captures: [
        { ...bound, exposed: true, liveName: 'token', liveUid: 'lvtoken1' },
        { ...fresh, exposed: false, liveName: 'expiry' },
      ],
    });
  });

  it('is the first alone: a later one changes neither', () => {
    const login = call('stpcall0', 'login', { captures: [{ ...fresh, exposed: true, liveName: 'expiry' }] });
    const draft = draftOf([LISTEN, login, call('stpcall1', 'step3')], { refresh: { kind: 'interval', seconds: 300 } });
    const out = withStepAction(draft, 2, 'send');
    expect(out.refresh).toBe(draft.refresh);
    expect(out.steps[1]).toBe(login);
  });
});

describe('the lookups', () => {
  it('name a step’s action', () => {
    expect(stepActionOf(LISTEN)).toBe('listen');
    expect(stepActionOf(call('stpcall0', 'reboot'))).toBe('call');
  });

  it('find the request a listen opens, and none for a step that is not a listen', () => {
    const request: MqttRequest = {
      schemaVersion: 5,
      uid: 'mqttreq1',
      path: 'api-requests/probe-mqttreq1',
      name: 'Probe MQTT',
      url: 'ws://openheaders.io/mqtt',
      topic: '',
      payload: '',
      topics: [],
      savedMessages: [],
      userProperties: [],
    };
    const steps = [LISTEN, call('stpcall0', 'reboot')];
    expect(sessionRequestOf(steps, 'probe', [request])).toBe(request);
    expect(sessionRequestOf(steps, 'reboot', [request])).toBeUndefined();
    expect(sessionRequestOf(steps, 'probe', [])).toBeUndefined();
  });
});
