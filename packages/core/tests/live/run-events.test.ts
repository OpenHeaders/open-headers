/**
 * Step events of the pure runner (the workflow runs plan, The Run
 * view), pinned on the four golden runs of an HTTP-only workflow: the
 * same steps and response bodies the report and commit pins read from
 * `fixtures/workflow-runs/http-only.json`.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { type FetchAdapter, runChain, StepExecutionError } from '../../src/live/chain-runner';
import { refusedRunEvents, runFactOf, type WorkflowRunEvent } from '../../src/live/run-events';
import type { ExecutedRequestSnapshot } from '../../src/types';
import type { CallWorkflowStep, LiveWorkflow, RunnableWorkflow, WorkflowStep } from '../../src/types/live';

interface Goldens {
  workflowUid: string;
  responses: { token: string; profile: string; introspect: string };
  scenarios: { failedAtFetch: { commit: { error: { message: string } } } };
}

const goldens: Goldens = JSON.parse(
  readFileSync(new URL('../fixtures/workflow-runs/http-only.json', import.meta.url), 'utf8'),
);

const REFUSED = goldens.scenarios.failedAtFetch.commit.error.message;

function snapshot(body: string, error: string | null = null): ExecutedRequestSnapshot {
  return {
    status: error === null ? 200 : 0,
    statusText: error === null ? 'OK' : '',
    url: 'https://api.openheaders.io/',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: new TextEncoder().encode(body).byteLength,
    durationMs: 10,
    error,
  };
}

const BODIES: Record<string, string> = {
  reqtoken: goldens.responses.token,
  reqprofl: goldens.responses.profile,
  reqintro: goldens.responses.introspect,
};

/** Answers each request its golden body, or throws the fetch failure a scenario names. */
function adapterFor(failingRequestUid: string | null = null): FetchAdapter {
  return {
    async executeStep(step) {
      if (step.requestUid === failingRequestUid) throw new StepExecutionError(REFUSED, snapshot('', REFUSED));
      const answered = snapshot(BODIES[step.requestUid] ?? '');
      return {
        status: answered.status,
        statusText: answered.statusText,
        url: answered.url,
        headers: answered.headers,
        body: answered.body,
        bodyBytes: answered.bodyBytes,
        snapshot: answered,
      };
    },
  };
}

function workflowOf<S extends WorkflowStep>(steps: S[]): LiveWorkflow & { steps: S[] } {
  return {
    schemaVersion: 5,
    uid: goldens.workflowUid,
    path: `live-workflows/token-chain-${goldens.workflowUid}`,
    name: 'Token chain',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  };
}

function loginStep(tokenPath: string): CallWorkflowStep {
  return {
    uid: 'stplogin',
    id: 'login',
    requestUid: 'reqtoken',
    captures: [
      { uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: tokenPath } },
      { uid: 'capttl00', name: 'ttl', extractor: { kind: 'json-path', path: '$.expires_in' } },
    ],
  };
}

const profileStep: CallWorkflowStep = {
  uid: 'stpprofl',
  id: 'profile',
  requestUid: 'reqprofl',
  captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
};

/** A run's events under a clock that moves one tick per read. */
async function eventsOf(
  workflow: RunnableWorkflow,
  adapter: FetchAdapter,
): Promise<{ events: WorkflowRunEvent[]; ok: boolean }> {
  const events: WorkflowRunEvent[] = [];
  let tick = 0;
  const outcome = await runChain({
    workflow,
    adapter,
    context: { workflowUid: workflow.uid, workspaceId: 'ws-run-pins', environmentId: null },
    now: () => ++tick,
    sleep: async () => undefined,
    onEvent: (event) => events.push(event),
  });
  return { events, ok: outcome.ok };
}

const BEGIN_LOGIN_PROFILE = {
  type: 'begin',
  at: 1,
  steps: [
    { id: 'login', uid: 'stplogin' },
    { id: 'profile', uid: 'stpprofl' },
  ],
};

const LOGIN_PASSED = {
  type: 'step-settle',
  at: 3,
  stepId: 'login',
  settlement: {
    state: 'passed',
    status: 200,
    durationMs: 10,
    responseBytes: 44,
    attempts: 1,
    maxAttempts: 1,
    captureNames: ['token', 'ttl'],
  },
  product: { kind: 'response', snapshot: snapshot(goldens.responses.token) },
};

