/**
 * Pure-function tests for what a line of the workflow graph says: its
 * label, whether the last run took it, and the captures its child reads.
 */

import { initialCircuitSnapshot, type WorkflowRunStepRow } from '@openheaders/core/live';
import type { StepGateClause, WorkflowStep } from '@openheaders/core/types';
import {
  capsuleArrowState,
  capturesRead,
  clausesOn,
  lineLabel,
  lineStateOf,
  reachOfCacheRow,
  reachOfRunRow,
  stepOwnTemplates,
} from '@openheaders/ui/workbench/components/live/graph-lines';
import { translateEnglish as t } from '@openheaders/ui/workbench/settings/localize';
import type { LiveWorkflowRunSnapshot } from '@utils/bridge';
import { describe, expect, it } from 'vitest';

const STEP = { id: 'status', uid: 'stpstat1' };

const settled = (settlement: Extract<WorkflowRunStepRow, { state: 'settled' }>['settlement']): WorkflowRunStepRow => ({
  ...STEP,
  state: 'settled',
  hasProduct: false,
  settlement,
});

const on2xx: StepGateClause = { uid: 'gat2xx01', kind: 'status', stepId: 'reboot', match: '2xx' };
const hasId: StepGateClause = { uid: 'gatid001', kind: 'capture-exists', stepId: 'reboot', captureName: 'commandId' };
const onProbe: StepGateClause = {
  uid: 'gatprb01',
  kind: 'capture-equals',
  stepId: 'probe',
  captureName: 'state',
  value: 'rebooting',
};

function cacheRow(overrides: Partial<LiveWorkflowRunSnapshot> = {}): LiveWorkflowRunSnapshot {
  return {
    workflowUid: 'wf01',
    environmentId: null,
    stepCaptures: {},
    extractedAt: 1_700_000_000_000,
    expiresAt: null,
    stepResponseBytes: {},
    consecutiveFailures: 0,
    lastExtractorOk: true,
    circuit: initialCircuitSnapshot(),
    ...overrides,
  };
}

describe('a line’s label', () => {
  it('is "always" for a dependency no clause names', () => {
    expect(lineLabel([], t)).toBe('always');
  });

  it('says a status clause by its value alone — the line names the step', () => {
    expect(lineLabel([on2xx], t)).toBe('if 2xx');
    expect(lineLabel([{ ...on2xx, match: ['eq', 200] }], t)).toBe('if 200');
    expect(lineLabel([{ ...on2xx, match: ['ne', 404] }], t)).toBe('if not 404');
    expect(lineLabel([{ ...on2xx, match: ['in', [200, 201]] }], t)).toBe('if 200, 201');
  });

  it('says a capture clause by the capture’s name', () => {
    expect(lineLabel([hasId], t)).toBe('if commandId exists');
    expect(lineLabel([onProbe], t)).toBe('if state = "rebooting"');
    expect(
      lineLabel(
        [{ uid: 'gatmat01', kind: 'capture-matches', stepId: 'probe', captureName: 'state', pattern: '^re' }],
        t,
      ),
    ).toBe('if state matches /^re/');
  });

  it('joins the clauses that name one parent', () => {
    expect(lineLabel([on2xx, hasId], t)).toBe('if 2xx · commandId exists');
  });

  it('carries only the clauses that name its parent', () => {
    expect(clausesOn([on2xx, onProbe, hasId], 'reboot')).toEqual([on2xx, hasId]);
    expect(clausesOn([on2xx], 'login')).toEqual([]);
  });
});

describe('how far a run got with a step', () => {
  it('a step that waits, never ran or cannot run was not judged', () => {
    expect(reachOfRunRow(undefined)).toEqual({ reached: 'unknown' });
    expect(reachOfRunRow({ ...STEP, state: 'waiting' })).toEqual({ reached: 'unknown' });
    expect(reachOfRunRow(settled({ state: 'not-run' }))).toEqual({ reached: 'unknown' });
    expect(reachOfRunRow(settled({ state: 'cannot-run', reason: 'no' }))).toEqual({ reached: 'unknown' });
  });

  it('a step that is running, or settled any way but skipped, ran', () => {
    expect(reachOfRunRow({ ...STEP, state: 'running', attempt: 1, maxAttempts: 1 })).toEqual({ reached: 'ran' });
    expect(reachOfRunRow(settled({ state: 'matched', afterMs: 308, captureNames: [] }))).toEqual({ reached: 'ran' });
    expect(
      reachOfRunRow(settled({ state: 'failed', phase: 'fetch', reason: 'refused', attempts: 1, maxAttempts: 1 })),
    ).toEqual({ reached: 'ran' });
  });

  it('a skipped step names the clauses that did not hold, where the run said', () => {
    expect(reachOfRunRow(settled({ state: 'skipped', unmet: ['gat2xx01'] }))).toEqual({
      reached: 'skipped',
      unmet: ['gat2xx01'],
    });
    expect(reachOfRunRow(settled({ state: 'skipped' }))).toEqual({ reached: 'skipped' });
  });

  it('the cache row knows a skip, never which clause made it', () => {
    expect(reachOfCacheRow(null, 'status')).toEqual({ reached: 'unknown' });
    expect(reachOfCacheRow(cacheRow(), 'status')).toEqual({ reached: 'unknown' });
    expect(reachOfCacheRow(cacheRow({ stepOutcomes: { status: 'completed' } }), 'status')).toEqual({ reached: 'ran' });
    expect(reachOfCacheRow(cacheRow({ stepOutcomes: { status: 'skipped' } }), 'status')).toEqual({
      reached: 'skipped',
    });
    expect(reachOfCacheRow(cacheRow({ lastErrorStepId: 'status' }), 'status')).toEqual({ reached: 'ran' });
  });
});

