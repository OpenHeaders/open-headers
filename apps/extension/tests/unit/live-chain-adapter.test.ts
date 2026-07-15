/**
 * live-chain-adapter — Phase D glue between the scheduler and the
 * request executor. Mocks request-executor, request-store, and the
 * live-cache-store so we exercise the adapter's contract in isolation:
 *
 *   1. On success, every step is fetched in order and captures are
 *      committed atomically to the cache.
 *   2. Step N sees captures from steps 0..N-1 via the `stepCaptures`
 *      argument to `executeForLiveChain`.
 *   3. Every step fetch carries the `workflowUid`/`stepId` so the
 *      executor stamps the bypass header.
 *   4. Fetch failures on step K abort the chain, record the error via
 *      `recordRefreshError` (not `putWorkflowRunCache`), and re-throw
 *      so the scheduler records a `refresh-failed` observability entry.
 *   5. Extract failures ditto, with `extractorOk: false` on the error
 *      record (cache's `lastExtractorOk` flag flips).
 *   6. Missing request uid → chain fails at that step with fetch phase.
 *   7. Module-load side effect registers the adapter via
 *      `__setLiveRefreshAdapter`.
 */

import type { ExecutionPolicyResult } from '@openheaders/core/live';
import type { Capture, LiveWorkflow, Request, WorkflowStep } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

const executeForLiveChainMock = vi.fn();
const getRequestMock = vi.fn();
const putWorkflowRunCacheMock = vi.fn();
const recordRefreshErrorMock = vi.fn();
const setLiveRefreshAdapterMock = vi.fn();
const getActiveWorkspaceIdMock = vi.fn<() => string>(() => 'ws-1');
const recordLogMock = vi.fn();
const publishLiveVariablesProducedByRunMock = vi.fn();

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/request-executor', () => ({
  executeForLiveChain: (...args: unknown[]) => executeForLiveChainMock(...args),
}));

vi.mock('@openheaders/oracle/entity/request-store', () => ({
  getRequest: (uid: string) => getRequestMock(uid),
  getRequestInWorkspace: (uid: string, _workspaceId: string) => getRequestMock(uid),
}));

vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  putWorkflowRunCache: (...args: unknown[]) => putWorkflowRunCacheMock(...args),
  recordRefreshError: (...args: unknown[]) => recordRefreshErrorMock(...args),
}));

vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  publishLiveVariablesProducedByRun: (...args: unknown[]) => publishLiveVariablesProducedByRunMock(...args),
}));

// The C7 health classifier reads the workflow's credential-step set from
// the execution-policy resolver; in this isolated adapter test the entity
// stores aren't materialized, so stub it to a no-credential workflow.
const deriveExecutionPolicyForWorkflowMock = vi.fn(
  (..._args: unknown[]): ExecutionPolicyResult => ({
    policy: 'idempotent',
    reasons: [],
    credentialStepIds: new Set<string>(),
  }),
);
vi.mock('@openheaders/oracle/live/execution-policy-resolver', () => ({
  deriveExecutionPolicyForWorkflow: (...args: unknown[]) => deriveExecutionPolicyForWorkflowMock(...args),
}));

vi.mock('@/background/modules/live-refresh-scheduler', () => ({
  __setLiveRefreshAdapter: (adapter: unknown) => setLiveRefreshAdapterMock(adapter),
}));

vi.mock('@/background/modules/workspace/workspace-store', () => ({
  getActiveWorkspaceId: () => getActiveWorkspaceIdMock(),
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: (entry: unknown) => recordLogMock(entry),
}));

// ── Fixtures ──────────────────────────────────────────────────────

type CaptureLike = Omit<Capture, 'uid'> & { uid?: string };
type StepLike = Omit<Partial<WorkflowStep>, 'captures'> & { captures?: CaptureLike[] };

