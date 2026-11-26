import { initialCircuitSnapshot, type WorkflowRunStepRow } from '@openheaders/core/live';
import { markOfCacheRow, markOfRunRow } from '@openheaders/ui/workbench/components/live/step-mark';
import { translateEnglish as t } from '@openheaders/ui/workbench/settings/localize';
import type { LiveWorkflowRunSnapshot } from '@utils/bridge';
import { describe, expect, it } from 'vitest';

const STEP = { id: 'status', uid: 'stpstat1' };

const running: WorkflowRunStepRow = { ...STEP, state: 'running', attempt: 1, maxAttempts: 1 };

const settled = (settlement: Extract<WorkflowRunStepRow, { state: 'settled' }>['settlement']): WorkflowRunStepRow => ({
  ...STEP,
  state: 'settled',
  hasProduct: false,
  settlement,
});

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

describe('a step’s mark from a kept run’s row', () => {
  it('waits, then runs, in the row’s own words', () => {
    expect(markOfRunRow({ ...STEP, state: 'waiting' }, t)).toEqual({
      kind: 'waiting',
      text: 'Waiting',
      label: 'Waiting',
    });
    expect(markOfRunRow(running, t, { action: 'call' })).toMatchObject({ kind: 'running', text: 'Sending…' });
    expect(markOfRunRow(running, t, { action: 'listen' })).toMatchObject({ kind: 'running', text: 'Connecting…' });
  });

  it('an expect that waits is running, and its line says how far into the deadline it is', () => {
    const awaiting = { address: 'devices/dev-1/status', since: 20_000, timeoutMs: 10_000 };
    expect(markOfRunRow({ ...running, awaiting }, t, { action: 'expect', now: 23_200 })).toMatchObject({
      kind: 'running',
      text: 'Waiting for devices/dev-1/status · 3.2 s of 10.0 s',
    });
  });

  it('a call held on the rate limit and an attempt after the first each wear a mark of their own', () => {
    expect(markOfRunRow({ ...running, held: true }, t)).toMatchObject({
      kind: 'held',
      text: 'Waiting on the rate limit',
    });
    expect(markOfRunRow({ ...running, attempt: 2, maxAttempts: 4 }, t)).toMatchObject({
      kind: 'retrying',
      text: 'Sending… · Attempt 2 of 4',
    });
    expect(markOfRunRow({ ...running, attempt: 1, maxAttempts: 4 }, t).kind).toBe('running');
  });

  it('a listen is open while its run goes, and passed once its session closed', () => {
    const ready = settled({ state: 'ready', readyMs: 9, captureNames: [] });
    expect(markOfRunRow(ready, t, { action: 'listen', session: 'open' })).toMatchObject({
      kind: 'open',
      text: 'Ready in 9 ms · open',
    });
    expect(markOfRunRow(ready, t, { action: 'listen', session: { stepId: 'status', openForMs: 742 } })).toMatchObject({
      kind: 'passed',
      text: 'Ready in 9 ms · closed after 742 ms',
    });
  });

  it('what a step did reads as passed', () => {
    expect(markOfRunRow(settled({ state: 'matched', afterMs: 308, captureNames: [] }), t)).toMatchObject({
      kind: 'passed',
      text: 'Matched after 308 ms',
    });
    expect(markOfRunRow(settled({ state: 'sent', captureNames: [] }), t).kind).toBe('passed');
  });

  it('a failure keeps its sentence behind the line, and a deadline that passed is timed out, not failed', () => {
    const refused = settled({
      state: 'failed',
      phase: 'fetch',
      reason: 'Connection refused.',
      attempts: 1,
      maxAttempts: 1,
    });
    expect(markOfRunRow(refused, t)).toEqual({
      kind: 'failed',
      text: 'Failed',
      label: 'Failed',
      detail: 'Connection refused.',
    });
    const missed = settled({
      state: 'failed',
      phase: 'expect',
      reason: 'No message matched within 5 s of "reboot" starting.',
      attempts: 1,
      maxAttempts: 1,
      timedOut: true,
    });
    expect(markOfRunRow(missed, t)).toMatchObject({ kind: 'timed-out', text: 'Timed out' });
  });

  it('skipped, never ran after a failure and cannot run here are three marks', () => {
    expect(markOfRunRow(settled({ state: 'skipped' }), t).kind).toBe('skipped');
    expect(markOfRunRow(settled({ state: 'not-run' }), t)).toMatchObject({ kind: 'not-run', text: 'Not run' });
    expect(markOfRunRow(settled({ state: 'cannot-run', reason: 'Needs a newer version.' }), t)).toMatchObject({
      kind: 'cannot-run',
      text: 'Cannot run here',
      detail: 'Needs a newer version.',
    });
  });
});

describe('a step’s mark from the cache row, where no run is kept', () => {
  it('says nothing on its line for a step no run has reached, and names the empty ring', () => {
    const idle = { kind: 'idle', text: '', label: 'Not part of a successful run yet' };
    expect(markOfCacheRow(null, 'status', t)).toEqual(idle);
    expect(markOfCacheRow(undefined, 'status', t)).toEqual(idle);
    expect(markOfCacheRow(cacheRow(), 'status', t)).toEqual(idle);
  });

  it('reads the last run’s attestation', () => {
    const row = cacheRow({ stepOutcomes: { login: 'completed', status: 'skipped' } });
    expect(markOfCacheRow(row, 'login', t)).toMatchObject({ kind: 'passed', text: 'Completed on last run' });
    expect(markOfCacheRow(row, 'status', t).kind).toBe('skipped');
  });

  it('marks the step the last attempt stopped at, with the row’s message behind the line', () => {
    const row = cacheRow({ lastErrorStepId: 'status', lastErrorMessage: 'HTTP 503' });
    expect(markOfCacheRow(row, 'status', t)).toEqual({
      kind: 'failed',
      text: 'Last run failed at this step',
      label: 'Last run failed at this step',
      detail: 'HTTP 503',
    });
    expect(markOfCacheRow(row, 'login', t).kind).toBe('idle');
  });
});
