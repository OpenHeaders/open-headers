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
 *   - appendDraftStep / nextStepId give a seeded call its defaults
 *     with collision-safe ids.
 *   - removeDraftStep mirrors the form's remove button: last step
 *     stays, dangling references are left for the validator.
 *   - duplicateDraftStep puts a copy last, bound to no other step — it
 *     waits on none, with no run condition and no priority, but for the
 *     listen and the trigger a send and a wait cannot be without —
 *     under fresh uids and with no capture exposed.
 *   - stepIdFromName / addPickedStep: the step picker's row as the
 *     workflow's last step, named after its request, armed by the step
 *     it is added after.
 */

import { callStepsOf, type DraftCallStep, type DraftWorkflow } from '@openheaders/core/live';
import type { ExpectWorkflowStep, ListenWorkflowStep, SendWorkflowStep } from '@openheaders/core/types';
import {
  addGraphDependency,
  addPickedStep,
  appendDraftStep,
  duplicateDraftStep,
  nextStepId,
  removeDraftStep,
  removeGraphDependency,
  stepIdFromName,
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

  it('waits on no step, written out — whatever the original waits on, by name or as the step after another', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c', { dependsOn: ['a'] })]);
    expect(stepAt(duplicateDraftStep(draft, draft.steps[1].uid)?.draft ?? null, 3).dependsOn).toEqual([]);
    expect(stepAt(duplicateDraftStep(draft, draft.steps[2].uid)?.draft ?? null, 3).dependsOn).toEqual([]);
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

  it('carries no run condition and no priority', () => {
    const original = mkStep('a', {
      runIf: { all: [{ uid: 'gatstat0', kind: 'status', stepId: 'root', match: '2xx' }] },
      priorityFrom: { stepId: 'root', captureName: 'rank' },
    });
    const draft = mkDraft([mkStep('root'), original]);
    const { uid: _uid, id: _id, runIf: _gate, priorityFrom: _order, ...own } = original;
    expect(duplicateDraftStep(draft, original.uid)?.draft.steps[2]).toEqual({
      ...own,
      uid: expect.any(String),
      id: 'a-copy',
      dependsOn: [],
    });
  });

  it('gives what the copy holds fresh uids, and exposes none of its captures', () => {
    const original = mkStep('a', {
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
    expect(copy.successCriteria).toEqual([{ kind: 'status', uid: expect.any(String), match: '2xx' }]);
    expect(copy.successCriteria?.[0].uid).not.toBe('crtstat0');
    expect(copy.captures).toEqual([
      { uid: expect.any(String), name: 'token', extractor: { kind: 'whole-body' }, exposed: false, liveName: 'token' },
    ]);
    expect(copy.captures[0].uid).not.toBe('captoken');
  });

  describe('a send and a wait stay on their session', () => {
    const listen: ListenWorkflowStep = {
      uid: 'stplistn',
      id: 'probe',
      action: 'listen',
      sessionRequestUid: 'mqttreq1',
      timeoutMs: 10_000,
      captures: [],
    };
    const reboot = mkStep('reboot', { dependsOn: ['probe'] });
    const send: SendWorkflowStep = {
      uid: 'stpsendx',
      id: 'ask',
      action: 'send',
      on: 'probe',
      messageUid: 'msgask01',
      dependsOn: ['reboot'],
      runIf: { all: [{ uid: 'gatstat1', kind: 'status', stepId: 'reboot', match: '2xx' }] },
      captures: [],
    };
    const wait: ExpectWorkflowStep = {
      uid: 'stpexpct',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      match: [],
      timeoutMs: 10_000,
      dependsOn: ['ask'],
      priorityFrom: { stepId: 'reboot', captureName: 'rank' },
      captures: [],
    };
    const draft: DraftWorkflow = {
      name: 'Reboot',
      description: '',
      steps: [listen, reboot, send, wait],
      refresh: { kind: 'manual' },
      enabled: true,
    };
    const copyOf = (from: DraftWorkflow, stepUid: string) => duplicateDraftStep(from, stepUid)?.draft.steps.at(-1);

    it('a listen’s copy waits on no step', () => {
      expect(copyOf(draft, listen.uid)).toEqual({
        ...listen,
        uid: expect.any(String),
        id: 'probe-copy',
        dependsOn: [],
      });
    });

    it('a send’s copy waits on the listen it is on, and on that alone', () => {
      const { runIf: _gate, ...own } = send;
      expect(copyOf(draft, send.uid)).toEqual({
        ...own,
        uid: expect.any(String),
        id: 'ask-copy',
        dependsOn: ['probe'],
      });
    });

    it('a wait’s copy waits on its listen and on its trigger, in the workflow’s order', () => {
      const { priorityFrom: _order, ...own } = wait;
      expect(copyOf(draft, wait.uid)).toEqual({
        ...own,
        uid: expect.any(String),
        id: 'status-copy',
        dependsOn: ['probe', 'reboot'],
      });
    });

    it('a name that is no step is left out of what the copy waits on', () => {
      const lost: DraftWorkflow = { ...draft, steps: [listen, reboot, { ...wait, on: 'ghost' }] };
      expect(copyOf(lost, wait.uid)).toMatchObject({ on: 'ghost', after: 'reboot', dependsOn: ['reboot'] });
    });
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

describe('stepIdFromName', () => {
  it('keeps a name’s letters and digits in lower case, every run of anything else one hyphen', () => {
    expect(stepIdFromName([], 'Reboot dev-1')).toBe('reboot-dev-1');
    expect(stepIdFromName([], '  GET /users/{id}  ')).toBe('get-users-id');
    expect(stepIdFromName([], 'refresh_token')).toBe('refresh_token');
  });

  it('starts with a letter or an underscore, whatever the name starts with', () => {
    expect(stepIdFromName([], '2FA login')).toBe('step-2fa-login');
  });

  it('falls back to the next step<n> for a name that leaves nothing', () => {
    expect(stepIdFromName([mkStep('a')], 'Получить токен')).toBe('step2');
    expect(stepIdFromName([], '')).toBe('step1');
  });

  it('counts up from 2 past the ids already taken', () => {
    expect(stepIdFromName([mkStep('login')], 'Login')).toBe('login-2');
    expect(stepIdFromName([mkStep('login'), mkStep('login-2')], 'Login')).toBe('login-3');
  });

  it('keeps sixty characters of a long name, and ends on none of its hyphens', () => {
    const id = stepIdFromName([], `${'a'.repeat(59)} ${'b'.repeat(20)}`);
    expect(id).toBe('a'.repeat(59));
  });
});

describe('addPickedStep', () => {
  const listen: ListenWorkflowStep = {
    uid: 'stplistn',
    id: 'probe',
    action: 'listen',
    sessionRequestUid: 'mqttreq1',
    timeoutMs: 10_000,
    captures: [],
  };
  const sessionDraft = (steps: DraftWorkflow['steps']): DraftWorkflow => ({
    name: 'Reboot',
    description: '',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
  });

  it('a kind taken is the workflow’s last step with nothing picked, waiting on the step before it', () => {
    const draft = mkDraft([mkStep('step1')]);
    const added = addPickedStep(draft, { kind: 'action', action: 'call' });
    expect(added.draft.steps).toHaveLength(2);
    expect(added.draft.steps[1]).toEqual({ uid: added.stepUid, id: 'step2', requestUid: '', captures: [] });
    expect(added.draft.steps[0]).toBe(draft.steps[0]);
  });

  it('a request taken is a call on it, named after it', () => {
    const added = addPickedStep(mkDraft([mkStep('a')]), { kind: 'request', uid: 'reqreboo', name: 'Reboot dev-1' });
    expect(added.draft.steps[1]).toEqual({
      uid: added.stepUid,
      id: 'reboot-dev-1',
      requestUid: 'reqreboo',
      captures: [],
    });
  });

  it('a session request taken is a listen on it, and the workflow is run by hand from then on', () => {
    const draft: DraftWorkflow = { ...mkDraft([mkStep('a')]), refresh: { kind: 'interval', seconds: 60 } };
    const added = addPickedStep(draft, { kind: 'session-request', uid: 'mqttreq1', name: 'Probe MQTT' });
    expect(added.draft.steps[1]).toEqual({
      uid: added.stepUid,
      id: 'probe-mqtt',
      action: 'listen',
      sessionRequestUid: 'mqttreq1',
      timeoutMs: 10_000,
      captures: [],
    });
    expect(added.draft.refresh).toEqual({ kind: 'manual' });
  });

  it('a wait taken carries the arming its kind selector gives: on the listen above, after the step before', () => {
    const added = addPickedStep(sessionDraft([listen, mkStep('reboot')]), { kind: 'action', action: 'expect' });
    expect(added.draft.steps[2]).toMatchObject({ id: 'step3', action: 'expect', on: 'probe', after: 'reboot' });
    expect(added.draft.steps[2]).not.toHaveProperty('dependsOn');
  });

  it('a step added after another is last, and waits on that one by name', () => {
    const draft = mkDraft([mkStep('a'), mkStep('b'), mkStep('c')]);
    const added = addPickedStep(draft, { kind: 'request', uid: 'reqlogin', name: 'Login' }, 'a');
    expect(added.draft.steps.slice(0, 3)).toEqual(draft.steps);
    expect(stepAt(added.draft, 3)).toMatchObject({ id: 'login', requestUid: 'reqlogin', dependsOn: ['a'] });
  });

  it('a wait added after a step waits after that step, on the session that step is part of', () => {
    const other: ListenWorkflowStep = { ...listen, uid: 'stplist2', id: 'audit', dependsOn: [] };
    const draft = sessionDraft([
      listen,
      { uid: 'stpsend0', id: 'rename', action: 'send', on: 'probe', captures: [] },
      other,
      mkStep('last', { dependsOn: ['audit'] }),
    ]);
    const added = addPickedStep(draft, { kind: 'action', action: 'expect' }, 'rename');
    expect(added.draft.steps[4]).toMatchObject({
      action: 'expect',
      on: 'probe',
      after: 'rename',
      dependsOn: ['rename'],
    });
  });

  it('a send added after a listen is on that listen; after a call it keeps the listen above it', () => {
    const draft = sessionDraft([listen, mkStep('reboot')]);
    expect(addPickedStep(draft, { kind: 'action', action: 'send' }, 'probe').draft.steps[2]).toMatchObject({
      action: 'send',
      on: 'probe',
      dependsOn: ['probe'],
    });
    expect(addPickedStep(draft, { kind: 'action', action: 'expect' }, 'reboot').draft.steps[2]).toMatchObject({
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      dependsOn: ['reboot'],
    });
  });
});