function makeStep(overrides: StepLike = {}): WorkflowStep {
  const id = overrides.id ?? 'login';
  const captures: CaptureLike[] = overrides.captures ?? [
    { uid: 'captoken', name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } as const },
  ];
  return {
    ...overrides,
    uid: overrides.uid ?? `stp${id.padEnd(5, 'x').slice(0, 5)}`,
    id,
    requestUid: overrides.requestUid ?? 'reqlogin1',
    captures: captures.map((c, i) => ({
      ...c,
      uid: c.uid ?? `cap${String(i).padEnd(2, '0')}${c.name.slice(0, 3).padEnd(3, 'x')}`,
    })),
  };
}

function makeWorkflow(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wflowxxx',
    path: 'live-workflows/demo-wflowxxx',
    name: 'Demo',
    enabled: true,
    published: true,
    refresh: { kind: 'interval', seconds: 300 },
    steps: [makeStep()],
    ...overrides,
  };
}

function makeRequest(overrides: Partial<Request> = {}): Request {
  return {
    schemaVersion: 5,
    uid: overrides.uid ?? 'reqlogin1',
    path: `api-requests/login-${overrides.uid ?? 'reqlogin1'}`,
    name: overrides.name ?? 'Login',
    method: 'POST',
    url: 'https://openheaders.io/auth',
    headers: [],
    params: [],
    body: { type: 'none' },
    auth: { type: 'none' },
    ...overrides,
  };
}

function makeSnapshot(body: string, overrides: Record<string, unknown> = {}) {
  return {
    status: 200,
    statusText: 'OK',
    url: 'https://openheaders.io/auth',
    headers: [{ key: 'content-type', value: 'application/json' }],
    body,
    bodyTruncated: false,
    bodyBytes: new TextEncoder().encode(body).byteLength,
    durationMs: 10,
    error: null,
    scripts: null,
    ...overrides,
  };
}

// ── Dynamic import so module-load side effect captures the mock ────

let adapterModule: typeof import('@/background/modules/live-chain-adapter');

beforeEach(async () => {
  vi.resetModules();
  executeForLiveChainMock.mockReset();
  getRequestMock.mockReset();
  putWorkflowRunCacheMock.mockReset();
  recordRefreshErrorMock.mockReset();
  setLiveRefreshAdapterMock.mockReset();
  getActiveWorkspaceIdMock.mockReset();
  getActiveWorkspaceIdMock.mockReturnValue('ws-1');
  recordLogMock.mockReset();
  publishLiveVariablesProducedByRunMock.mockReset();
  adapterModule = await import('@/background/modules/live-chain-adapter');
});

afterEach(() => {
  vi.resetModules();
});

// ── 1. Module-load registration ──────────────────────────────────

describe('module-load side effect', () => {
  it('registers the adapter with the scheduler at import time', () => {
    // adapterModule import in beforeEach triggered the setter.
    expect(setLiveRefreshAdapterMock).toHaveBeenCalledTimes(1);
    expect(setLiveRefreshAdapterMock).toHaveBeenCalledWith(adapterModule.liveChainAdapter);
  });
});

// ── 2. Happy path — single-step chain ────────────────────────────

