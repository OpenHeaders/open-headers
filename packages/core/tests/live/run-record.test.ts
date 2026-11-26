import { describe, expect, it } from 'vitest';
import { refusedRunEvents, runFactOf, type WorkflowRunFact } from '../../src/live/run-events';
import { applyRunFact, runTotals, runVerdict, type WorkflowRunRecord } from '../../src/live/run-record';
import type { LiveWorkflow } from '../../src/types/live';

const RUN = { runId: 'run-1', environmentId: null };

const BEGIN: WorkflowRunFact = {
  type: 'begin',
  at: 100,
  steps: [
    { id: 'login', uid: 'stplogin' },
    { id: 'profile', uid: 'stpprofl' },
  ],
};

const LOGIN_PASSED: WorkflowRunFact = {
  type: 'step-settle',
  at: 250,
  stepId: 'login',
  settlement: {
    state: 'passed',
    status: 200,
    durationMs: 139,
    responseBytes: 44,
    attempts: 1,
    maxAttempts: 1,
    captureNames: ['token', 'ttl'],
  },
  hasProduct: true,
};

function replay(facts: WorkflowRunFact[], run = RUN): WorkflowRunRecord | null {
  return facts.reduce<WorkflowRunRecord | null>((record, fact) => applyRunFact(record, run, fact), null);
}

describe('the record of a run, fact by fact', () => {
  it('begin opens every step waiting, in declared order', () => {
    expect(replay([BEGIN])).toEqual({
      runId: 'run-1',
      environmentId: null,
      startedAt: 100,
      steps: [
        { id: 'login', uid: 'stplogin', state: 'waiting' },
        { id: 'profile', uid: 'stpprofl', state: 'waiting' },
      ],
      ended: null,
    });
  });

  it('a started step is on its first attempt; an ended attempt moves it to the next', () => {
    const started = replay([BEGIN, { type: 'step-start', at: 110, stepId: 'login', maxAttempts: 3 }]);
    expect(started?.steps[0]).toEqual({ id: 'login', uid: 'stplogin', state: 'running', attempt: 1, maxAttempts: 3 });

    const retried = applyRunFact(started, RUN, {
      type: 'attempt-end',
      at: 120,
      stepId: 'login',
      attempt: 2,
      maxAttempts: 3,
      cause: { kind: 'status', status: 503 },
      retryInMs: 400,
    });
    expect(retried?.steps[0]).toEqual({ id: 'login', uid: 'stplogin', state: 'running', attempt: 3, maxAttempts: 3 });
  });

  it('a held call reads held until it leaves, on the attempt it was on', () => {
    const running = { id: 'login', uid: 'stplogin', state: 'running', attempt: 1, maxAttempts: 3 };
    const started = replay([BEGIN, { type: 'step-start', at: 110, stepId: 'login', maxAttempts: 3 }]);

    const held = applyRunFact(started, RUN, { type: 'step-hold', at: 111, stepId: 'login', held: true });
    expect(held?.steps[0]).toEqual({ ...running, held: true });

    const left = applyRunFact(held, RUN, { type: 'step-hold', at: 19_111, stepId: 'login', held: false });
    expect(left?.steps[0]).toEqual(running);
  });

  it('the run failing at a fetch — the step before it stays passed', () => {
    const record = replay([
      BEGIN,
      { type: 'step-start', at: 110, stepId: 'login', maxAttempts: 1 },
      LOGIN_PASSED,
      { type: 'step-start', at: 260, stepId: 'profile', maxAttempts: 1 },
      {
        type: 'step-settle',
        at: 270,
        stepId: 'profile',
        settlement: {
          state: 'failed',
          phase: 'fetch',
          reason: 'Connection refused by 127.0.0.1.',
          attempts: 1,
          maxAttempts: 1,
        },
        hasProduct: true,
      },
      { type: 'end', at: 271, ok: false, durationMs: 171 },
    ]);

    expect(record?.steps.map((row) => (row.state === 'settled' ? row.settlement.state : row.state))).toEqual([
      'passed',
      'failed',
    ]);
    expect(record?.ended).toEqual({ ok: false, durationMs: 171 });
    expect(record && runVerdict(record)).toBe('failed');
    expect(record && runTotals(record)).toEqual({ passed: 1, failed: 1, skipped: 0, notRun: 0, cannotRun: 0 });
  });

  it('a fact of another run changes nothing; its begin replaces the record', () => {
    const kept = replay([BEGIN, LOGIN_PASSED]);

    expect(applyRunFact(kept, { runId: 'run-2', environmentId: null }, LOGIN_PASSED)).toBe(kept);
    expect(applyRunFact(null, RUN, LOGIN_PASSED)).toBeNull();

    const next = applyRunFact(kept, { runId: 'run-2', environmentId: 'envstage' }, { ...BEGIN, at: 900 });
    expect(next).toMatchObject({ runId: 'run-2', environmentId: 'envstage', startedAt: 900, ended: null });
    expect(next?.steps.every((row) => row.state === 'waiting')).toBe(true);
  });

  it('a run going reads running; a passed one passed', () => {
    const going = replay([BEGIN, LOGIN_PASSED]);
    expect(going && runVerdict(going)).toBe('running');

    const done = applyRunFact(going, RUN, { type: 'end', at: 300, ok: true, durationMs: 200 });
    expect(done && runVerdict(done)).toBe('passed');
  });

  it('a refused run cannot run — it is not a failure', () => {
    const workflow: LiveWorkflow = {
      schemaVersion: 5,
      uid: 'wfpins01',
      path: 'live-workflows/token-chain-wfpins01',
      name: 'Token chain',
      steps: [
        { uid: 'stpprobe', id: 'probe', action: 'listen' },
        { uid: 'stplogin', id: 'login', requestUid: 'reqtoken', captures: [] },
      ],
      refresh: { kind: 'manual' },
      enabled: true,
    };

    const record = replay(refusedRunEvents(workflow, 7).map(runFactOf));

    expect(record && runVerdict(record)).toBe('cannot-run');
    expect(record && runTotals(record)).toEqual({ passed: 0, failed: 0, skipped: 0, notRun: 1, cannotRun: 1 });
  });
});
