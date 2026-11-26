/**
 * The step model (the workflow runs plan, The model): a `listen`, a
 * call and an `expect` as the schema reads them, as the predicates tell
 * them apart, and as the validator holds them to the model's rules.
 *
 * One workflow throughout — the reboot scenario: listen on the probe
 * session, call the reboot endpoint, expect the device's status.
 */

import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { parseLiveWorkflow, serializeLiveWorkflow } from '../../src/codec/yaml/live-workflow';
import { effectiveDependsOn } from '../../src/live/chain-runner';
import { validateSessionSteps } from '../../src/live/session-step-validation';
import { isExpectStep, isKnownStep, isListenStep, isSendStep, isSessionStep } from '../../src/live/step-actions';
import { validateWorkflowShape } from '../../src/live/step-validation';
import { isRunnableWorkflow, isUnknownStep } from '../../src/live/unknown-step';
import { workflowDefinitionFingerprint } from '../../src/live/workflow-scan';
import { isWorkflowComplete, workflowNeedsUpdate } from '../../src/live/workflow-state';
import { mergePatch } from '../../src/schemas/document';
import { LiveWorkflowSchema, MAX_POLL_ATTEMPTS, MIN_POLL_DELAY_MS, StepPollSchema } from '../../src/schemas/live';
import type { LiveWorkflow } from '../../src/types/live';

const LISTEN = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 10_000,
  captures: [],
};
const CALL = {
  uid: 'stpcall0',
  id: 'reboot',
  requestUid: 'httpreq1',
  captures: [{ uid: 'capcmd00', name: 'command', extractor: { kind: 'json-path', path: '$.command' } }],
};
const EXPECT = {
  uid: 'stpexpct',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [{ kind: 'equals', uid: 'crtstate', extractor: { kind: 'json-path', path: '$.state' }, value: 'rebooting' }],
  timeoutMs: 10_000,
  captures: [],
};
const SEND = { uid: 'stpsend0', id: 'rename', action: 'send', on: 'probe', messageUid: 'msgname1', captures: [] };

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

function issuesOf(workflow: LiveWorkflow): string[] {
  return validateSessionSteps(workflow).map((error) => error.issue);
}

function pathsOf(steps: unknown[]): string[] {
  const result = v.safeParse(LiveWorkflowSchema, raw(steps));
  return (result.issues ?? []).map((issue) => v.getDotPath(issue) ?? '');
}

describe('the step schema', () => {
  it('reads the scenario as written', () => {
    expect(scenario().steps).toEqual([LISTEN, CALL, EXPECT]);
    expect(scenario([LISTEN, SEND]).steps).toEqual([LISTEN, SEND]);
  });

  it('names the field a session step is missing', () => {
    const { timeoutMs: _listenDeadline, ...listenWithoutDeadline } = LISTEN;
    const { after: _trigger, ...expectWithoutTrigger } = EXPECT;
    const { captures: _captures, ...sendWithoutCaptures } = SEND;
    expect(pathsOf([listenWithoutDeadline])).toEqual(['steps.0.timeoutMs']);
    expect(pathsOf([LISTEN, CALL, expectWithoutTrigger])).toEqual(['steps.2.after']);
    expect(pathsOf([LISTEN, sendWithoutCaptures])).toEqual(['steps.1.captures']);
  });

  it('holds a session deadline to the step timeout bounds', () => {
    expect(pathsOf([{ ...LISTEN, timeoutMs: 50 }])).toEqual(['steps.0.timeoutMs']);
    expect(pathsOf([LISTEN, CALL, { ...EXPECT, timeoutMs: 300_001 }])).toEqual(['steps.2.timeoutMs']);
  });

  it('never reads a session step as a call, whatever else it carries', () => {
    const [listen] = scenario([{ ...LISTEN, requestUid: 'httpreq1' }]).steps;
    expect(listen).toEqual(LISTEN);
  });

  it('still keeps a step of an action it does not know whole', () => {
    const future = { uid: 'stpclose', id: 'hangup', action: 'close', on: 'probe' };
    expect(scenario([LISTEN, future]).steps[1]).toEqual(future);
  });

  it('reads success criteria and a poll on a call', () => {
    const polled = {
      ...CALL,
      successCriteria: [
        { kind: 'status', uid: 'crtstat0', match: '2xx' },
        { kind: 'exists', uid: 'crtexist', extractor: { kind: 'header', name: 'etag' } },
        { kind: 'matches', uid: 'crtmatch', extractor: { kind: 'whole-body' }, pattern: '^ok' },
      ],
      poll: { maxAttempts: 10, delayMs: 200 },
    };
    expect(scenario([polled]).steps).toEqual([polled]);
  });

  it('holds a poll to its bounds', () => {
    expect(v.safeParse(StepPollSchema, { maxAttempts: 1, delayMs: 200 }).success).toBe(false);
    expect(v.safeParse(StepPollSchema, { maxAttempts: MAX_POLL_ATTEMPTS + 1, delayMs: 200 }).success).toBe(false);
    expect(v.safeParse(StepPollSchema, { maxAttempts: 2, delayMs: MIN_POLL_DELAY_MS - 1 }).success).toBe(false);
    expect(v.safeParse(StepPollSchema, { maxAttempts: 2, delayMs: 60_001 }).success).toBe(false);
  });

  it('refuses a criterion of a kind it does not know', () => {
    const odd = { ...EXPECT, match: [{ kind: 'contains', uid: 'crtodd00', extractor: { kind: 'whole-body' } }] };
    expect(pathsOf([LISTEN, CALL, odd])).toEqual(['steps.2.match.0.kind']);
  });
});