describe('single-step workflow', () => {
  it('runs the step, commits captures atomically on success', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot(JSON.stringify({ access_token: 'tok-abc' })));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow(),
      environmentId: 'env-prod',
    });

    expect(putWorkflowRunCacheMock).toHaveBeenCalledTimes(1);
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
    const [input, workspaceId] = putWorkflowRunCacheMock.mock.calls[0];
    expect(workspaceId).toBe('ws-1');
    expect(input.workflowUid).toBe('wflowxxx');
    expect(input.environmentId).toBe('env-prod');
    expect(input.stepCaptures).toEqual({ login: { token: 'tok-abc' } });
    expect(input.stepResponseBytes.login).toBeGreaterThan(0);
    // interval policy → expiresAt = extractedAt + seconds*1000
    expect(input.expiresAt).toBe(input.extractedAt + 300_000);
  });

  it('publishes the exposed live vars a successful run produced', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot(JSON.stringify({ access_token: 'tok-abc' })));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow(),
      environmentId: 'env-prod',
    });

    // The trigger produces the var: after the captures commit, draft
    // bindings whose capture yielded a value are published. The store
    // helper owns the "which LVs / idempotency" decision; the adapter
    // just hands it (workspace, workflow, captures).
    expect(publishLiveVariablesProducedByRunMock).toHaveBeenCalledTimes(1);
    expect(publishLiveVariablesProducedByRunMock).toHaveBeenCalledWith('ws-1', 'wflowxxx', {
      login: { token: 'tok-abc' },
    });
  });

  it('carries the binary-body contract into the runner: whole-body captures base64, wire bytes recorded', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('iVBORw0KGgo=', { bodyEncoding: 'base64', bodyBytes: 8 }));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow({
        steps: [makeStep({ captures: [{ name: 'blob', extractor: { kind: 'whole-body' } }] })],
      }),
      environmentId: null,
    });

    expect(putWorkflowRunCacheMock).toHaveBeenCalledTimes(1);
    const [input] = putWorkflowRunCacheMock.mock.calls[0];
    expect(input.stepCaptures).toEqual({ login: { blob: 'iVBORw0KGgo=' } });
    // Wire-exact count from the executor, not the base64 carrier's length.
    expect(input.stepResponseBytes.login).toBe(8);
  });

  it('a json-path capture over a binary body fails the run with the binary cause', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('iVBORw0KGgo=', { bodyEncoding: 'base64', bodyBytes: 8 }));

    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-1',
        workflow: makeWorkflow(),
        environmentId: null,
      }),
    ).rejects.toThrow(/binary/);
    expect(putWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(recordRefreshErrorMock).toHaveBeenCalledTimes(1);
    const [errorInput] = recordRefreshErrorMock.mock.calls[0];
    expect(errorInput.extractorOk).toBe(false);
  });

  it('stamps workflowUid+stepId on the executor call (bypass header source)', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('"ok"'));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow({
        steps: [makeStep({ captures: [{ name: 'v', extractor: { kind: 'whole-body' } }] })],
      }),
      environmentId: null,
    });

    expect(executeForLiveChainMock).toHaveBeenCalledTimes(1);
    const [, opts] = executeForLiveChainMock.mock.calls[0];
    expect(opts.workflowUid).toBe('wflowxxx');
    expect(opts.stepId).toBe('login');
    expect(opts.environmentId).toBeNull();
  });
});

// ── 3. Multi-step — step N sees step 0..N-1 captures ─────────────

describe('multi-step chain', () => {
  const workflow = makeWorkflow({
    steps: [
      makeStep({
        id: 'auth',
        requestUid: 'reqauth01',
        captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.token' } }],
      }),
      makeStep({
        id: 'csrf',
        requestUid: 'reqcsrf01',
        captures: [{ name: 'xsrf', extractor: { kind: 'header', name: 'X-CSRF' } }],
      }),
      makeStep({
        id: 'final',
        requestUid: 'reqfinal1',
        captures: [{ name: 'session', extractor: { kind: 'json-path', path: '$.sid' } }],
      }),
    ],
  });

  it('feeds each step the captures from prior steps', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    // Snapshot the stepCaptures reference at each call — runChain
    // reuses the same Map instance across steps (it's the live
    // accumulator), so inspecting it after the refresh completes shows
    // only the final state. Deep-clone at call time to capture history.
    const snapshots: Array<Map<string, Map<string, string>>> = [];
    const snapshotMap = (m: ReadonlyMap<string, ReadonlyMap<string, string>>) => {
      const clone = new Map<string, Map<string, string>>();
      for (const [k, inner] of m) clone.set(k, new Map(inner));
      return clone;
    };
    executeForLiveChainMock.mockImplementation(async (_req, opts) => {
      snapshots.push(snapshotMap(opts.stepCaptures));
      const index = snapshots.length - 1;
      if (index === 0) return makeSnapshot(JSON.stringify({ token: 'tok-1' }));
      if (index === 1) {
        return makeSnapshot('{}', { headers: [{ key: 'X-CSRF', value: 'csrf-2' }] });
      }
      return makeSnapshot(JSON.stringify({ sid: 'sid-3' }));
    });

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow,
      environmentId: null,
    });

    expect(snapshots).toHaveLength(3);
    // Step 1 sees an empty capture map.
    expect(snapshots[0].size).toBe(0);
    // Step 2 sees step 1's captures.
    expect(snapshots[1].get('auth')?.get('token')).toBe('tok-1');
    // Step 3 sees step 1 + 2.
    expect(snapshots[2].get('auth')?.get('token')).toBe('tok-1');
    expect(snapshots[2].get('csrf')?.get('xsrf')).toBe('csrf-2');
  });

  it('commits all captures under the right stepId keys', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    executeForLiveChainMock
      .mockResolvedValueOnce(makeSnapshot(JSON.stringify({ token: 'T' })))
      .mockResolvedValueOnce(makeSnapshot('{}', { headers: [{ key: 'X-CSRF', value: 'C' }] }))
      .mockResolvedValueOnce(makeSnapshot(JSON.stringify({ sid: 'S' })));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow,
      environmentId: null,
    });

    const [input] = putWorkflowRunCacheMock.mock.calls[0];
    expect(input.stepCaptures).toEqual({
      auth: { token: 'T' },
      csrf: { xsrf: 'C' },
      final: { session: 'S' },
    });
  });
});

