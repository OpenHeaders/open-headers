import { type DraftCallStep, initialCircuitSnapshot, type WorkflowRunStepRow } from '@openheaders/core/live';
import type { ExpectWorkflowStep, ListenWorkflowStep, SendWorkflowStep } from '@openheaders/core/types';
import { describeStepLastRun } from '@openheaders/ui/workbench/components/live/step-last-run';
import { idleMark, markOfCacheRow, markOfRunRow } from '@openheaders/ui/workbench/components/live/step-mark';
import { translateEnglish as t } from '@openheaders/ui/workbench/settings/localize';
import { describe, expect, it } from 'vitest';

const CALL: DraftCallStep = { uid: 'stpcall0', id: 'reboot', requestUid: 'reqreboo', captures: [] };
const LISTEN: ListenWorkflowStep = {
  uid: 'stplistn',
  id: 'probe',
  action: 'listen',
  sessionRequestUid: 'mqttreq1',
  timeoutMs: 5_000,
  captures: [],
};
const SEND: SendWorkflowStep = { uid: 'stpsend0', id: 'rename', action: 'send', on: 'probe', captures: [] };
const WAIT: ExpectWorkflowStep = {
  uid: 'stpexpct',
  id: 'status',
  action: 'expect',
  on: 'probe',
  after: 'reboot',
  address: 'devices/dev-1/status',
  match: [],
  timeoutMs: 5_000,
  captures: [],
};

type Step = DraftCallStep | ListenWorkflowStep | SendWorkflowStep | ExpectWorkflowStep;
type Settlement = Extract<WorkflowRunStepRow, { state: 'settled' }>['settlement'];

const NOW = 23_200;

/** The card's words for a step's row in a kept run. */
function lastRunOf(step: Step, row: WorkflowRunStepRow, session?: 'open') {
  const action = 'action' in step ? step.action : 'call';
  const mark = markOfRunRow(row, t, { action, now: NOW, ...(session !== undefined ? { session } : {}) });
  return describeStepLastRun({ step, mark, row, now: NOW, runButton: 'Refresh' }, t);
}

const settled = (step: Step, settlement: Settlement): WorkflowRunStepRow => ({
  id: step.id,
  uid: step.uid,
  state: 'settled',
  hasProduct: false,
  settlement,
});

const figures = (lastRun: ReturnType<typeof describeStepLastRun>) =>
  lastRun.figures.map((figure) => [figure.key, figure.label, figure.value]);

describe('a step’s Last run with no run to speak of', () => {
  it('says the step has not run, and which button runs it', () => {
    expect(
      describeStepLastRun({ step: CALL, mark: idleMark(t), row: undefined, now: NOW, runButton: 'Refresh' }, t),
    ).toEqual({
      kind: 'idle',
      word: 'Not run yet',
      sentence: 'Press Refresh to see what this step does.',
      figures: [{ key: 'status', label: 'Status', value: 'Not run yet' }],
    });
  });

  it('says what the cache row says where the page keeps no run, and no figure beyond the state', () => {
    const mark = markOfCacheRow(
      {
        workflowUid: 'wf01',
        environmentId: null,
        stepCaptures: {},
        extractedAt: 1_700_000_000_000,
        expiresAt: null,
        stepResponseBytes: {},
        consecutiveFailures: 1,
        lastExtractorOk: true,
        lastErrorStepId: 'reboot',
        lastErrorMessage: 'connect ECONNREFUSED',
        circuit: initialCircuitSnapshot(),
      },
      'reboot',
      t,
    );
    expect(describeStepLastRun({ step: CALL, mark, row: undefined, now: NOW, runButton: 'Refresh' }, t)).toEqual({
      kind: 'failed',
      word: 'Failed',
      sentence: 'connect ECONNREFUSED',
      figures: [{ key: 'status', label: 'Status', value: 'Failed' }],
    });
  });
});

