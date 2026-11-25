/**
 * The tolerant reader, reader by reader (the workflow runs plan, Laws —
 * "A tolerant reader ships first").
 *
 * One workflow throughout, as a newer build would write it: a `listen`
 * with no `captures`, a call, an `expect`. Every core reader keeps the
 * two steps it does not know as they are, passes them by, and says the
 * workflow needs a newer version — none throws, none reads one as a call.
 */

import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { effectiveDependsOn } from '../../src/live/chain-runner';
import { detectCycles } from '../../src/live/cycle-detect';
import { draftFromWorkflow, planLiveVariableReconcile, stripDraftSteps } from '../../src/live/editor-draft';
import {
  computeTransitiveAncestors,
  validateStepReferences,
  validateStepRequestsExist,
  validateWorkflowShape,
} from '../../src/live/step-validation';
import {
  callStepsOf,
  isRunnableWorkflow,
  isUnknownStep,
  unknownStepMessage,
  unknownStepsOf,
} from '../../src/live/unknown-step';
import { workflowDefinitionFingerprint } from '../../src/live/workflow-scan';
import { isWorkflowComplete, isWorkflowEffective, workflowNeedsUpdate } from '../../src/live/workflow-state';
import { LiveWorkflowSchema, WorkflowStepSchema } from '../../src/schemas/live';
import type { LiveVariable, LiveWorkflow } from '../../src/types/live';

const LISTEN = { uid: 'stplistn', id: 'probe', action: 'listen', session: 'mqttreq1' };
const CALL = {
  uid: 'stpcall0',
  id: 'reboot',
  requestUid: 'httpreq1',
  captures: [{ uid: 'capcmd00', name: 'commandId', extractor: { kind: 'json-path', path: '$.id' } }],
};
const EXPECT = {
  uid: 'stpexpct',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  captures: [],
};

function raw(steps: unknown[] = [LISTEN, CALL, EXPECT], overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 5,
    uid: 'wfdevice',
    path: 'live-workflows/reboot-wfdevice',
    name: 'Reboot',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
    ...overrides,
  };
}

function scenario(steps?: unknown[], overrides?: Record<string, unknown>): LiveWorkflow {
  return v.parse(LiveWorkflowSchema, raw(steps, overrides));
}

describe('the step schema', () => {
  it('keeps a step it does not know whole — the listen written without captures included', () => {
    expect(scenario().steps).toEqual([LISTEN, CALL, EXPECT]);
  });

  it('never reads a step with an unknown action as a call, whatever else it carries', () => {
    const both = { ...CALL, action: 'listen' };
    const [step] = scenario([both]).steps;
    expect(step).toEqual(both);
    expect(isUnknownStep(step)).toBe(true);
  });

  it('reads an absent action, and the action "call", as a call', () => {
    const [absent, named] = scenario([CALL, { ...CALL, uid: 'stpcall1', id: 'again', action: 'call' }]).steps;
    expect(isUnknownStep(absent)).toBe(false);
    expect(isUnknownStep(named)).toBe(false);
  });

  it('asks a step it does not know for its uid, id and action alone', () => {
    expect(v.safeParse(WorkflowStepSchema, { id: 'probe', action: 'listen' }).success).toBe(false);
    expect(v.safeParse(WorkflowStepSchema, { uid: 'stplistn', action: 'listen' }).success).toBe(false);
    expect(v.safeParse(WorkflowStepSchema, { uid: 'stplistn', id: 'probe', action: '' }).success).toBe(false);
    expect(v.safeParse(WorkflowStepSchema, { uid: 'stplistn', id: 'probe', action: 'listen' }).success).toBe(true);
  });

  it('names the field of a malformed call step, as it did before', () => {
    const broken = { ...CALL, captures: [{ ...CALL.captures[0], name: '9lives' }] };
    const result = v.safeParse(LiveWorkflowSchema, raw([LISTEN, broken]));
    expect(result.success).toBe(false);
    expect(result.issues?.map((issue) => v.getDotPath(issue))).toEqual(['steps.1.captures.0.name']);
  });

  it('still refuses a call step with no request', () => {
    const result = v.safeParse(LiveWorkflowSchema, raw([{ uid: 'stpcall0', id: 'reboot', captures: [] }]));
    expect(result.issues?.map((issue) => v.getDotPath(issue))).toEqual(['steps.0.requestUid']);
  });
});

describe('the predicate', () => {
  it('tells the steps apart', () => {
    const workflow = scenario();
    expect(workflow.steps.map(isUnknownStep)).toEqual([true, false, true]);
    expect(unknownStepsOf(workflow).map((step) => [step.id, step.action])).toEqual([
      ['probe', 'listen'],
      ['status', 'expect'],
    ]);
    expect(callStepsOf(workflow).map((step) => step.requestUid)).toEqual(['httpreq1']);
  });

  it('says a workflow needs a newer version when it holds one such step', () => {
    expect(workflowNeedsUpdate(scenario())).toBe(true);
    expect(workflowNeedsUpdate(scenario([CALL]))).toBe(false);
  });

  it('answers false for a malformed row instead of throwing', () => {
    expect(workflowNeedsUpdate({ ...scenario(), steps: null } as unknown as LiveWorkflow)).toBe(false);
    expect(workflowNeedsUpdate({ ...scenario(), steps: [null] } as unknown as LiveWorkflow)).toBe(false);
  });

  it('holds a workflow runnable only when every step is known', () => {
    expect(isRunnableWorkflow(scenario())).toBe(false);
    expect(isRunnableWorkflow(scenario([CALL]))).toBe(true);
  });

  it('names the step and its action in the one sentence', () => {
    const [listen] = unknownStepsOf(scenario());
    expect(unknownStepMessage(listen)).toBe('Step "probe" needs a newer version of OpenHeaders (action "listen").');
  });
});