// ── 4. Fetch failure → recordRefreshError, not put ───────────────

describe('fetch-phase failures', () => {
  it('preserves last-good cache, records error, re-throws ChainRefreshError', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    executeForLiveChainMock
      .mockResolvedValueOnce(makeSnapshot(JSON.stringify({ token: 'T' })))
      // Step 2 encounters a network error — the executor surfaces
      // it as `error: 'DNS failure'`, the adapter throws to runChain.
      .mockResolvedValueOnce(makeSnapshot('', { error: 'DNS failure', status: 0 }));

    const workflow = makeWorkflow({
      steps: [
        makeStep({ id: 'one', requestUid: 'r1', captures: [{ name: 'v', extractor: { kind: 'whole-body' } }] }),
        makeStep({ id: 'two', requestUid: 'r2', captures: [{ name: 'v', extractor: { kind: 'whole-body' } }] }),
      ],
    });

    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-1',
        workflow,
        environmentId: null,
      }),
    ).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(putWorkflowRunCacheMock).not.toHaveBeenCalled();
    // A failed run produces no value, so it must not publish any binding.
    expect(publishLiveVariablesProducedByRunMock).not.toHaveBeenCalled();
    expect(recordRefreshErrorMock).toHaveBeenCalledTimes(1);
    const [errInput, errWs] = recordRefreshErrorMock.mock.calls[0];
    expect(errWs).toBe('ws-1');
    expect(errInput.failedStepId).toBe('two');
    // Fetch-phase failures preserve `extractorOk` as true (extractor
    // never ran, so nothing is provably wrong with it).
    expect(errInput.extractorOk).toBe(true);
    expect(errInput.message).toContain('DNS failure');
    // C7: a fetch-phase failure carries no status; a non-credential step
    // failing to fetch is the source being unreachable.
    expect(errInput.refreshHealth).toBe('source-failing');
  });

  it('missing request uid aborts the chain as fetch failure', async () => {
    getRequestMock.mockReturnValue(null);
    const workflow = makeWorkflow({
      steps: [makeStep({ requestUid: 'gone-uid' })],
    });

    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-1',
        workflow,
        environmentId: null,
      }),
    ).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(executeForLiveChainMock).not.toHaveBeenCalled();
    expect(recordRefreshErrorMock).toHaveBeenCalledTimes(1);
    expect(recordRefreshErrorMock.mock.calls[0][0].message).toContain('gone-uid');
  });
});

// ── 5. Extract failure flips extractorOk flag ────────────────────