describe('the predicates', () => {
  it('tell the four actions apart', () => {
    const { steps } = scenario([LISTEN, CALL, SEND, EXPECT]);
    expect(steps.map(isListenStep)).toEqual([true, false, false, false]);
    expect(steps.map(isSendStep)).toEqual([false, false, true, false]);
    expect(steps.map(isExpectStep)).toEqual([false, false, false, true]);
    expect(steps.map(isSessionStep)).toEqual([true, false, true, true]);
  });

  it('know a session step and a call, and no other action', () => {
    const { steps } = scenario([LISTEN, CALL, { uid: 'stpclose', id: 'hangup', action: 'close' }]);
    expect(steps.map(isKnownStep)).toEqual([true, true, false]);
    expect(steps.map(isSessionStep)).toEqual([true, false, false]);
  });

  it('leave a session step unknown to a reader that knows only calls', () => {
    const workflow = scenario();
    expect(workflow.steps.map(isUnknownStep)).toEqual([true, false, true]);
    expect(workflowNeedsUpdate(workflow)).toBe(true);
    expect(isWorkflowComplete(workflow)).toBe(false);
    expect(isRunnableWorkflow(workflow)).toBe(false);
  });

  it('read a session step’s own dependencies', () => {
    const workflow = scenario([LISTEN, CALL, { ...EXPECT, dependsOn: ['probe', 'reboot'] }]);
    expect(workflow.steps.map((step, index) => effectiveDependsOn(step, index, workflow))).toEqual([
      [],
      ['probe'],
      ['probe', 'reboot'],
    ]);
  });
});

