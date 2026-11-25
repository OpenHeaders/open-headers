import type { WorkflowRunStepRow } from '@openheaders/core/live';
import { defaultRunSelection, describeRunRow } from '@openheaders/ui/workbench/components/live/run-display';
import { translateEnglish as t } from '@openheaders/ui/workbench/settings/localize';
import { describe, expect, it } from 'vitest';

const STEP = { id: 'profile', uid: 'stpprofl' };

function passed(attempts: number, maxAttempts: number, captureNames: string[]): WorkflowRunStepRow {
  return {
    ...STEP,
    state: 'settled',
    hasProduct: true,
    settlement: {
      state: 'passed',
      status: 200,
      durationMs: 18,
      responseBytes: 19,
      attempts,
      maxAttempts,
      captureNames,
    },
  };
}

describe('a Call row, in the plan’s words', () => {
  it('running — Sending…, with the attempt only where the step may try again', () => {
    expect(describeRunRow({ ...STEP, state: 'running', attempt: 1, maxAttempts: 1 }, t).facts).toEqual(['Sending…']);
    expect(describeRunRow({ ...STEP, state: 'running', attempt: 3, maxAttempts: 10 }, t).facts).toEqual([
      'Sending…',
      'Attempt 3 of 10',
    ]);
  });

  it('done — status, duration, captures, and the attempt it passed on', () => {
    expect(describeRunRow(passed(3, 10, []), t).facts).toEqual(['200', '18 ms', 'Passed on attempt 3 of 10']);
    expect(describeRunRow(passed(1, 1, ['token', 'ttl']), t).facts).toEqual(['200', '18 ms', '2 captures']);
  });

  it('failed — one sentence; the status and duration only when a response arrived', () => {
    const refused = describeRunRow(
      {
        ...STEP,
        state: 'settled',
        hasProduct: true,
        settlement: { state: 'failed', phase: 'fetch', reason: 'Connection refused.', attempts: 1, maxAttempts: 1 },
      },
      t,
    );
    expect(refused).toEqual({
      tone: 'failed',
      facts: ['Failed'],
      sub: { text: 'Connection refused.', tone: 'danger' },
    });

    const extract = describeRunRow(
      {
        ...STEP,
        state: 'settled',
        hasProduct: true,
        settlement: {
          state: 'failed',
          phase: 'extract',
          reason: 'Capture "name" (json-path): Path "$.user" resolved to undefined.',
          attempts: 1,
          maxAttempts: 1,
          status: 200,
          durationMs: 58,
        },
      },
      t,
    );
    expect(extract.facts).toEqual(['200', '58 ms']);
  });
});

describe('any action', () => {
  it('skipped says why; not run and cannot run are their own words', () => {
    expect(
      describeRunRow({ ...STEP, state: 'settled', hasProduct: false, settlement: { state: 'skipped' } }, t),
    ).toEqual({
      tone: 'skipped',
      facts: ['Skipped'],
      sub: { text: 'Its run condition was not met.', tone: 'secondary' },
    });
    expect(
      describeRunRow({ ...STEP, state: 'settled', hasProduct: false, settlement: { state: 'not-run' } }, t).facts,
    ).toEqual(['Not run']);
    expect(
      describeRunRow(
        {
          ...STEP,
          state: 'settled',
          hasProduct: false,
          settlement: { state: 'cannot-run', reason: 'Needs a newer version.' },
        },
        t,
      ),
    ).toEqual({
      tone: 'cannot-run',
      facts: ['Cannot run here'],
      sub: { text: 'Needs a newer version.', tone: 'warning' },
    });
  });
});

describe('the step a run opens on', () => {
  it('is where the run stopped, and none when every step went through', () => {
    const login: WorkflowRunStepRow = { ...passed(1, 1, []), id: 'login', uid: 'stplogin' };
    const failed: WorkflowRunStepRow = {
      ...STEP,
      state: 'settled',
      hasProduct: true,
      settlement: { state: 'failed', phase: 'fetch', reason: 'Connection refused.', attempts: 1, maxAttempts: 1 },
    };

    expect(defaultRunSelection([login, failed])).toBe('profile');
    expect(defaultRunSelection([login, passed(1, 1, [])])).toBeNull();
  });
});
