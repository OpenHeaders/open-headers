/**
 * A workflow's run in its view (the workflow runs plan, The Run view;
 * the workflows redesign): the page's run store fed by
 * `liveWorkflowRunEvent` frames, the rows the workflow's panel renders
 * and the product a step's panel opens to — on the pinned workflow
 * (login, then profile) failing at the fetch.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { WorkflowRunFact } from '@openheaders/core/live';
import { LiveWorkflowSchema } from '@openheaders/core/schemas';
import type { ExecutedRequestSnapshot, LiveWorkflow, Request } from '@openheaders/core/types';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import * as v from 'valibot';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  // The response views reach Monaco, which probes this at import time;
  // jsdom does not ship it, and an import outruns any top-level statement.
  if (typeof document.queryCommandSupported !== 'function') {
    document.queryCommandSupported = (() => false) as typeof document.queryCommandSupported;
  }
  return {
    onFrame: null as ((frame: LiveWorkflowRunEventWire) => void) | null,
    call: vi.fn(),
  };
});

vi.mock('@openheaders/core/bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@openheaders/core/bridge')>();
  return {
    ...actual,
    hostBridge: {
      ...actual.hostBridge,
      subscribe: (type: string, listener: (frame: LiveWorkflowRunEventWire) => void) => {
        if (type === 'liveWorkflowRunEvent') h.onFrame = listener;
        return () => undefined;
      },
      call: (...args: unknown[]) => h.call(...args),
    },
  };
});

// The body view mounts the code editor, which jsdom cannot host — the
// pane's own job here is which exchange a step opens to.
vi.mock('@openheaders/ui/workbench/components/request-editor/response/ResponseBodyView', () => ({
  default: ({ response }: { response: ExecutedRequestSnapshot }) => (
    <pre data-testid="wf-run-body">{response.body}</pre>
  ),
}));

vi.mock('@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId', () => ({
  useActiveWorkspaceId: () => 'ws-run-pins',
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useEnvironments', () => ({
  useEnvironments: () => ({ activeEnvironmentId: null, environments: [], isReady: true }),
}));
vi.mock('@openheaders/ui/shared/hooks/readers/useRequests', () => ({
  useRequests: () => ({
    requests: [makeRequest('reqtoken', 'Login', 'POST'), makeRequest('reqprofl', 'Profile', 'GET')],
    graphqlRequests: [],
    mqttRequests: [],
    collectionTrees: [],
    isReady: true,
  }),
}));

import {
  __resetWorkflowRunStoreForTests,
  getKeptWorkflowRun,
  getKeptWorkflowRuns,
  installWorkflowRunStore,
  readKeptRunProduct,
} from '@openheaders/ui/workbench/data/workflow-run-store';
import { SavedWorkflowView } from '../helpers/workflow-view-harness';

beforeAll(async () => {
  // The response views load when a step is first opened; load them once
  // here so a test waits for a render, not for the import.
  await import('@openheaders/ui/workbench/components/live/WorkflowRunResponse');
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

const REFUSED = 'Connection refused by 127.0.0.1.';

function makeRequest(uid: string, name: string, method: Request['method']): Request {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/my-requests-colpins1/${uid}`,
    name,
    method,
    url: `https://api.openheaders.io/${uid}`,
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  };
}

const workflow: LiveWorkflow = {
  schemaVersion: 5,
  uid: 'wfpins01',
  path: 'live-workflows/token-chain-wfpins01',
  name: 'Token chain',
  enabled: true,
  refresh: { kind: 'manual' },
  steps: [
    {
      uid: 'stplogin',
      id: 'login',
      requestUid: 'reqtoken',
      captures: [{ uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
    },
    {
      uid: 'stpprofl',
      id: 'profile',
      requestUid: 'reqprofl',
      captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
    },
  ],
};

const needsUpdateWorkflow: LiveWorkflow = v.parse(LiveWorkflowSchema, {
  ...workflow,
  uid: 'wfdevice',
  steps: [{ uid: 'stplistn', id: 'probe', action: 'watch', session: 'mqttreq1' }, workflow.steps[0]],
});

function snapshot(body: string, error: string | null = null): ExecutedRequestSnapshot {
  return {
    status: error === null ? 200 : 0,
    statusText: error === null ? 'OK' : '',
    url: 'https://api.openheaders.io/',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: body.length,
    durationMs: 10,
    error,
  };
}

const BEGIN: WorkflowRunFact = {
  type: 'begin',
  at: 100,
  steps: [
    { id: 'login', uid: 'stplogin' },
    { id: 'profile', uid: 'stpprofl' },
  ],
};
const LOGIN_START: WorkflowRunFact = { type: 'step-start', at: 101, stepId: 'login', maxAttempts: 1 };
const LOGIN_PASSED: WorkflowRunFact = {
  type: 'step-settle',
  at: 111,
  stepId: 'login',
  settlement: {
    state: 'passed',
    status: 200,
    durationMs: 10,
    responseBytes: 44,
    attempts: 1,
    maxAttempts: 1,
    captureNames: ['token'],
  },
  hasProduct: true,
};
const PROFILE_START: WorkflowRunFact = { type: 'step-start', at: 112, stepId: 'profile', maxAttempts: 3 };
const PROFILE_RETRY: WorkflowRunFact = {
  type: 'attempt-end',
  at: 113,
  stepId: 'profile',
  attempt: 1,
  maxAttempts: 3,
  cause: { kind: 'error', message: REFUSED },
  retryInMs: 200,
};
const PROFILE_FAILED: WorkflowRunFact = {
  type: 'step-settle',
  at: 120,
  stepId: 'profile',
  settlement: { state: 'failed', phase: 'fetch', reason: REFUSED, attempts: 3, maxAttempts: 3 },
  hasProduct: true,
};
const END: WorkflowRunFact = { type: 'end', at: 121, ok: false, durationMs: 21 };

let seq = 0;

async function feed(fact: WorkflowRunFact, runId = 'run-1', workflowUid = 'wfpins01'): Promise<void> {
  await act(async () => {
    h.onFrame?.({
      workspaceId: 'ws-run-pins',
      workflowUid,
      environmentId: null,
      runId,
      seq: seq++,
      fact,
    });
  });
}

beforeEach(() => {
  seq = 0;
  h.call.mockReset();
  h.call.mockImplementation(async (type: string, payload: { runId: string; stepId: string }) => {
    if (type !== 'getLiveWorkflowRunProduct') throw new Error(`unexpected call ${type}`);
    if (payload.stepId === 'login') return { product: { kind: 'response', snapshot: snapshot('{"name":"John Doe"}') } };
    return { product: { kind: 'response', snapshot: snapshot('', REFUSED) } };
  });
  installWorkflowRunStore();
});

afterEach(() => {
  cleanup();
  __resetWorkflowRunStoreForTests();
});

describe('the page keeps a run from its frames', () => {
  it('asks for a step product as its settle arrives and keeps it by run and step', async () => {
    await feed(BEGIN);
    await feed(LOGIN_START);
    await feed(LOGIN_PASSED);

    expect(h.call).toHaveBeenCalledWith('getLiveWorkflowRunProduct', { runId: 'run-1', stepId: 'login' });
    expect(getKeptWorkflowRun('ws-run-pins', 'wfpins01')?.products).toEqual({ login: 'kept' });
    expect(readKeptRunProduct('run-1', 'login')).toMatchObject({ snapshot: { body: '{"name":"John Doe"}' } });
  });

  it('marks a product gone when the realm that ran the step no longer holds it', async () => {
    h.call.mockImplementation(async () => ({ product: null }));

    await feed(BEGIN);
    await feed(LOGIN_PASSED);

    expect(getKeptWorkflowRun('ws-run-pins', 'wfpins01')?.products).toEqual({ login: 'gone' });
  });

  it('a new run of the workflow joins the kept ones as the latest; the earlier run and its products stay', async () => {
    await feed(BEGIN);
    await feed(LOGIN_PASSED);
    await feed(BEGIN, 'run-2');

    const latest = getKeptWorkflowRun('ws-run-pins', 'wfpins01');
    expect(latest?.record.runId).toBe('run-2');
    expect(latest?.products).toEqual({});
    const runs = getKeptWorkflowRuns('ws-run-pins', 'wfpins01');
    expect(runs.map((run) => run.record.runId)).toEqual(['run-2', 'run-1']);
    expect(runs[1].products).toEqual({ login: 'kept' });
    expect(readKeptRunProduct('run-1', 'login')).toMatchObject({ snapshot: { body: '{"name":"John Doe"}' } });
  });

  it('a fact lands on its own run, the latest or an earlier one still going', async () => {
    await feed(BEGIN);
    await feed(BEGIN, 'run-2');
    await feed(LOGIN_START, 'run-2');
    await feed(LOGIN_PASSED);
    await feed(END);

    const [latest, earlier] = getKeptWorkflowRuns('ws-run-pins', 'wfpins01');
    expect(latest.record).toMatchObject({ runId: 'run-2', ended: null });
    expect(latest.record.steps[0].state).toBe('running');
    expect(earlier.record).toMatchObject({ runId: 'run-1', ended: { ok: false, durationMs: 21 } });
    expect(earlier.products).toEqual({ login: 'kept' });
  });

  it('keeps what started each run, and nothing where its first frame named none', async () => {
    await feed({ ...BEGIN, trigger: 'schedule' });
    await feed({ ...BEGIN, trigger: 'agent' }, 'run-2');
    await feed(BEGIN, 'run-3');

    expect(getKeptWorkflowRuns('ws-run-pins', 'wfpins01').map((run) => run.record.trigger)).toEqual([
      undefined,
      'agent',
      'schedule',
    ]);
  });

  it('keeps the last twenty runs of a workflow; the run before them goes with its products', async () => {
    await feed(BEGIN, 'run-0');
    await feed(LOGIN_PASSED, 'run-0');
    for (let n = 1; n <= 20; n += 1) {
      await feed(BEGIN, `run-${n}`);
      await feed(LOGIN_PASSED, `run-${n}`);
    }

    const runs = getKeptWorkflowRuns('ws-run-pins', 'wfpins01');
    expect(runs).toHaveLength(20);
    expect(runs[0].record.runId).toBe('run-20');
    expect(runs[19].record.runId).toBe('run-1');
    expect(readKeptRunProduct('run-0', 'login')).toBeNull();
    expect(readKeptRunProduct('run-1', 'login')).not.toBeNull();
  });

  it('a workflow with no run on this page lists none', () => {
    expect(getKeptWorkflowRuns('ws-run-pins', 'wfpins01')).toEqual([]);
    expect(getKeptWorkflowRun('ws-run-pins', 'wfpins01')).toBeNull();
  });
});

describe('a run in the workflow view', () => {
  it('says there is no run in this session and names the button', () => {
    render(<SavedWorkflowView workflow={workflow} />);

    expect(screen.getByTestId('wf-run-empty').textContent).toBe('No run in this session yet. Press Run to start one.');
    expect(screen.getByTestId('wf-view').hasAttribute('data-run-verdict')).toBe(false);
  });

  it('shows the rows live — what each step does, then waiting, sending, the attempt, and how each step ended', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    const steps = () => screen.getByTestId('wf-steps').textContent ?? '';
    expect(steps()).toContain('StepTypeDoes');
    expect(screen.getByTestId('wf-run-row-login').textContent).toBe('loginHTTPCallPOST Login');
    expect(screen.getByTestId('wf-run-row-login').getAttribute('data-run-state')).toBe('idle');

    await feed(BEGIN);
    expect(steps()).toContain('StepTypeLast run');
    expect(screen.getByTestId('wf-view').getAttribute('data-run-verdict')).toBe('running');
    expect(screen.getByTestId('wf-run-row-login').textContent).toContain('Waiting');

    await feed(LOGIN_START);
    expect(screen.getByTestId('wf-run-row-login').textContent).toContain('Sending…');

    await feed(LOGIN_PASSED);
    const login = screen.getByTestId('wf-run-row-login');
    expect(login.getAttribute('data-run-state')).toBe('passed');
    expect(login.textContent).toBe('loginHTTPCall200 · 10 ms · 1 capture');

    await feed(PROFILE_START);
    await feed(PROFILE_RETRY);
    expect(screen.getByTestId('wf-run-row-profile').textContent).toContain('Sending… · Attempt 2 of 3');
  });

  it('the graph’s nodes wear the run’s marks as it goes, each with the row’s words on its last line', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    const markOf = (stepId: string) => screen.getByTestId(`wf-graph-run-${stepId}`).getAttribute('data-run-state');
    const lineOf = (stepId: string) => screen.queryByTestId(`wf-graph-result-${stepId}`)?.textContent ?? null;
    expect(markOf('login')).toBe('idle');
    expect(lineOf('login')).toBeNull();

    await feed(BEGIN);
    expect(markOf('login')).toBe('waiting');
    expect(markOf('profile')).toBe('waiting');

    await feed(LOGIN_START);
    expect(markOf('login')).toBe('running');
    expect(lineOf('login')).toBe('Sending…');

    await feed(LOGIN_PASSED);
    expect(markOf('login')).toBe('passed');
    expect(lineOf('login')).toBe('200 · 10 ms · 1 capture');

    await feed(PROFILE_START);
    expect(markOf('profile')).toBe('running');
    await feed(PROFILE_RETRY);
    expect(markOf('profile')).toBe('retrying');
    expect(lineOf('profile')).toBe('Sending… · Attempt 2 of 3');

    await feed(PROFILE_FAILED);
    expect(markOf('profile')).toBe('failed');
    expect(screen.getByTestId('wf-graph-result-profile').getAttribute('title')).toBe(`Failed: ${REFUSED}`);
  });

  it('a run failing at the fetch — the step before it passed, the failing row states the condition', async () => {
    render(<SavedWorkflowView workflow={workflow} />);

    for (const fact of [BEGIN, LOGIN_START, LOGIN_PASSED, PROFILE_START, PROFILE_FAILED, END]) await feed(fact);

    expect(screen.getByTestId('wf-run-verdict').textContent).toBe('Failed');
    expect(screen.getByTestId('wf-view').getAttribute('data-run-verdict')).toBe('failed');
    const lastRun = screen.getByTestId('wf-last-run');
    expect(lastRun.textContent).toContain('profile failed, and the run ended there.');
    expect(screen.getByTestId('wf-last-run-passed').textContent).toBe('Passed1');
    expect(screen.getByTestId('wf-last-run-failed').textContent).toBe('Failed1');
    expect(screen.getByTestId('wf-last-run-duration').textContent).toBe('Duration21 ms');
    expect(screen.getByTestId('wf-last-run-environment').textContent).toBe('EnvironmentNo environment');
    expect(screen.getByTestId('wf-run-row-login').getAttribute('data-run-state')).toBe('passed');
    const profile = screen.getByTestId('wf-run-row-profile');
    expect(profile.getAttribute('data-run-state')).toBe('failed');
    expect(profile.textContent).toContain(REFUSED);
    // The sentence is a line of its own, the row wide — a narrow pane never stacks it under the name alone.
    expect(within(profile).getByText(REFUSED).className).toBe('oh-wf-row-line');
    expect(lastRun.textContent).toContain('Nothing was published. The last good values stay.');
  });

  it('what needs attention is the step the run stopped at, with its reason, and its row opens the step', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    const attention = () => screen.getByTestId('wf-attention').textContent ?? '';
    expect(attention()).toContain('Nothing yet. Run the workflow first.');

    for (const fact of [BEGIN, LOGIN_START, LOGIN_PASSED]) await feed(fact);
    expect(attention()).toContain('No problems so far.');

    for (const fact of [PROFILE_START, PROFILE_FAILED, END]) await feed(fact);
    expect(screen.queryByTestId('wf-attention-login')).toBeNull();
    expect(screen.getByTestId('wf-attention-profile').textContent).toBe(`profileHTTPCallFailed${REFUSED}`);
    fireEvent.click(screen.getByTestId('wf-attention-profile'));

    expect(screen.getByTestId('wf-panel').querySelector('[data-step-card]')?.getAttribute('data-step-card')).toBe(
      'profile',
    );
  });

  it('the arrows at a row’s end set the step’s place, and the card’s head adds a step and opens it', () => {
    render(<SavedWorkflowView workflow={workflow} />);
    const order = () =>
      Array.from(screen.getByTestId('wf-steps').querySelectorAll('[data-testid^="wf-run-row-"]')).map((row) =>
        row.getAttribute('data-testid'),
      );
    expect(order()).toEqual(['wf-run-row-login', 'wf-run-row-profile']);
    expect(screen.getByTestId('wf-step-up-login')).toHaveProperty('disabled', true);
    expect(screen.getByTestId('wf-step-down-profile')).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByTestId('wf-step-down-login'));
    expect(order()).toEqual(['wf-run-row-profile', 'wf-run-row-login']);
    expect(screen.getByTestId('wf-panel').textContent).toContain('2 steps');

    fireEvent.click(screen.getByTestId('wf-steps-add'));
    fireEvent.click(screen.getByTestId('wf-step-picker-kind-call'));
    expect(within(screen.getByTestId('wf-panel')).getByText('Step 3 of 3')).toBeTruthy();
  });

  it('the captures of the workflow say which step captures each', () => {
    render(<SavedWorkflowView workflow={workflow} />);

    expect(screen.getByTestId('wf-capture-login-token').textContent).toBe('tokenlogin—');
    expect(screen.getByTestId('wf-capture-profile-name').textContent).toBe('nameprofile—');
  });

  it('a row opens its step: the panel shows the step with what it produced, and closing it returns to the rows', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    for (const fact of [BEGIN, LOGIN_START, LOGIN_PASSED, PROFILE_START, PROFILE_FAILED, END]) await feed(fact);
    expect(screen.queryByTestId('wf-run-product')).toBeNull();

    fireEvent.click(screen.getByTestId('wf-run-row-profile'));

    const pane = screen.getByTestId('wf-run-product');
    expect(pane.getAttribute('data-step')).toBe('profile');
    expect(await within(pane).findByText(REFUSED)).toBeTruthy();
    expect(within(screen.getByTestId('wf-panel')).getByText('Step 2 of 2')).toBeTruthy();
    expect(screen.queryByTestId('wf-steps')).toBeNull();

    fireEvent.click(screen.getByTestId('wf-panel-close'));
    fireEvent.click(screen.getByTestId('wf-run-row-login'));

    expect(screen.getByTestId('wf-run-product').getAttribute('data-step')).toBe('login');
    const body = await within(screen.getByTestId('wf-run-product')).findByTestId('wf-run-body');
    expect(body.textContent).toBe('{"name":"John Doe"}');
    const card = within(screen.getByTestId('wf-step-product'));
    expect(card.getByRole('heading', { name: 'Response' })).toBeTruthy();
    expect(card.getByText('What the request returned in the last run.')).toBeTruthy();
  });

  it('the response card is there once the step has something to show, and says so when the page no longer keeps it', async () => {
    h.call.mockImplementation(async () => ({ product: null }));
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(screen.getByTestId('wf-graph-node-login'));
    for (const fact of [BEGIN, LOGIN_START]) await feed(fact);
    expect(screen.queryByTestId('wf-step-product')).toBeNull();

    await feed(LOGIN_PASSED);

    expect(screen.getByTestId('wf-step-product').textContent).toBe(
      'ResponseWhat the request returned in the last run.The response of this step is no longer kept.',
    );
    expect(screen.getByTestId('wf-run-product').getAttribute('data-step')).toBe('login');
  });

  it('an open step’s panel leads with what the last run made of it, live as the run goes', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(screen.getByTestId('wf-graph-node-login'));
    const card = () => screen.getByTestId('wf-step-last-run');
    const state = () => screen.getByTestId('wf-step-last-run-state');
    expect(state().getAttribute('data-run-state')).toBe('idle');
    expect(card().textContent).toBe('Last runPress Run to see what this step does.Not run yetStatusNot run yet');

    await feed(BEGIN);
    expect(state().textContent).toBe('Waiting');
    await feed(LOGIN_START);
    expect(state().getAttribute('data-run-state')).toBe('running');
    expect(card().textContent).toContain('Sending…');

    await feed(LOGIN_PASSED);
    expect(state().textContent).toBe('Passed');
    expect(card().textContent).toContain('Returned 200.');
    expect(screen.getByTestId('wf-step-last-run-response').textContent).toBe('Response200');
    expect(screen.getByTestId('wf-step-last-run-duration').textContent).toBe('Duration10 ms');
    expect(screen.getByTestId('wf-step-last-run-size').textContent).toBe('Size44 B');
    expect(screen.queryByTestId('wf-step-last-run-timing')).toBeNull();
  });

  it('a step’s Depends on row says how the run left that step, and opens it', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    for (const fact of [BEGIN, LOGIN_START, LOGIN_PASSED, PROFILE_START, PROFILE_FAILED, END]) await feed(fact);
    fireEvent.click(screen.getByTestId('wf-graph-node-profile'));

    const row = screen.getByTestId('wf-step-1-dep-login');
    expect(row.textContent).toBe('loginHTTPPassed');
    expect(screen.getByTestId('wf-step-1-deps').textContent).toContain('By default it waits for the step before it.');
    fireEvent.click(within(row).getAllByRole('button')[0]);

    expect(screen.getByTestId('wf-panel').querySelector('[data-step-card]')?.getAttribute('data-step-card')).toBe(
      'login',
    );
    expect(screen.getByTestId('wf-step-0-dependent-profile').textContent).toBe('profileHTTPFailed');
  });

  it('a workflow that needs a newer version shows which steps cannot run, with no run behind them', () => {
    render(<SavedWorkflowView workflow={needsUpdateWorkflow} needsUpdate />);

    expect(screen.getByTestId('wf-run-verdict').textContent).toBe('Cannot run here');
    const probe = screen.getByTestId('wf-run-row-probe');
    expect(probe.getAttribute('data-run-state')).toBe('cannot-run');
    expect(probe.textContent).toContain('watch');
    expect(probe.textContent).toContain('Cannot run here');
    expect(probe.textContent).toContain('Step "probe" needs a newer version of OpenHeaders (action "watch").');
    expect(screen.getByTestId('wf-run-row-login').getAttribute('data-run-state')).toBe('not-run');
    expect(screen.getByTestId('wf-last-run').textContent).toContain('No step ran.');
  });
});

describe('the workflow’s History', () => {
  const tab = (id: 'overview' | 'history') => screen.getByTestId(`wf-panel-tab-${id}`);
  const rows = () => Array.from(screen.getByTestId('wf-history').querySelectorAll('[data-testid^="wf-history-row-"]'));

  it('a saved workflow’s panel has two tabs, Overview first, History with how many runs this page saw', async () => {
    render(<SavedWorkflowView workflow={workflow} />);

    expect(tab('overview').getAttribute('aria-selected')).toBe('true');
    expect(tab('history').getAttribute('aria-selected')).toBe('false');
    expect(tab('history').textContent).toBe('History0');
    expect(screen.queryByTestId('wf-history')).toBeNull();

    await feed(BEGIN);
    await feed(BEGIN, 'run-2');
    expect(screen.getByTestId('wf-history-count').textContent).toBe('2');
  });

  it('with no run yet, History says so and names the button', () => {
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(tab('history'));

    expect(tab('history').getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('wf-last-run')).toBeNull();
    expect(screen.getByTestId('wf-history-empty').textContent).toBe(
      'No run in this session yet. Press Run to start one.',
    );
    expect(rows()).toEqual([]);
  });

  it('lists the runs newest first: when and where, the result, the steps, the duration, what started it', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(tab('history'));

    await feed({ ...BEGIN, at: Date.now(), trigger: 'schedule' });
    await feed(LOGIN_PASSED);
    await feed(PROFILE_FAILED);
    await feed(END);
    await feed({ ...BEGIN, trigger: 'manual' }, 'run-2');
    await feed(LOGIN_PASSED, 'run-2');

    const history = screen.getByTestId('wf-history');
    expect(history.textContent).toContain('The last 20 runs of this session, newest first.');
    expect(history.textContent).toContain('WhenResultStepsDurationTrigger');
    expect(rows().map((row) => row.getAttribute('data-testid'))).toEqual([
      'wf-history-row-run-2',
      'wf-history-row-run-1',
    ]);

    const [going, ended] = rows();
    expect(going.getAttribute('data-run-verdict')).toBe('running');
    expect(going.textContent).toBe('NowNo environmentRunning1 of 2 done—Manual');
    expect(ended.getAttribute('data-run-verdict')).toBe('failed');
    expect(ended.textContent).toMatch(/^\d{2}:\d{2}:\d{2}.*No environmentFailedPassed 1 · Failed 121 msSchedule$/);
  });

  it('the run the graph draws is the highlighted one, and the foot says so', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(tab('history'));
    await feed(BEGIN);
    await feed(END);
    await feed(BEGIN, 'run-2');

    expect(screen.getByTestId('wf-history-row-run-2').getAttribute('data-shown')).toBe('true');
    expect(screen.getByTestId('wf-history-row-run-1').hasAttribute('data-shown')).toBe(false);
    expect(screen.getByTestId('wf-history').textContent).toContain(
      'The highlighted run is the one drawn on the graph.',
    );
  });

  it('a run whose first frame named no trigger shows a dash, and a run that could not run no duration', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(tab('history'));
    await feed(BEGIN);
    await feed({
      type: 'step-settle',
      at: 101,
      stepId: 'login',
      settlement: { state: 'cannot-run', reason: 'Needs a newer version.' },
      hasProduct: false,
    });
    await feed({
      type: 'step-settle',
      at: 101,
      stepId: 'profile',
      settlement: { state: 'not-run' },
      hasProduct: false,
    });
    await feed({ type: 'end', at: 101, ok: false, durationMs: 0 });

    expect(screen.getByTestId('wf-history-row-run-1').textContent).toMatch(
      /No environmentCannot run hereNot run 1 · Cannot run here 1——$/,
    );
  });

  it('a step opened and closed returns to the tab that was open', async () => {
    render(<SavedWorkflowView workflow={workflow} />);
    fireEvent.click(tab('history'));
    await feed(BEGIN);

    fireEvent.click(screen.getByTestId('wf-graph-node-login'));
    expect(screen.queryByTestId('wf-history')).toBeNull();
    fireEvent.click(screen.getByTestId('wf-panel-close'));

    expect(tab('history').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('wf-history-row-run-1')).toBeTruthy();
  });

  describe('a run picked from the list', () => {
    const view = () => screen.getByTestId('wf-view');
    const markOf = (stepId: string) => screen.getByTestId(`wf-graph-run-${stepId}`).getAttribute('data-run-state');
    const shownRow = () => rows().filter((row) => row.getAttribute('data-shown') === 'true');

    /** `run-1` failed at the fetch; `run-2`, the latest, passed its login and is still going. */
    async function twoRuns(): Promise<void> {
      await feed({ ...BEGIN, at: Date.now() });
      for (const fact of [LOGIN_START, LOGIN_PASSED, PROFILE_START, PROFILE_FAILED, END]) await feed(fact);
      for (const fact of [BEGIN, LOGIN_START, LOGIN_PASSED]) await feed(fact, 'run-2');
    }

    it('a press of a row draws that run on the whole view, and the panel’s head says which', async () => {
      render(<SavedWorkflowView workflow={workflow} />);
      await twoRuns();
      fireEvent.click(tab('history'));
      expect(screen.queryByTestId('wf-shown-run')).toBeNull();
      expect(view().getAttribute('data-run-verdict')).toBe('running');
      expect(markOf('profile')).toBe('waiting');

      fireEvent.click(screen.getByTestId('wf-history-row-run-1'));

      expect(shownRow().map((row) => row.getAttribute('data-testid'))).toEqual(['wf-history-row-run-1']);
      const bar = screen.getByTestId('wf-shown-run');
      expect(bar.getAttribute('data-run-id')).toBe('run-1');
      expect(bar.textContent).toMatch(/^Showing the run of \d{2}:\d{2}:\d{2}.* · FailedBack to latest$/);
      expect(view().getAttribute('data-run-verdict')).toBe('failed');
      expect(markOf('login')).toBe('passed');
      expect(markOf('profile')).toBe('failed');

      fireEvent.click(tab('overview'));
      expect(screen.getByTestId('wf-run-verdict').textContent).toBe('Failed');
      expect(screen.getByTestId('wf-last-run').textContent).toContain('profile failed, and the run ended there.');
      expect(screen.getByTestId('wf-run-row-profile').getAttribute('data-run-state')).toBe('failed');
    });

    it('a step’s panel is the picked run’s too, under the same line, with what the step produced in it', async () => {
      render(<SavedWorkflowView workflow={workflow} />);
      await twoRuns();
      fireEvent.click(tab('history'));
      fireEvent.click(screen.getByTestId('wf-history-row-run-1'));

      fireEvent.click(screen.getByTestId('wf-graph-node-profile'));

      expect(screen.getByTestId('wf-shown-run').getAttribute('data-run-id')).toBe('run-1');
      expect(screen.getByTestId('wf-step-last-run-state').textContent).toBe('Failed');
      const pane = screen.getByTestId('wf-run-product');
      expect(pane.getAttribute('data-step')).toBe('profile');
      expect(await within(pane).findByText(REFUSED)).toBeTruthy();
    });

    it('Back to latest returns the whole view to the latest run', async () => {
      render(<SavedWorkflowView workflow={workflow} />);
      await twoRuns();
      fireEvent.click(tab('history'));
      fireEvent.click(screen.getByTestId('wf-history-row-run-1'));
      fireEvent.click(screen.getByTestId('wf-graph-node-profile'));

      fireEvent.click(screen.getByTestId('wf-shown-run-latest'));

      expect(screen.queryByTestId('wf-shown-run')).toBeNull();
      expect(view().getAttribute('data-run-verdict')).toBe('running');
      expect(markOf('profile')).toBe('waiting');
      expect(screen.getByTestId('wf-step-last-run-state').textContent).toBe('Waiting');
      expect(screen.queryByTestId('wf-run-product')).toBeNull();
      fireEvent.click(screen.getByTestId('wf-panel-close'));
      expect(shownRow().map((row) => row.getAttribute('data-testid'))).toEqual(['wf-history-row-run-2']);
    });

    it('a press of the latest run’s row is the latest: no line at the head', async () => {
      render(<SavedWorkflowView workflow={workflow} />);
      await twoRuns();
      fireEvent.click(tab('history'));
      fireEvent.click(screen.getByTestId('wf-history-row-run-1'));

      fireEvent.click(screen.getByTestId('wf-history-row-run-2'));

      expect(screen.queryByTestId('wf-shown-run')).toBeNull();
      expect(shownRow().map((row) => row.getAttribute('data-testid'))).toEqual(['wf-history-row-run-2']);
      expect(view().getAttribute('data-run-verdict')).toBe('running');
    });

    it('a new run of the workflow returns the view to the latest', async () => {
      render(<SavedWorkflowView workflow={workflow} />);
      await twoRuns();
      fireEvent.click(tab('history'));
      fireEvent.click(screen.getByTestId('wf-history-row-run-1'));
      expect(markOf('profile')).toBe('failed');

      await feed(BEGIN, 'run-3');

      expect(screen.queryByTestId('wf-shown-run')).toBeNull();
      expect(shownRow().map((row) => row.getAttribute('data-testid'))).toEqual(['wf-history-row-run-3']);
      expect(markOf('login')).toBe('waiting');
      expect(markOf('profile')).toBe('waiting');
    });

    it('a workflow that needs a newer version draws a pressed run over its record, and returns to the record', async () => {
      await feed(BEGIN, 'run-1', 'wfdevice');
      await feed(LOGIN_PASSED, 'run-1', 'wfdevice');
      render(<SavedWorkflowView workflow={needsUpdateWorkflow} needsUpdate />);
      fireEvent.click(tab('history'));
      expect(shownRow()).toEqual([]);

      fireEvent.click(screen.getByTestId('wf-history-row-run-1'));

      expect(screen.getByTestId('wf-shown-run').getAttribute('data-run-id')).toBe('run-1');
      expect(markOf('login')).toBe('passed');

      fireEvent.click(screen.getByTestId('wf-shown-run-latest'));

      expect(markOf('probe')).toBe('cannot-run');
      expect(shownRow()).toEqual([]);
    });
  });
});