describe('the session validator', () => {
  it('passes the scenario, and a workflow with no session step', () => {
    expect(validateSessionSteps(scenario())).toEqual([]);
    expect(validateSessionSteps(scenario([LISTEN, SEND]))).toEqual([]);
    expect(validateSessionSteps(scenario([CALL], { refresh: { kind: 'interval', seconds: 60 } }))).toEqual([]);
  });

  it('holds a workflow with a session step to a manual refresh', () => {
    expect(validateSessionSteps(scenario(undefined, { refresh: { kind: 'interval', seconds: 60 } }))).toEqual([
      {
        issue: 'session-refresh-not-manual',
        stepId: null,
        message: 'A workflow with a session step is refreshed by hand; this one\'s refresh policy is "interval".',
      },
    ]);
  });

  it('refuses a session that is not a listen step, or not ready before the step', () => {
    expect(issuesOf(scenario([LISTEN, CALL, { ...EXPECT, on: 'reboot' }]))).toContain('session-step-unknown-listen');
    expect(issuesOf(scenario([LISTEN, { ...SEND, on: 'nowhere' }]))).toEqual(['session-step-unknown-listen']);
    expect(issuesOf(scenario([LISTEN, { ...SEND, dependsOn: [] }]))).toEqual(['session-step-unreachable-listen']);
  });

  it('refuses a trigger that is unknown, or that the expect does not follow', () => {
    expect(issuesOf(scenario([LISTEN, CALL, { ...EXPECT, after: 'nowhere' }]))).toEqual(['expect-unknown-trigger']);
    expect(issuesOf(scenario([LISTEN, CALL, { ...EXPECT, dependsOn: ['probe'] }]))).toEqual([
      'expect-unreachable-trigger',
    ]);
  });

  it('refuses a trigger that can start before the listen is ready', () => {
    const racing = scenario([LISTEN, { ...CALL, dependsOn: [] }, { ...EXPECT, dependsOn: ['probe', 'reboot'] }]);
    expect(validateSessionSteps(racing)).toEqual([
      {
        issue: 'expect-unarmed-trigger',
        stepId: 'status',
        referencedStepId: 'reboot',
        message:
          'Step "reboot" can start before "probe" is ready, so "status" could miss what it sets off. Add "probe" (or a step after it) to the dependsOn of "reboot".',
      },
    ]);
  });

  it('takes the listen itself as a trigger', () => {
    expect(validateSessionSteps(scenario([LISTEN, { ...EXPECT, after: 'probe' }]))).toEqual([]);
  });

  it('refuses an address that reads what the trigger captures', () => {
    const late = { ...EXPECT, address: 'devices/{{step.reboot.command}}/status' };
    expect(validateSessionSteps(scenario([LISTEN, CALL, late]))).toEqual([
      {
        issue: 'expect-address-reads-trigger',
        stepId: 'status',
        referencedStepId: 'reboot',
        referencedCaptureName: 'command',
        message: 'Step "status" address reads "reboot.command", which is not captured before "reboot" starts.',
      },
    ]);
  });

  it('lets a criterion read the trigger’s capture, and nothing outside the chain', () => {
    const criterion = EXPECT.match[0];
    const fromTrigger = { ...EXPECT, match: [{ ...criterion, value: '{{step.reboot.command}}' }] };
    const fromNowhere = { ...EXPECT, match: [{ ...criterion, value: '{{step.elsewhere.name}}' }] };
    expect(validateSessionSteps(scenario([LISTEN, CALL, fromTrigger]))).toEqual([]);
    expect(issuesOf(scenario([LISTEN, CALL, fromNowhere]))).toEqual(['step-template-unreachable-stepid']);
  });

  it('refuses every read of a status a session step does not have', () => {
    const statusCapture = { uid: 'capstat0', name: 'code', extractor: { kind: 'status-code' } };
    const statusCriterion = { kind: 'status', uid: 'crtstat0', match: '2xx' };
    const gated = { ...CALL, runIf: { all: [{ kind: 'status', uid: 'gatestat', stepId: 'probe', match: '2xx' }] } };
    expect(issuesOf(scenario([LISTEN, CALL, { ...EXPECT, captures: [statusCapture] }]))).toEqual([
      'session-step-status-read',
    ]);
    expect(issuesOf(scenario([LISTEN, CALL, { ...EXPECT, match: [statusCriterion] }]))).toEqual([
      'session-step-status-read',
    ]);
    expect(issuesOf(scenario([LISTEN, gated, EXPECT]))).toEqual(['session-step-status-read']);
  });

  it('refuses a capture on a listen, a send with nothing to send, and a pattern that does not compile', () => {
    const capture = { uid: 'capname0', name: 'name', extractor: { kind: 'whole-body' } };
    const { messageUid: _message, ...sendWithoutMessage } = SEND;
    const broken = { kind: 'matches', uid: 'crtbrokn', extractor: { kind: 'whole-body' }, pattern: '(' };
    expect(issuesOf(scenario([{ ...LISTEN, captures: [capture] }]))).toEqual(['listen-has-captures']);
    expect(issuesOf(scenario([LISTEN, sendWithoutMessage]))).toEqual(['send-without-message']);
    expect(issuesOf(scenario([LISTEN, { ...sendWithoutMessage, endInput: true }]))).toEqual([]);
    expect(issuesOf(scenario([LISTEN, CALL, { ...EXPECT, match: [broken] }]))).toEqual(['criterion-invalid-regex']);
  });

  it('refuses a duplicate capture name on a session step', () => {
    const capture = { uid: 'capname0', name: 'name', extractor: { kind: 'whole-body' } };
    const twice = { ...SEND, captures: [capture, { ...capture, uid: 'capname1' }] };
    expect(issuesOf(scenario([LISTEN, twice]))).toEqual(['duplicate-capture-name']);
  });
});