describe('a call’s Last run', () => {
  it('waits its turn, then sends', () => {
    expect(lastRunOf(CALL, { id: 'reboot', uid: 'stpcall0', state: 'waiting' })).toMatchObject({
      kind: 'waiting',
      word: 'Waiting',
      sentence: 'Its turn in this run has not come yet.',
    });
    const retrying = lastRunOf(CALL, { id: 'reboot', uid: 'stpcall0', state: 'running', attempt: 2, maxAttempts: 4 });
    expect(retrying).toMatchObject({ kind: 'retrying', word: 'Retrying', sentence: 'Sending… · Attempt 2 of 4' });
    expect(figures(retrying)).toEqual([
      ['status', 'Status', 'Retrying'],
      ['attempts', 'Attempts', '2 of 4'],
    ]);
  });

  it('that passed says what came back: the status, how long it took, its size', () => {
    const passed = lastRunOf(
      CALL,
      settled(CALL, {
        state: 'passed',
        status: 202,
        durationMs: 8,
        responseBytes: 84,
        attempts: 1,
        maxAttempts: 1,
        captureNames: ['commandId'],
      }),
    );
    expect(passed).toMatchObject({ kind: 'passed', word: 'Passed', sentence: 'Returned 202.' });
    expect(figures(passed)).toEqual([
      ['status', 'Status', 'Passed'],
      ['response', 'Response', '202'],
      ['duration', 'Duration', '8 ms'],
      ['size', 'Size', '84 B'],
    ]);
    expect(passed.timing).toBeUndefined();
  });

  it('that passed on a later attempt says which', () => {
    const passed = lastRunOf(
      CALL,
      settled(CALL, {
        state: 'passed',
        status: 200,
        responseBytes: 2_048,
        attempts: 3,
        maxAttempts: 5,
        captureNames: [],
      }),
    );
    expect(figures(passed)).toEqual([
      ['status', 'Status', 'Passed'],
      ['response', 'Response', '200'],
      ['size', 'Size', '2.0 KB'],
      ['attempts', 'Attempts', '3 of 5'],
    ]);
  });

  it('that failed says why in the engine’s own sentence', () => {
    const failed = lastRunOf(
      CALL,
      settled(CALL, {
        state: 'failed',
        phase: 'criteria',
        reason: 'Step "reboot" returned 500, and its success criteria want 2xx.',
        attempts: 1,
        maxAttempts: 1,
        status: 500,
        durationMs: 12,
      }),
    );
    expect(failed).toMatchObject({
      kind: 'failed',
      word: 'Failed',
      sentence: 'Step "reboot" returned 500, and its success criteria want 2xx.',
    });
    expect(figures(failed)).toEqual([
      ['status', 'Status', 'Failed'],
      ['response', 'Response', '500'],
      ['duration', 'Duration', '12 ms'],
    ]);
  });

  it('that was skipped, never ran or cannot run says so, with no figure beyond the state', () => {
    expect(lastRunOf(CALL, settled(CALL, { state: 'skipped', unmet: ['gatstat0'] }))).toEqual({
      kind: 'skipped',
      word: 'Skipped',
      sentence: 'Its run condition was not met.',
      figures: [{ key: 'status', label: 'Status', value: 'Skipped' }],
    });
    expect(lastRunOf(CALL, settled(CALL, { state: 'not-run' }))).toEqual({
      kind: 'not-run',
      word: 'Not run',
      sentence: 'The run ended before this step.',
      figures: [{ key: 'status', label: 'Status', value: 'Not run' }],
    });
    expect(
      lastRunOf(CALL, settled(CALL, { state: 'cannot-run', reason: 'A workflow with session steps runs elsewhere.' })),
    ).toMatchObject({
      kind: 'cannot-run',
      word: 'Cannot run here',
      sentence: 'A workflow with session steps runs elsewhere.',
    });
  });
});