describe('extract-phase failures', () => {
  it('records error with extractorOk=false and preserves cache', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    // Fetch succeeds (non-JSON body) — json-path extractor will reject.
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('<html>oops</html>'));

    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-1',
        workflow: makeWorkflow(),
        environmentId: null,
      }),
    ).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(putWorkflowRunCacheMock).not.toHaveBeenCalled();
    expect(recordRefreshErrorMock).toHaveBeenCalledTimes(1);
    const [errInput] = recordRefreshErrorMock.mock.calls[0];
    expect(errInput.failedStepId).toBe('login');
    expect(errInput.extractorOk).toBe(false);
    // C7: a 200-but-unextractable body on a non-credential step is the
    // data source misbehaving, not auth.
    expect(errInput.refreshHealth).toBe('source-failing');
  });

  it('classifies a credential-step failure as auth-failing (C7)', async () => {
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('<html>oops</html>'));
    // The failing step ('login') is the workflow's credential step.
    deriveExecutionPolicyForWorkflowMock.mockReturnValueOnce({
      policy: 'exclusive',
      reasons: [{ kind: 'totp', vaultName: 'seed' }],
      credentialStepIds: new Set(['login']),
    });

    await expect(
      adapterModule.liveChainAdapter.refreshWorkflow({
        workspaceId: 'ws-1',
        workflow: makeWorkflow(),
        environmentId: null,
      }),
    ).rejects.toBeInstanceOf(adapterModule.ChainRefreshError);

    expect(recordRefreshErrorMock.mock.calls[0][0].refreshHealth).toBe('auth-failing');
  });
});

// ── 7. Cross-workspace dispatch (MWPT-FULL session #19) ──────────
//
// The previous Active-workspace guard refused to run the chain when
// `workspaceId !== getActiveWorkspaceId()`. Session 19 lifts that
// limit: chain dispatches thread `workspaceId` end-to-end so a per-tab
// MWPT workspace's workflow refreshes correctly even when a different
// workspace is runtime-Active. This test asserts the new behavior.

describe('cross-workspace dispatch', () => {
  it('runs the chain against the dispatch workspace, threading workspaceId into executeForLiveChain', async () => {
    getActiveWorkspaceIdMock.mockReturnValue('ws-other');
    getRequestMock.mockReturnValue(makeRequest());
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('{"access_token":"abc"}'));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow(),
      environmentId: null,
    });

    expect(executeForLiveChainMock).toHaveBeenCalledTimes(1);
    const [, options] = executeForLiveChainMock.mock.calls[0];
    expect(options.workspaceId).toBe('ws-1');
    // Capture write lands against the dispatch workspace, not the
    // runtime-Active one — the cache row belongs to ws-1.
    expect(putWorkflowRunCacheMock).toHaveBeenCalledTimes(1);
    expect(putWorkflowRunCacheMock.mock.calls[0][1]).toBe('ws-1');
    expect(recordRefreshErrorMock).not.toHaveBeenCalled();
  });
});

// ── 6. Expiry derivation per refresh policy ──────────────────────

