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

async function feed(fact: WorkflowRunFact, runId = 'run-1'): Promise<void> {
  await act(async () => {
    h.onFrame?.({
      workspaceId: 'ws-run-pins',
      workflowUid: 'wfpins01',
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

  it('a new run of the workflow replaces the kept one and its products', async () => {
    await feed(BEGIN);
    await feed(LOGIN_PASSED);
    await feed(BEGIN, 'run-2');

    const kept = getKeptWorkflowRun('ws-run-pins', 'wfpins01');
    expect(kept?.record.runId).toBe('run-2');
    expect(kept?.products).toEqual({});
    expect(readKeptRunProduct('run-1', 'login')).toBeNull();
  });
});

describe('a run in the workflow view', () => {
  it('says there is no run in this session and names the button', () => {
    render(<SavedWorkflowView workflow={workflow} />);

    expect(screen.getByTestId('wf-run-empty').textContent).toBe(
      'No run in this session yet. Press Refresh to run this workflow.',
    );
    expect(screen.getByTestId('wf-view').hasAttribute('data-run-verdict')).toBe(false);
  });

  it('shows the rows live — waiting, sending, the attempt, then how each step ended', async () => {
    render(<SavedWorkflowView workflow={workflow} />);

    await feed(BEGIN);
    expect(screen.getByTestId('wf-view').getAttribute('data-run-verdict')).toBe('running');
    expect(screen.getByTestId('wf-run-row-login').textContent).toContain('Waiting');

    await feed(LOGIN_START);
    expect(screen.getByTestId('wf-run-row-login').textContent).toContain('Sending…');

    await feed(LOGIN_PASSED);
    const login = screen.getByTestId('wf-run-row-login');
    expect(login.getAttribute('data-run-state')).toBe('passed');
    expect(login.textContent).toContain('Call');
    expect(login.textContent).toContain('POST');
    expect(login.textContent).toContain('Login');
    expect(login.textContent).toContain('200 · 10 ms · 1 capture');

    await feed(PROFILE_START);
    await feed(PROFILE_RETRY);
    expect(screen.getByTestId('wf-run-row-profile').textContent).toContain('Sending… · Attempt 2 of 3');
  });

  it('a run failing at the fetch — the step before it passed, the failing row states the condition', async () => {
    render(<SavedWorkflowView workflow={workflow} />);

    for (const fact of [BEGIN, LOGIN_START, LOGIN_PASSED, PROFILE_START, PROFILE_FAILED, END]) await feed(fact);

    expect(screen.getByTestId('wf-run-verdict').textContent).toBe('Failed');
    expect(screen.getByTestId('wf-view').getAttribute('data-run-verdict')).toBe('failed');
    expect(screen.getByTestId('wf-run-rows').textContent).toContain('1 passed · 1 failed · 21 ms · No environment');
    expect(screen.getByTestId('wf-run-row-login').getAttribute('data-run-state')).toBe('passed');
    const profile = screen.getByTestId('wf-run-row-profile');
    expect(profile.getAttribute('data-run-state')).toBe('failed');
    expect(profile.textContent).toContain(REFUSED);
    // The sentence has the row's width from the step id on — a narrow pane never stacks it under the name alone.
    expect(within(profile).getByText(REFUSED).style.gridColumn).toBe('3 / -1');
    expect(screen.getByTestId('wf-run-rows').textContent).toContain(
      'Nothing was published. The last good values stay.',
    );
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
    expect(screen.queryByTestId('wf-run-rows')).toBeNull();

    fireEvent.click(screen.getByTestId('wf-panel-close'));
    fireEvent.click(screen.getByTestId('wf-run-row-login'));

    expect(screen.getByTestId('wf-run-product').getAttribute('data-step')).toBe('login');
    const body = await within(screen.getByTestId('wf-run-product')).findByTestId('wf-run-body');
    expect(body.textContent).toBe('{"name":"John Doe"}');
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
    expect(screen.getByTestId('wf-run-rows').textContent).toContain('No step ran.');
  });
});
