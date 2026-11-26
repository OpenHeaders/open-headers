import type { WorkflowRunStepRow } from '@openheaders/core/live';
import { describeRunRow } from '@openheaders/ui/workbench/components/live/run-display';
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

describe('a session step’s row, in the plan’s words', () => {
  const settled = (
    settlement: Extract<WorkflowRunStepRow, { state: 'settled' }>['settlement'],
  ): WorkflowRunStepRow => ({
    ...STEP,
    state: 'settled',
    hasProduct: false,
    settlement,
  });

  it('a listen is done when its session is ready', () => {
    expect(describeRunRow(settled({ state: 'ready', readyMs: 41, captureNames: [] }), t)).toEqual({
      tone: 'passed',
      facts: ['Ready in 41 ms'],
    });
  });

  it('a send says Sent, the acknowledgement where there was one, and its captures', () => {
    expect(describeRunRow(settled({ state: 'sent', captureNames: [] }), t).facts).toEqual(['Sent']);
    expect(describeRunRow(settled({ state: 'sent', ackMs: 6, captureNames: ['name'] }), t)).toEqual({
      tone: 'passed',
      facts: ['Sent', 'Acknowledged in 6 ms', '1 capture'],
    });
  });

  it('an expect says how long after its trigger it matched', () => {
    expect(describeRunRow(settled({ state: 'matched', afterMs: 312, captureNames: ['state'] }), t)).toEqual({
      tone: 'passed',
      facts: ['Matched after 312 ms', '1 capture'],
    });
  });
});

describe('a row while its step runs', () => {
  const running: WorkflowRunStepRow = { ...STEP, state: 'running', attempt: 1, maxAttempts: 1 };

  it('a call its host’s rate limit holds says it is waiting on the limit, on the attempt it is on', () => {
    expect(describeRunRow({ ...running, held: true }, t, { action: 'call' }).facts).toEqual([
      'Waiting on the rate limit',
    ]);
    expect(describeRunRow({ ...running, attempt: 2, maxAttempts: 4, held: true }, t).facts).toEqual([
      'Waiting on the rate limit',
      'Attempt 2 of 4',
    ]);
  });

  it('a listen is connecting, a send is sending', () => {
    expect(describeRunRow(running, t, { action: 'listen' }).facts).toEqual(['Connecting…']);
    expect(describeRunRow(running, t, { action: 'send' }).facts).toEqual(['Sending…']);
  });

  it('an expect names what it waits for and how far into its deadline it is', () => {
    const awaiting = { address: 'devices/dev-1/status', since: 20_000, timeoutMs: 10_000 };
    expect(describeRunRow({ ...running, awaiting }, t, { action: 'expect', now: 23_200 }).facts).toEqual([
      'Waiting for devices/dev-1/status',
      '3.2 s of 10.0 s',
    ]);
    expect(describeRunRow({ ...running, awaiting }, t, { action: 'expect', now: 31_000 }).facts[1]).toBe(
      '10.0 s of 10.0 s',
    );
    expect(describeRunRow({ ...running, awaiting: { ...awaiting, address: null } }, t).facts).toEqual([
      'Waiting for a message',
    ]);
  });
});

describe('a listen row, once its session is ready', () => {
  const ready = (facts?: {
    identityGenerated?: boolean;
    cleanStart?: boolean;
    resumed?: boolean;
    granted?: number;
  }): WorkflowRunStepRow => ({
    ...STEP,
    state: 'settled',
    hasProduct: false,
    settlement: { state: 'ready', readyMs: 41, captureNames: [], ...(facts !== undefined ? { facts } : {}) },
  });

  it('reads open while the run goes, with how the session opened under it', () => {
    expect(
      describeRunRow(ready({ identityGenerated: true, cleanStart: true, resumed: false, granted: 1 }), t, {
        action: 'listen',
        session: 'open',
      }),
    ).toEqual({
      tone: 'passed',
      facts: ['Ready in 41 ms', 'open'],
      sub: { text: 'Client ID generated · Clean start · 1 subscription granted', tone: 'secondary' },
    });
  });

  it('says a stored session was resumed, under the request’s own client id', () => {
    expect(
      describeRunRow(ready({ identityGenerated: false, cleanStart: false, resumed: true, granted: 2 }), t).sub,
    ).toEqual({
      text: 'Client ID set on the request · Resumed a stored session · 2 subscriptions granted',
      tone: 'secondary',
    });
  });

  it('reads closed after the run ends, and a close that did not go cleanly says so', () => {
    expect(describeRunRow(ready(), t, { session: { stepId: 'profile', openForMs: 742 } })).toEqual({
      tone: 'passed',
      facts: ['Ready in 41 ms', 'closed after 742 ms'],
    });
    expect(
      describeRunRow(ready({ granted: 1 }), t, {
        session: { stepId: 'profile', openForMs: 5_000, warning: 'Not closed within 5 s.' },
      }).sub,
    ).toEqual({ text: 'Not closed within 5 s.', tone: 'warning' });
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
