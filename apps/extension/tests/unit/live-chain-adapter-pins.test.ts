/**
 * Golden pins for an HTTP-only workflow in the extension (the workflow
 * runs plan, Laws — "Stored workflows do not change — and it is
 * pinned").
 *
 * The worker's chain adapter over a mocked request executor that
 * answers the goldens' response bodies. Each scenario pins what the
 * live cache and the live-variable publication are handed — the same
 * commits the node host's runner is pinned to, read from the one file.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExecutionPolicyResult } from '@openheaders/core/live';
import type { LiveWorkflow, Request, WorkflowStep } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const executeForLiveChainMock = vi.fn();
const putWorkflowRunCacheMock = vi.fn();
const recordRefreshErrorMock = vi.fn();
const publishLiveVariablesProducedByRunMock = vi.fn();

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
  putWorkflowRunCache: (...args: unknown[]) => putWorkflowRunCacheMock(...args),
  recordRefreshError: (...args: unknown[]) => recordRefreshErrorMock(...args),
}));

vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  publishLiveVariablesProducedByRun: (...args: unknown[]) => publishLiveVariablesProducedByRunMock(...args),
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

// ── The goldens ─────────────────────────────────────────────────────

type ScenarioName = 'passing' | 'failedAtFetch' | 'failedAtCapture' | 'gateSkipped';

interface GoldenCommit {
  put?: { extractedAt: number };
  error?: { message: string };
  published?: Record<string, Record<string, string>>;
}

interface Goldens {
  workspaceId: string;
  workflowUid: string;
  responses: { token: string; profile: string; introspect: string };
  scenarios: Record<ScenarioName, { commit: GoldenCommit }>;
}

const goldens: Goldens = JSON.parse(
  readFileSync(
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../../packages/core/tests/fixtures/workflow-runs/http-only.json',
    ),
    'utf8',
  ),
);

// ── Fixtures ────────────────────────────────────────────────────────

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

/** The mocked executor: each request answers its golden body, or the fetch failure a scenario names. */
function answerFromGoldens(failing: { requestUid: string; message: string } | null = null): void {
  executeForLiveChainMock.mockImplementation(async (request: Request) => {
    if (failing !== null && request.uid === failing.requestUid) return answer('', failing.message);
    if (request.uid === 'reqtoken') return answer(goldens.responses.token);
    if (request.uid === 'reqprofl') return answer(goldens.responses.profile);
    return answer(goldens.responses.introspect);
  });
}

function makeWorkflow(steps: WorkflowStep[], refresh: LiveWorkflow['refresh'] = { kind: 'manual' }): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: goldens.workflowUid,
    path: `live-workflows/token-chain-${goldens.workflowUid}`,
    name: 'Token chain',
    steps,
    refresh,
    enabled: true,
    published: true,
  };
}

function loginStep(tokenPath: string): WorkflowStep {
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

const profileStep: WorkflowStep = {
  uid: 'stpprofl',
  id: 'profile',
  requestUid: 'reqprofl',
  captures: [{ uid: 'capname0', name: 'name', extractor: { kind: 'json-path', path: '$.name' } }],
};

/** What the adapter handed the cache and the publication, in the goldens' shape. */
function commitOf(): GoldenCommit {
  const commit: GoldenCommit = {};
  expect(putWorkflowRunCacheMock.mock.calls.length + recordRefreshErrorMock.mock.calls.length).toBe(1);
  for (const [input, workspaceId] of putWorkflowRunCacheMock.mock.calls) {
    expect(workspaceId).toBe(goldens.workspaceId);
    commit.put = input;
  }
  for (const [input, workspaceId] of recordRefreshErrorMock.mock.calls) {
    expect(workspaceId).toBe(goldens.workspaceId);
    commit.error = input;
  }
  for (const [workspaceId, workflowUid, stepCaptures] of publishLiveVariablesProducedByRunMock.mock.calls) {
    expect(workspaceId).toBe(goldens.workspaceId);
    expect(workflowUid).toBe(goldens.workflowUid);
    commit.published = stepCaptures;
  }
  return commit;
}

function expectGolden(actual: unknown, golden: unknown): void {
  expect(actual).toEqual(golden);
  expect(JSON.stringify(actual)).toBe(JSON.stringify(golden));
}

let adapterModule: typeof import('@/background/modules/live-chain-adapter');

beforeEach(async () => {
  vi.resetModules();
  executeForLiveChainMock.mockReset();
  putWorkflowRunCacheMock.mockReset();
  recordRefreshErrorMock.mockReset();
  publishLiveVariablesProducedByRunMock.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(goldens.scenarios.passing.commit.put?.extractedAt ?? 0);
  adapterModule = await import('@/background/modules/live-chain-adapter');
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

function refresh(workflow: LiveWorkflow): Promise<void> {
  return adapterModule.liveChainAdapter.refreshWorkflow({
    workspaceId: goldens.workspaceId,
    workflow,
    environmentId: null,
  });
}

// ── The four runs ───────────────────────────────────────────────────

describe('an HTTP-only workflow in the extension', () => {
  it('passing — the captures committed at once and published', async () => {
    answerFromGoldens();

    await refresh(
      makeWorkflow([loginStep('$.access_token'), profileStep], {
        kind: 'expires-in',
        stepId: 'login',
        captureName: 'ttl',
        leadSeconds: 60,
      }),
    );

    expectGolden(commitOf(), goldens.scenarios.passing.commit);
    expect(executeForLiveChainMock.mock.calls.map(([request]) => request.uid)).toEqual(['reqtoken', 'reqprofl']);
  });

  it('failing at a fetch — nothing is committed or published', async () => {
    const message = goldens.scenarios.failedAtFetch.commit.error?.message ?? '';
    answerFromGoldens({ requestUid: 'reqprofl', message });

    await expect(refresh(makeWorkflow([loginStep('$.access_token'), profileStep]))).rejects.toBeInstanceOf(
      adapterModule.ChainRefreshError,
    );

    expectGolden(commitOf(), goldens.scenarios.failedAtFetch.commit);
  });

  it('failing at a capture — the step after it is never sent', async () => {
    answerFromGoldens();

    await expect(refresh(makeWorkflow([loginStep('$.session_token'), profileStep]))).rejects.toBeInstanceOf(
      adapterModule.ChainRefreshError,
    );

    expectGolden(commitOf(), goldens.scenarios.failedAtCapture.commit);
    expect(executeForLiveChainMock.mock.calls.map(([request]) => request.uid)).toEqual(['reqtoken']);
  });

  it('one step skipped by its gate — the skip rides the commit', async () => {
    answerFromGoldens();

    await refresh(
      makeWorkflow([
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
    );

    expectGolden(commitOf(), goldens.scenarios.gateSkipped.commit);
    expect(executeForLiveChainMock.mock.calls.map(([request]) => request.uid)).toEqual(['reqintro']);
  });
});