describe('a Listen’s Last run', () => {
  it('is open while the run goes, with how fast it was ready against its deadline', () => {
    const ready = lastRunOf(LISTEN, settled(LISTEN, { state: 'ready', readyMs: 9, captureNames: [] }), 'open');
    expect(ready).toMatchObject({ kind: 'open', word: 'Open', sentence: 'The session was ready to receive.' });
    expect(figures(ready)).toEqual([
      ['status', 'Status', 'Open'],
      ['ready-in', 'Ready in', '9 ms'],
      ['limit', 'Limit', '5.0 s'],
    ]);
    expect(ready.timing).toEqual({
      fraction: 9 / 5_000,
      tone: 'met',
      note: 'Ready in 9 ms · open',
      limit: 'limit 5.0 s',
    });
  });

  it('says how it opened where the session said', () => {
    const ready = lastRunOf(
      LISTEN,
      settled(LISTEN, {
        state: 'ready',
        readyMs: 9,
        captureNames: [],
        facts: { identityGenerated: true, cleanStart: true, granted: 1 },
      }),
    );
    expect(ready.sentence).toBe('Client ID generated · Clean start · 1 subscription granted');
  });

  it('that was not ready in time timed out, its bar full', () => {
    const late = lastRunOf(
      LISTEN,
      settled(LISTEN, {
        state: 'failed',
        phase: 'listen',
        reason: 'Step "probe" was not ready within 5000 ms.',
        attempts: 1,
        maxAttempts: 1,
        timedOut: true,
      }),
    );
    expect(late).toMatchObject({
      kind: 'timed-out',
      word: 'Timed out',
      sentence: 'Step "probe" was not ready within 5000 ms.',
    });
    expect(late.timing).toEqual({ fraction: 1, tone: 'missed', note: 'Timed out', limit: 'limit 5.0 s' });
  });
});

describe('a Wait’s Last run', () => {
  it('shows how far into its deadline it is while it waits', () => {
    const waiting = lastRunOf(WAIT, {
      id: 'status',
      uid: 'stpexpct',
      state: 'running',
      attempt: 1,
      maxAttempts: 1,
      awaiting: { address: 'devices/dev-1/status', since: 20_000, timeoutMs: 10_000 },
    });
    expect(waiting).toMatchObject({
      kind: 'running',
      word: 'Running',
      sentence: 'Waiting for devices/dev-1/status · 3.2 s of 10.0 s',
    });
    expect(figures(waiting)).toEqual([
      ['status', 'Status', 'Running'],
      ['limit', 'Limit', '10.0 s'],
    ]);
    expect(waiting.timing).toEqual({
      fraction: 0.32,
      tone: 'going',
      note: 'Waiting for devices/dev-1/status · 3.2 s of 10.0 s',
      limit: 'limit 10.0 s',
    });
  });

  it('that matched says after how long, against its deadline', () => {
    const matched = lastRunOf(WAIT, settled(WAIT, { state: 'matched', afterMs: 308, captureNames: ['state'] }));
    expect(matched).toMatchObject({ kind: 'passed', word: 'Passed', sentence: 'A matching message arrived.' });
    expect(figures(matched)).toEqual([
      ['status', 'Status', 'Passed'],
      ['matched-after', 'Matched after', '308 ms'],
      ['limit', 'Limit', '5.0 s'],
    ]);
    expect(matched.timing).toEqual({
      fraction: 308 / 5_000,
      tone: 'met',
      note: 'Matched after 308 ms · 1 capture',
      limit: 'limit 5.0 s',
    });
  });

  it('with no match in time timed out, its bar full', () => {
    const missed = lastRunOf(
      WAIT,
      settled(WAIT, {
        state: 'failed',
        phase: 'expect',
        reason: 'No message matched on devices/dev-1/status within 5000 ms.',
        attempts: 1,
        maxAttempts: 1,
        timedOut: true,
      }),
    );
    expect(missed.kind).toBe('timed-out');
    expect(figures(missed)).toEqual([
      ['status', 'Status', 'Timed out'],
      ['limit', 'Limit', '5.0 s'],
    ]);
    expect(missed.timing).toMatchObject({ fraction: 1, tone: 'missed' });
  });
});

describe('a Send’s Last run', () => {
  it('says the message left, and how fast it was acknowledged where the kind acknowledges', () => {
    const sent = lastRunOf(SEND, settled(SEND, { state: 'sent', ackMs: 5, captureNames: [] }));
    expect(sent).toMatchObject({ kind: 'passed', word: 'Passed', sentence: 'The message was sent.' });
    expect(figures(sent)).toEqual([
      ['status', 'Status', 'Passed'],
      ['acknowledged-in', 'Acknowledged in', '5 ms'],
    ]);
    expect(figures(lastRunOf(SEND, settled(SEND, { state: 'sent', captureNames: [] })))).toEqual([
      ['status', 'Status', 'Passed'],
    ]);
  });
});