describe('the workflow validator', () => {
  it('holds a session step to what every step shares, and says no step of the scenario needs an update', () => {
    expect(validateWorkflowShape(scenario())).toEqual([]);
    expect(
      validateWorkflowShape(scenario([LISTEN, CALL, { ...EXPECT, dependsOn: ['ghost'] }])).map((error) => [
        error.issue,
        error.stepId,
      ]),
    ).toEqual([['step-unknown-dep', 'status']]);
  });

  it('reads a session step’s captures where a later step’s gate names one', () => {
    const state = { uid: 'capstate', name: 'state', extractor: { kind: 'json-path', path: '$.state' } };
    const gate = { all: [{ kind: 'capture-exists', uid: 'gatestat', stepId: 'status', captureName: 'state' }] };
    const after = { uid: 'stpafter', id: 'confirm', requestUid: 'httpreq2', captures: [], runIf: gate };
    expect(validateWorkflowShape(scenario([LISTEN, CALL, EXPECT, after])).map((error) => error.issue)).toEqual([
      'gate-unknown-capture',
    ]);
    expect(validateWorkflowShape(scenario([LISTEN, CALL, { ...EXPECT, captures: [state] }, after]))).toEqual([]);
  });

  it('still says a step of an action the model does not know needs an update', () => {
    const future = { uid: 'stpclose', id: 'hangup', action: 'close', on: 'probe' };
    expect(validateWorkflowShape(scenario([LISTEN, future])).map((error) => [error.issue, error.stepId])).toEqual([
      ['step-needs-update', 'hangup'],
    ]);
  });

  it('refuses a poll with nothing to wait for, and one that outlasts its limit', () => {
    const criteria = [{ kind: 'status', uid: 'crtstat0', match: '2xx' }];
    const bare = { ...CALL, poll: { maxAttempts: 10, delayMs: 200 } };
    const long = { ...CALL, successCriteria: criteria, poll: { maxAttempts: 100, delayMs: 5_000 } };
    const sound = { ...CALL, successCriteria: criteria, poll: { maxAttempts: 10, delayMs: 200 } };
    expect(validateWorkflowShape(scenario([bare]))).toEqual([
      {
        issue: 'poll-without-criteria',
        stepId: 'reboot',
        message: 'Step "reboot" polls with no success criteria to wait for.',
      },
    ]);
    expect(validateWorkflowShape(scenario([long])).map((error) => error.issue)).toEqual(['poll-exceeds-limit']);
    expect(validateWorkflowShape(scenario([sound]))).toEqual([]);
  });

  it('refuses a success criterion whose pattern does not compile', () => {
    const broken = { kind: 'matches', uid: 'crtbrokn', extractor: { kind: 'whole-body' }, pattern: '(' };
    expect(
      validateWorkflowShape(scenario([{ ...CALL, successCriteria: [broken] }])).map((error) => error.issue),
    ).toEqual(['criterion-invalid-regex']);
  });
});

describe('the definition fingerprint', () => {
  it('keeps a call’s fingerprint where it has no criteria and no poll', () => {
    expect(workflowDefinitionFingerprint(scenario([CALL]))).not.toMatch(/successCriteria|poll/);
  });

  it('changes with a call’s criteria and with its poll', () => {
    const criteria = [{ kind: 'status', uid: 'crtstat0', match: '2xx' }];
    const plain = workflowDefinitionFingerprint(scenario([CALL]));
    const held = workflowDefinitionFingerprint(scenario([{ ...CALL, successCriteria: criteria }]));
    const polled = workflowDefinitionFingerprint(
      scenario([{ ...CALL, successCriteria: criteria, poll: { maxAttempts: 10, delayMs: 200 } }]),
    );
    expect(new Set([plain, held, polled]).size).toBe(3);
  });

  it('changes with any key of a session step', () => {
    const before = workflowDefinitionFingerprint(scenario());
    const after = workflowDefinitionFingerprint(scenario([LISTEN, CALL, { ...EXPECT, timeoutMs: 5_000 }]));
    expect(after).not.toBe(before);
  });
});

describe('workflow.yaml', () => {
  const PATH = 'live-workflows/reboot-wfdevice';
  const FILE = `schemaVersion: 5
uid: wfdevice
name: Reboot
enabled: true
refresh:
  kind: manual
steps:
  - uid: stplistn
    id: probe
    action: listen
    sessionRequestUid: mqttreq1
    timeoutMs: 10000
    captures: []
  - uid: stpcall0
    id: reboot
    requestUid: httpreq1
    captures:
      - uid: capcmd00
        name: command
        extractor:
          kind: json-path
          path: $.command
  - uid: stpexpct
    id: status
    action: expect
    on: probe
    after: reboot
    address: devices/dev-1/status
    match:
      - kind: equals
        uid: crtstate
        extractor:
          kind: json-path
          path: $.state
        value: rebooting
    timeoutMs: 10000
    captures: []
`;

  it('is read as the scenario and written back byte for byte', () => {
    const parsed = parseLiveWorkflow(FILE, { path: PATH });
    expect(parsed.value.steps).toEqual([LISTEN, CALL, EXPECT]);
    expect(serializeLiveWorkflow(mergePatch(parsed, () => {}))).toBe(FILE);
  });

  it('mints the uid a hand-written criterion is missing', () => {
    const { value } = parseLiveWorkflow(FILE.replace('        uid: crtstate\n', ''), { path: PATH });
    const [, , expectStep] = value.steps;
    expect(isExpectStep(expectStep) ? expectStep.match[0].uid : null).toMatch(/^[a-z0-9]{8}$/);
  });
});