describe('expiresAt derivation', () => {
  beforeEach(() => {
    getRequestMock.mockReturnValue(makeRequest());
  });

  it('interval → extractedAt + seconds*1000', async () => {
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('"ok"'));
    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow({
        refresh: { kind: 'interval', seconds: 120 },
        steps: [makeStep({ captures: [{ name: 'v', extractor: { kind: 'whole-body' } }] })],
      }),
      environmentId: null,
    });
    const [input] = putWorkflowRunCacheMock.mock.calls[0];
    expect(input.expiresAt).toBe(input.extractedAt + 120_000);
  });

  it('manual → null', async () => {
    executeForLiveChainMock.mockResolvedValue(makeSnapshot('"ok"'));
    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow({
        refresh: { kind: 'manual' },
        steps: [makeStep({ captures: [{ name: 'v', extractor: { kind: 'whole-body' } }] })],
      }),
      environmentId: null,
    });
    const [input] = putWorkflowRunCacheMock.mock.calls[0];
    expect(input.expiresAt).toBeNull();
  });

  it('expires-in reads seconds from a capture', async () => {
    executeForLiveChainMock.mockResolvedValue(makeSnapshot(JSON.stringify({ expires_in: 600 })));
    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow({
        refresh: { kind: 'expires-in', stepId: 'login', captureName: 'ttl', leadSeconds: 60 },
        steps: [
          makeStep({
            captures: [{ name: 'ttl', extractor: { kind: 'json-path', path: '$.expires_in' } }],
          }),
        ],
      }),
      environmentId: null,
    });
    const [input] = putWorkflowRunCacheMock.mock.calls[0];
    // expiresAt is the absolute expiry (not leadSeconds-adjusted); the
    // scheduler applies leadSeconds when computing the next fire.
    expect(input.expiresAt).toBe(input.extractedAt + 600_000);
  });

  it('expires-in with non-numeric capture falls back to null', async () => {
    executeForLiveChainMock.mockResolvedValue(makeSnapshot(JSON.stringify({ expires_in: 'never' })));
    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow({
        refresh: { kind: 'expires-in', stepId: 'login', captureName: 'ttl', leadSeconds: 60 },
        steps: [
          makeStep({
            captures: [{ name: 'ttl', extractor: { kind: 'json-path', path: '$.expires_in' } }],
          }),
        ],
      }),
      environmentId: null,
    });
    const [input] = putWorkflowRunCacheMock.mock.calls[0];
    expect(input.expiresAt).toBeNull();
  });
});

// ── 8. Phase I skipped-step observability ────────────────────────