describe('the validators', () => {
  it('report each unknown step as an issue of its own and nothing else', () => {
    expect(validateWorkflowShape(scenario())).toEqual([
      {
        issue: 'step-needs-update',
        stepId: 'probe',
        message: 'Step "probe" needs a newer version of OpenHeaders (action "listen").',
      },
      {
        issue: 'step-needs-update',
        stepId: 'status',
        message: 'Step "status" needs a newer version of OpenHeaders (action "expect").',
      },
    ]);
  });

  it('look for the call step’s request alone', () => {
    const workflow = scenario();
    expect(validateStepRequestsExist(workflow, new Set(['httpreq1']))).toEqual([]);
    expect(validateStepRequestsExist(workflow, new Set()).map((error) => [error.issue, error.stepId])).toEqual([
      ['step-request-missing', 'reboot'],
    ]);
  });

  it('ask the request registry for the call step alone', () => {
    const requestInfo = vi.fn(() => ({ templates: [], incompleteReason: null }));
    expect(validateStepReferences(scenario(), requestInfo)).toEqual([]);
    expect(requestInfo.mock.calls).toEqual([['httpreq1']]);
  });

  it('do not judge a capture named on a step they do not know', () => {
    const workflow = scenario(undefined, {
      refresh: { kind: 'expires-in', stepId: 'status', captureName: 'ttl', leadSeconds: 0 },
    });
    expect(validateWorkflowShape(workflow).map((error) => error.issue)).toEqual([
      'step-needs-update',
      'step-needs-update',
    ]);
  });

  it('still catch a duplicate id an unknown step shares', () => {
    const workflow = scenario([LISTEN, { ...CALL, id: 'probe' }]);
    expect(validateWorkflowShape(workflow).map((error) => error.issue)).toEqual(
      expect.arrayContaining(['step-needs-update', 'duplicate-step-id']),
    );
  });
});

describe('completeness', () => {
  it('stays false, so the workflow is never scheduled and never effective', () => {
    expect(isWorkflowComplete(scenario())).toBe(false);
    expect(isWorkflowEffective(scenario())).toBe(false);
  });
});

describe('the dependency rule', () => {
  it('reads an unknown step as depending on the step before it, its own keys unread', () => {
    const workflow = scenario([CALL, { ...LISTEN, dependsOn: [] }, EXPECT]);
    expect(workflow.steps.map((step, index) => effectiveDependsOn(step, index, workflow))).toEqual([
      [],
      ['reboot'],
      ['probe'],
    ]);
  });

  it('lets a call step follow one', () => {
    expect(computeTransitiveAncestors(scenario()).get('reboot')).toEqual(new Set(['probe']));
  });
});

describe('the editor draft', () => {
  it('carries unknown steps as they are, there and back', () => {
    const workflow = scenario();
    const draft = draftFromWorkflow(workflow, []);
    expect(draft.steps[0]).toBe(workflow.steps[0]);
    expect(draft.steps[2]).toBe(workflow.steps[2]);
    expect(stripDraftSteps(draft.steps)).toEqual(workflow.steps);
  });

  it('plans live variables from the call step alone', () => {
    const workflow = scenario();
    const bound: LiveVariable = {
      schemaVersion: 5,
      uid: 'lvstatus',
      path: 'live-variables/state-lvstatus',
      name: 'state',
      workflowUid: workflow.uid,
      stepId: 'status',
      captureName: 'state',
      enabled: true,
    };
    const draft = draftFromWorkflow(workflow, [bound]);
    expect(planLiveVariableReconcile(workflow.uid, draft, [bound])).toEqual({ creates: [], updates: [], deletes: [] });
  });
});

describe('the definition fingerprint', () => {
  it('takes an unknown step whole — any change to it is a change', () => {
    const before = workflowDefinitionFingerprint(scenario());
    expect(workflowDefinitionFingerprint(scenario())).toBe(before);
    const moved = scenario([LISTEN, CALL, { ...EXPECT, address: 'devices/dev-2/status' }]);
    expect(workflowDefinitionFingerprint(moved)).not.toBe(before);
  });
});

describe('the live-variable cycle detector', () => {
  it('asks for the call step’s templates alone', () => {
    const workflow = scenario();
    const variable: LiveVariable = {
      schemaVersion: 5,
      uid: 'lvcmdid0',
      path: 'live-variables/command-lvcmdid0',
      name: 'command',
      workflowUid: workflow.uid,
      stepId: 'reboot',
      captureName: 'commandId',
      enabled: true,
    };
    const requestTemplates = vi.fn(() => []);
    expect(detectCycles([variable], [workflow], requestTemplates)).toEqual([]);
    expect(requestTemplates.mock.calls).toEqual([['httpreq1']]);
  });
});