describe('whether a run took a line', () => {
  it('before a run judged the step, nothing is said', () => {
    expect(lineStateOf({ reached: 'unknown' }, [on2xx], false)).toEqual({ line: 'unknown', label: 'unknown' });
  });

  it('every line into a step that ran was taken', () => {
    expect(lineStateOf({ reached: 'ran' }, [on2xx], true)).toEqual({ line: 'taken', label: 'true' });
    expect(lineStateOf({ reached: 'ran' }, [], false)).toEqual({ line: 'taken', label: 'true' });
  });

  it('a line that carries a clause that did not hold was not taken', () => {
    const reach = { reached: 'skipped' as const, unmet: ['gat2xx01'] };
    expect(lineStateOf(reach, [on2xx, hasId], true)).toEqual({ line: 'not-taken', label: 'false' });
  });

  it('at a capsule, a line whose own clauses held is taken: the capsule’s arrow is what stays dashed', () => {
    const reach = { reached: 'skipped' as const, unmet: ['gatprb01'] };
    expect(lineStateOf(reach, [on2xx], true)).toEqual({ line: 'taken', label: 'true' });
    expect(lineStateOf(reach, [], true)).toEqual({ line: 'taken', label: 'true' });
    expect(capsuleArrowState(reach)).toBe('not-taken');
  });

  it('with no capsule, the one line into a skipped step is dashed whichever clause failed', () => {
    const reach = { reached: 'skipped' as const, unmet: ['gatprb01'] };
    expect(lineStateOf(reach, [on2xx], false)).toEqual({ line: 'not-taken', label: 'true' });
    expect(lineStateOf(reach, [], false)).toEqual({ line: 'not-taken', label: 'unknown' });
  });

  it('a skip the run did not explain dashes the line and leaves its label plain', () => {
    expect(lineStateOf({ reached: 'skipped' }, [on2xx], true)).toEqual({ line: 'not-taken', label: 'unknown' });
  });

  it('a capsule’s arrow follows its step', () => {
    expect(capsuleArrowState({ reached: 'unknown' })).toBe('unknown');
    expect(capsuleArrowState({ reached: 'ran' })).toBe('taken');
  });
});

describe('the captures a step reads', () => {
  const expectStep: WorkflowStep = {
    uid: 'stpexp01',
    id: 'rebooting',
    action: 'expect',
    on: 'probe',
    after: 'reboot',
    address: 'devices/{{step.login.deviceId}}/status',
    match: [
      {
        kind: 'equals',
        uid: 'crtcmd01',
        extractor: { kind: 'json-path', path: '$.commandId' },
        value: '{{step.reboot.commandId}}',
      },
      { kind: 'exists', uid: 'crtsta01', extractor: { kind: 'json-path', path: '$.state' } },
    ],
    timeoutMs: 5000,
    captures: [],
  };

  it('a Wait holds its topic and its match values', () => {
    expect(stepOwnTemplates(expectStep)).toEqual([
      'devices/{{step.login.deviceId}}/status',
      '{{step.reboot.commandId}}',
    ]);
  });

  it('a Call holds its success criteria', () => {
    const call: WorkflowStep = {
      uid: 'stpcal01',
      id: 'verify',
      requestUid: 'req00001',
      captures: [],
      successCriteria: [
        {
          kind: 'equals',
          uid: 'crtver01',
          extractor: { kind: 'json-path', path: '$.id' },
          value: '{{step.reboot.commandId}}',
        },
      ],
    };
    expect(stepOwnTemplates(call)).toEqual(['{{step.reboot.commandId}}']);
    expect(stepOwnTemplates({ uid: 'stpcal02', id: 'plain', requestUid: 'req00001', captures: [] })).toEqual([]);
  });

  it('names the captures of one parent, each once, first seen first', () => {
    const templates = [
      'https://api.openheaders.io/devices/{{step.reboot.deviceId}}',
      'Bearer {{step.login.token}}',
      '{"command":"{{step.reboot.commandId}}","device":"{{step.reboot.deviceId}}"}',
    ];
    expect(capturesRead(templates, 'reboot')).toEqual(['deviceId', 'commandId']);
    expect(capturesRead(templates, 'login')).toEqual(['token']);
    expect(capturesRead(templates, 'probe')).toEqual([]);
  });
});
