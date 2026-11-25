/**
 * Step events of a run in the extension's worker (the workflow runs
 * plan, The Run view): what the chain adapter puts on the broadcast and
 * what it holds for the page, beside the commits the golden pins freeze.
 */

import type { LiveWorkflowRunEventWire } from '@openheaders/core/bridge';
import type { ExecutionPolicyResult } from '@openheaders/core/live';
import type { LiveWorkflow, Request, WorkflowStep } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const executeForLiveChainMock = vi.fn();

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/request-executor', () => ({
  executeForLiveChain: (...args: unknown[]) => executeForLiveChainMock(...args),
}));

vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequestInWorkspace: (uid: string, _workspaceId: string) => makeRequest(uid),
  getGraphqlRequestInWorkspace: () => null,
}));

vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  putWorkflowRunCache: vi.fn(),
  recordRefreshError: vi.fn(),
  recordManualBypassFailureForRun: vi.fn(),
}));

vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  publishLiveVariablesProducedByRun: vi.fn(),
}));

vi.mock('@openheaders/oracle/live/execution-policy-resolver', () => ({
  deriveExecutionPolicyForWorkflow: (): ExecutionPolicyResult => ({
    policy: 'idempotent',
    reasons: [],
    credentialStepIds: new Set<string>(),
  }),
}));

vi.mock('@/background/modules/live-refresh-scheduler', () => ({
  __setLiveRefreshAdapter: vi.fn(),
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

const REFUSED = 'Connection refused by 127.0.0.1.';
const TOKEN_BODY = '{"access_token":"tok-abc","expires_in":3600}';

function makeRequest(uid: string): Request {
  return {
    schemaVersion: 5,
    uid,
    path: `requests/my-requests-colpins1/${uid}`,
    name: uid,
    method: 'GET',
    url: `https://api.openheaders.io/${uid}`,
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
  };
}

function answer(body: string, error: string | null = null) {
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
    scripts: null,
  };
}

function makeWorkflow(steps: WorkflowStep[]): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wfpins01',
    path: 'live-workflows/token-chain-wfpins01',
    name: 'Token chain',
    steps,
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
  };
}

const loginStep: WorkflowStep = {
  uid: 'stplogin',
  id: 'login',
  requestUid: 'reqtoken',
  captures: [{ uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
};

const profileStep: WorkflowStep = {
  uid: 'stpprofl',
  id: 'profile',
  requestUid: 'reqprofl',
  captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
};

let adapterModule: typeof import('@/background/modules/live-chain-adapter');
let feedModule: typeof import('@openheaders/oracle/live/workflow-run-feed');
let frames: LiveWorkflowRunEventWire[];

beforeEach(async () => {
  vi.resetModules();
  executeForLiveChainMock.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1_753_000_000_000);
  adapterModule = await import('@/background/modules/live-chain-adapter');
  feedModule = await import('@openheaders/oracle/live/workflow-run-feed');
  frames = [];
  feedModule.setWorkflowRunEventSink((frame) => frames.push(frame));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe('the step events of a run in the worker', () => {
  it('failing at a fetch — the facts ride the broadcast under the caller id, the step before it passed', async () => {
    executeForLiveChainMock.mockImplementation(async (request: Request) =>
      request.uid === 'reqprofl' ? answer('', REFUSED) : answer(TOKEN_BODY),
    );

    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-run-pins',
        workflow: makeWorkflow([loginStep, profileStep]),
        environmentId: null,
        runId: 'run-from-page',
      }),
    ).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(frames.map((frame) => [frame.runId, frame.seq, frame.fact.type])).toEqual([
      ['run-from-page', 0, 'begin'],
      ['run-from-page', 1, 'step-start'],
      ['run-from-page', 2, 'step-settle'],
      ['run-from-page', 3, 'step-start'],
      ['run-from-page', 4, 'step-settle'],
      ['run-from-page', 5, 'end'],
    ]);
    expect(frames[2].fact).toMatchObject({
      stepId: 'login',
      settlement: { state: 'passed', status: 200, durationMs: 10, captureNames: ['token'] },
      hasProduct: true,
    });
    expect(frames[4].fact).toMatchObject({
      stepId: 'profile',
      settlement: { state: 'failed', phase: 'fetch', reason: REFUSED },
      hasProduct: true,
    });
    expect(frames[5]).toMatchObject({ workspaceId: 'ws-run-pins', workflowUid: 'wfpins01', environmentId: null });
    expect(JSON.stringify(frames)).not.toContain('tok-abc');
  });

  it("holds each step's exchange for the page — the response, and the failure's own record", async () => {
    executeForLiveChainMock.mockImplementation(async (request: Request) =>
      request.uid === 'reqprofl' ? answer('', REFUSED) : answer(TOKEN_BODY),
    );

    await adapterModule.liveChainAdapter
      .refreshWorkflow({
        workspaceId: 'ws-run-pins',
        workflow: makeWorkflow([loginStep, profileStep]),
        environmentId: null,
        runId: 'run-from-page',
      })
      .catch(() => undefined);

    expect(feedModule.getWorkflowRunProduct('run-from-page', 'login')).toMatchObject({
      kind: 'response',
      snapshot: { status: 200, body: TOKEN_BODY, durationMs: 10 },
    });
    expect(feedModule.getWorkflowRunProduct('run-from-page', 'profile')).toMatchObject({
      kind: 'response',
      snapshot: { status: 0, error: REFUSED },
    });
  });

  it('a run nobody started from a page gets an id of its own', async () => {
    executeForLiveChainMock.mockImplementation(async () => answer(TOKEN_BODY));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-run-pins',
      workflow: makeWorkflow([loginStep]),
      environmentId: null,
    });

    expect(frames[0].runId).not.toBe('');
    expect(new Set(frames.map((frame) => frame.runId)).size).toBe(1);
  });

  it('a refused run — each step this build does not know cannot run, nothing is sent', async () => {
    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-run-pins',
        workflow: makeWorkflow([{ uid: 'stpprobe', id: 'probe', action: 'listen' }, loginStep]),
        environmentId: null,
        runId: 'run-refused',
      }),
    ).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(executeForLiveChainMock).not.toHaveBeenCalled();
    expect(frames.map((frame) => frame.fact)).toEqual([
      {
        type: 'begin',
        at: 1_753_000_000_000,
        steps: [
          { id: 'probe', uid: 'stpprobe' },
          { id: 'login', uid: 'stplogin' },
        ],
      },
      {
        type: 'step-settle',
        at: 1_753_000_000_000,
        stepId: 'probe',
        settlement: {
          state: 'cannot-run',
          reason: 'Step "probe" needs a newer version of OpenHeaders (action "listen").',
        },
        hasProduct: false,
      },
      {
        type: 'step-settle',
        at: 1_753_000_000_000,
        stepId: 'login',
        settlement: { state: 'not-run' },
        hasProduct: false,
      },
      { type: 'end', at: 1_753_000_000_000, ok: false, durationMs: 0 },
    ]);
  });
});