describe('the events of an HTTP-only run', () => {
  it('passing — each step starts and settles in order, the run ends ok', async () => {
    const { events, ok } = await eventsOf(workflowOf([loginStep('$.access_token'), profileStep]), adapterFor());

    expect(ok).toBe(true);
    expect(events).toEqual([
      BEGIN_LOGIN_PROFILE,
      { type: 'step-start', at: 2, stepId: 'login', maxAttempts: 1 },
      LOGIN_PASSED,
      { type: 'step-start', at: 4, stepId: 'profile', maxAttempts: 1 },
      {
        type: 'step-settle',
        at: 5,
        stepId: 'profile',
        settlement: {
          state: 'passed',
          status: 200,
          durationMs: 10,
          responseBytes: 19,
          attempts: 1,
          maxAttempts: 1,
          captureNames: ['name'],
        },
        product: { kind: 'response', snapshot: snapshot(goldens.responses.profile) },
      },
      { type: 'end', at: 6, ok: true, durationMs: 5 },
    ]);
  });

  it('failing at a fetch — the step before it passed, the failing step keeps its sentence and its exchange', async () => {
    const { events, ok } = await eventsOf(
      workflowOf([loginStep('$.access_token'), profileStep]),
      adapterFor('reqprofl'),
    );

    expect(ok).toBe(false);
    expect(events).toEqual([
      BEGIN_LOGIN_PROFILE,
      { type: 'step-start', at: 2, stepId: 'login', maxAttempts: 1 },
      LOGIN_PASSED,
      { type: 'step-start', at: 4, stepId: 'profile', maxAttempts: 1 },
      {
        type: 'step-settle',
        at: 5,
        stepId: 'profile',
        settlement: { state: 'failed', phase: 'fetch', reason: REFUSED, attempts: 1, maxAttempts: 1 },
        product: { kind: 'response', snapshot: snapshot('', REFUSED) },
      },
      { type: 'end', at: 6, ok: false, durationMs: 5 },
    ]);
  });

  it('failing at a capture — the response is kept, the step after it never ran', async () => {
    const { events, ok } = await eventsOf(workflowOf([loginStep('$.session_token'), profileStep]), adapterFor());

    expect(ok).toBe(false);
    expect(events).toEqual([
      BEGIN_LOGIN_PROFILE,
      { type: 'step-start', at: 2, stepId: 'login', maxAttempts: 1 },
      {
        type: 'step-settle',
        at: 3,
        stepId: 'login',
        settlement: {
          state: 'failed',
          phase: 'extract',
          reason: 'Capture "token" (json-path): Path "$.session_token" resolved to undefined.',
          attempts: 1,
          maxAttempts: 1,
          status: 200,
          durationMs: 10,
        },
        product: { kind: 'response', snapshot: snapshot(goldens.responses.token) },
      },
      { type: 'step-settle', at: 4, stepId: 'profile', settlement: { state: 'not-run' } },
      { type: 'end', at: 5, ok: false, durationMs: 4 },
    ]);
  });

  it('one step skipped by its gate — it settles without starting, the run ends ok', async () => {
    const { events, ok } = await eventsOf(
      workflowOf<CallWorkflowStep>([
        {
          uid: 'stpintro',
          id: 'introspect',
          requestUid: 'reqintro',
          captures: [{ uid: 'capactiv', name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
        },
        {
          ...loginStep('$.access_token'),
          uid: 'stprefsh',
          id: 'refresh',
          dependsOn: ['introspect'],
          runIf: {
            all: [
              { uid: 'gateactv', kind: 'capture-equals', stepId: 'introspect', captureName: 'active', value: 'false' },
            ],
          },
        },
      ]),
      adapterFor(),
    );

    expect(ok).toBe(true);
    expect(events).toEqual([
      {
        type: 'begin',
        at: 1,
        steps: [
          { id: 'introspect', uid: 'stpintro' },
          { id: 'refresh', uid: 'stprefsh' },
        ],
      },
      { type: 'step-start', at: 2, stepId: 'introspect', maxAttempts: 1 },
      {
        type: 'step-settle',
        at: 3,
        stepId: 'introspect',
        settlement: {
          state: 'passed',
          status: 200,
          durationMs: 10,
          responseBytes: 15,
          attempts: 1,
          maxAttempts: 1,
          captureNames: ['active'],
        },
        product: { kind: 'response', snapshot: snapshot(goldens.responses.introspect) },
      },
      { type: 'step-settle', at: 4, stepId: 'refresh', settlement: { state: 'skipped', unmet: ['gateactv'] } },
      { type: 'end', at: 5, ok: true, durationMs: 4 },
    ]);
  });
});

describe('attempts', () => {
  const retried: CallWorkflowStep = {
    ...profileStep,
    retry: { maxAttempts: 3, delayMs: 200, backoff: 'exponential', retryOn: ['eq', 503] },
  };

  it('an attempt another one follows ends with its cause and the wait; the last one is the settle', async () => {
    let calls = 0;
    const adapter: FetchAdapter = {
      async executeStep() {
        calls++;
        if (calls === 1) throw new Error('socket hang up');
        return {
          status: calls === 2 ? 503 : 200,
          statusText: '',
          url: 'https://api.openheaders.io/',
          headers: [],
          body: goldens.responses.profile,
        };
      },
    };

    const { events } = await eventsOf(workflowOf([retried]), adapter);

    expect(events.slice(1, 4)).toEqual([
      { type: 'step-start', at: 2, stepId: 'profile', maxAttempts: 3 },
      {
        type: 'attempt-end',
        at: 3,
        stepId: 'profile',
        attempt: 1,
        maxAttempts: 3,
        cause: { kind: 'error', message: 'socket hang up' },
        retryInMs: 200,
      },
      {
        type: 'attempt-end',
        at: 4,
        stepId: 'profile',
        attempt: 2,
        maxAttempts: 3,
        cause: { kind: 'status', status: 503 },
        retryInMs: 400,
      },
    ]);
    expect(events[4]).toMatchObject({
      type: 'step-settle',
      settlement: { state: 'passed', status: 200, attempts: 3, maxAttempts: 3 },
    });
  });

  it('a step that runs out of attempts settles failed once, with no attempt-end for the last', async () => {
    const adapter: FetchAdapter = {
      async executeStep() {
        throw new Error('socket hang up');
      },
    };

    const { events } = await eventsOf(workflowOf([retried]), adapter);

    expect(events.map((event) => event.type)).toEqual([
      'begin',
      'step-start',
      'attempt-end',
      'attempt-end',
      'step-settle',
      'end',
    ]);
    expect(events[4]).toEqual({
      type: 'step-settle',
      at: 5,
      stepId: 'profile',
      settlement: {
        state: 'failed',
        phase: 'fetch',
        reason: 'socket hang up (after 3 attempts)',
        attempts: 3,
        maxAttempts: 3,
      },
    });
  });
});

describe('a run with no listener', () => {
  it('reads the clock once, for its completion alone', async () => {
    const now = vi.fn(() => 42_000);
    const workflow = workflowOf([loginStep('$.access_token'), profileStep]);

    const outcome = await runChain({
      workflow,
      adapter: adapterFor(),
      context: { workflowUid: workflow.uid, workspaceId: 'ws-run-pins', environmentId: null },
      now,
    });

    expect(outcome.ok && outcome.completedAt).toBe(42_000);
    expect(now).toHaveBeenCalledTimes(1);
  });
});

describe('a run refused for a step this build does not know', () => {
  it('each such step cannot run by its sentence, no other step ran', () => {
    const workflow = workflowOf<WorkflowStep>([
      { uid: 'stpprobe', id: 'probe', action: 'listen' },
      loginStep('$.access_token'),
    ]);

    expect(refusedRunEvents(workflow, 7)).toEqual([
      {
        type: 'begin',
        at: 7,
        steps: [
          { id: 'probe', uid: 'stpprobe' },
          { id: 'login', uid: 'stplogin' },
        ],
      },
      {
        type: 'step-settle',
        at: 7,
        stepId: 'probe',
        settlement: {
          state: 'cannot-run',
          reason: 'Step "probe" needs a newer version of OpenHeaders (action "listen").',
        },
      },
      { type: 'step-settle', at: 7, stepId: 'login', settlement: { state: 'not-run' } },
      { type: 'end', at: 7, ok: false, durationMs: 0 },
    ]);
  });
});

describe('an event as it crosses to a page', () => {
  it('a settle leaves its product behind and says whether there is one', () => {
    const settle: WorkflowRunEvent = {
      type: 'step-settle',
      at: 3,
      stepId: 'login',
      settlement: { state: 'skipped' },
      product: { kind: 'response', snapshot: snapshot(goldens.responses.token) },
    };

    expect(runFactOf(settle)).toEqual({
      type: 'step-settle',
      at: 3,
      stepId: 'login',
      settlement: { state: 'skipped' },
      hasProduct: true,
    });
    expect(runFactOf({ type: 'step-settle', at: 4, stepId: 'profile', settlement: { state: 'not-run' } })).toEqual({
      type: 'step-settle',
      at: 4,
      stepId: 'profile',
      settlement: { state: 'not-run' },
      hasProduct: false,
    });
  });

  it('every other event crosses as it is', () => {
    const start: WorkflowRunEvent = { type: 'step-start', at: 2, stepId: 'login', maxAttempts: 1 };

    expect(runFactOf(start)).toBe(start);
  });
});