describe('skipped-step observability (Phase I)', () => {
  function findSkipEntries() {
    return recordLogMock.mock.calls
      .map(([entry]) => entry as { op: string; message: string; context: Record<string, unknown> })
      .filter((entry) => entry.op === 'step-skipped');
  }

  it('emits no step-skipped entries when every step runs', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    executeForLiveChainMock.mockResolvedValue(makeSnapshot(JSON.stringify({ access_token: 'T' })));

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow: makeWorkflow(),
      environmentId: null,
    });

    expect(findSkipEntries()).toHaveLength(0);
  });

  it('emits a `gate` reason when a runIf clause cites a completed ancestor', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    // Ancestor returns `active: true` → refresh's gate wants
    // `active == 'false'` → gate fails with reason `gate` (not cascade:
    // the ancestor completed, its capture just didn't match).
    executeForLiveChainMock.mockResolvedValueOnce(makeSnapshot(JSON.stringify({ active: true })));

    const workflow = makeWorkflow({
      steps: [
        makeStep({
          id: 'introspect',
          requestUid: 'reqintro01',
          captures: [{ name: 'active', extractor: { kind: 'json-path', path: '$.active' } }],
        }),
        makeStep({
          id: 'refresh',
          requestUid: 'reqrefrsh',
          dependsOn: ['introspect'],
          runIf: {
            all: [
              {
                uid: 'gat0eq01',
                kind: 'capture-equals',
                stepId: 'introspect',
                captureName: 'active',
                value: 'false',
              },
            ],
          },
          captures: [{ name: 'token', extractor: { kind: 'json-path', path: '$.access_token' } }],
        }),
      ],
    });

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow,
      environmentId: 'env-prod',
    });

    const skipEntries = findSkipEntries();
    expect(skipEntries).toHaveLength(1);
    expect(skipEntries[0].message).toContain('refresh');
    expect(skipEntries[0].message).toContain('gate');
    expect(skipEntries[0].message).not.toContain('cascade');
    expect(skipEntries[0].context.workflowUid).toBe('wflowxxx');
    expect(skipEntries[0].context.environmentId).toBe('env-prod');

    // The runner's skip attestation rides into the cache write, where
    // the store's skip-merge + stepOutcomes stamping depend on it.
    expect(putWorkflowRunCacheMock).toHaveBeenCalledTimes(1);
    const [cacheInput] = putWorkflowRunCacheMock.mock.calls[0];
    expect(cacheInput.skippedStepIds).toEqual(['refresh']);
    expect(cacheInput.stepCaptures).toEqual({ introspect: { active: 'true' } });
  });

  it('classifies cascade skips by referencing a skipped ancestor', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    // Probe returns a value that makes `mid` skip. `final` depends on
    // `mid` AND has a runIf clause that cites `mid.X` — mid was skipped
    // so the clause returns false-by-absence → final also skips,
    // classified as `cascade` with upstream='mid'.
    executeForLiveChainMock.mockResolvedValueOnce(makeSnapshot(JSON.stringify({ flag: 'no' })));

    const workflow = makeWorkflow({
      steps: [
        makeStep({
          id: 'probe',
          requestUid: 'reqprobe0',
          captures: [{ name: 'flag', extractor: { kind: 'json-path', path: '$.flag' } }],
        }),
        makeStep({
          id: 'mid',
          requestUid: 'reqmid000',
          dependsOn: ['probe'],
          runIf: {
            all: [{ uid: 'gat0eq02', kind: 'capture-equals', stepId: 'probe', captureName: 'flag', value: 'yes' }],
          },
          captures: [{ name: 'midval', extractor: { kind: 'whole-body' } }],
        }),
        makeStep({
          id: 'final',
          requestUid: 'reqfinal0',
          dependsOn: ['mid'],
          runIf: {
            all: [{ uid: 'gat0ex01', kind: 'capture-exists', stepId: 'mid', captureName: 'midval' }],
          },
          captures: [{ name: 'out', extractor: { kind: 'whole-body' } }],
        }),
      ],
    });

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow,
      environmentId: null,
    });

    const skipEntries = findSkipEntries();
    expect(skipEntries).toHaveLength(2);
    const midEntry = skipEntries.find((e) => e.message.includes('"mid"'));
    const finalEntry = skipEntries.find((e) => e.message.includes('"final"'));
    expect(midEntry).toBeTruthy();
    // `mid`'s gate references `probe` (which completed) — reason=gate.
    expect(midEntry!.message).toContain('gate');
    expect(midEntry!.message).not.toContain('cascade');
    // `final`'s gate references `mid` (which was skipped) → cascade.
    expect(finalEntry).toBeTruthy();
    expect(finalEntry!.message).toContain('cascade');
    expect(finalEntry!.message).toContain('"mid"');
  });

  it('does not leak captured values into the log message', async () => {
    getRequestMock.mockImplementation((uid: string) => makeRequest({ uid }));
    executeForLiveChainMock.mockResolvedValueOnce(
      makeSnapshot(JSON.stringify({ secret: 'sk-live-abc123', active: true })),
    );

    const workflow = makeWorkflow({
      steps: [
        makeStep({
          id: 'introspect',
          requestUid: 'reqintro01',
          captures: [
            { name: 'active', extractor: { kind: 'json-path', path: '$.active' } },
            { name: 'secret', extractor: { kind: 'json-path', path: '$.secret' } },
          ],
        }),
        makeStep({
          id: 'refresh',
          requestUid: 'reqrefrsh',
          dependsOn: ['introspect'],
          runIf: {
            all: [
              {
                uid: 'gat0eq03',
                kind: 'capture-equals',
                stepId: 'introspect',
                captureName: 'active',
                value: 'false',
              },
            ],
          },
          captures: [{ name: 'token', extractor: { kind: 'whole-body' } }],
        }),
      ],
    });

    await adapterModule.liveChainAdapter.refreshWorkflow({
      workspaceId: 'ws-1',
      workflow,
      environmentId: null,
    });

    const skipEntries = findSkipEntries();
    expect(skipEntries).toHaveLength(1);
    // Captured values must never appear in the exportable log — the
    // message only names step ids + reason.
    expect(skipEntries[0].message).not.toContain('sk-live-abc123');
    expect(skipEntries[0].message).not.toContain('true');
    expect(skipEntries[0].message).not.toMatch(/secret/i);
  });
});
