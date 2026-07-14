/**
 * Node-host live chain runner (WS-C C1/C4 glue).
 *
 * `runChain` + `buildChainFetchAdapter` + the Node transport are mocked
 * — those are exhaustively covered at the core/oracle level. These tests
 * pin the host-specific glue: that a success commits the mapped
 * captures with the policy-derived `expiresAt`, and that a failure routes
 * to `recordRefreshError` with the right `extractorOk` and never writes a
 * partial cache row.
 */

import type { LiveWorkflow } from '@openheaders/core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  runChain: vi.fn(),
  putWorkflowRunCache: vi.fn(),
  recordRefreshError: vi.fn(),
  deriveExecutionPolicyForWorkflow: vi.fn(() => ({
    policy: 'idempotent' as const,
    reasons: [],
    credentialStepIds: new Set<string>(),
  })),
}));

// `deriveExpiresAt` is pure and lifted into core/live; keep the real one
// so the policy-derived expiry assertions stay meaningful. Only `runChain`
// (the network/DAG executor) is mocked.
vi.mock('@openheaders/core/live', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openheaders/core/live')>()),
  runChain: h.runChain,
}));
vi.mock('@openheaders/oracle/live/request-exec/chain-adapter', () => ({
  buildChainFetchAdapter: vi.fn(() => ({ executeStep: vi.fn() })),
}));
vi.mock('../../../src/live/node-request-transport', () => ({
  createNodeRequestTransport: vi.fn(() => ({ send: vi.fn() })),
}));
vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  putWorkflowRunCache: h.putWorkflowRunCache,
  recordRefreshError: h.recordRefreshError,
}));
vi.mock('@openheaders/oracle/live/execution-policy-resolver', () => ({
  deriveExecutionPolicyForWorkflow: h.deriveExecutionPolicyForWorkflow,
}));
vi.mock('@openheaders/core/utils', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { buildChainFetchAdapter } from '@openheaders/oracle/live/request-exec/chain-adapter';
import { runWorkflowRefresh } from '../../../src/daemon/live/chain-runner';
import { setHostScriptCapabilities } from '../../../src/daemon/script-capability';

function makeWorkflow(overrides: Partial<LiveWorkflow> = {}): LiveWorkflow {
  return {
    schemaVersion: 5,
    uid: 'wf-1',
    path: 'live/wf-1',
    name: 'Test Workflow',
    steps: [],
    refresh: { kind: 'manual' },
    enabled: true,
    published: true,
    ...overrides,
  };
}

function successOutcome(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    stepCaptures: new Map([['s1', new Map([['token', 'abc']])]]),
    stepResponseBytes: new Map([['s1', 12]]),
    stepAttempts: new Map([['s1', 1]]),
    completedAt: 1_000,
    skippedStepIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.putWorkflowRunCache.mockResolvedValue(undefined);
  h.recordRefreshError.mockResolvedValue(undefined);
});

describe('runWorkflowRefresh — success commit', () => {
  it('maps captures + derives interval expiry, then writes the cache', async () => {
    h.runChain.mockResolvedValue(successOutcome());
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    const result = await runWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(result).toEqual({ ok: true, skippedStepIds: [] });
    expect(h.recordRefreshError).not.toHaveBeenCalled();
    expect(h.putWorkflowRunCache).toHaveBeenCalledTimes(1);
    const [input, workspaceId] = h.putWorkflowRunCache.mock.calls[0];
    expect(workspaceId).toBe('ws-1');
    expect(input).toMatchObject({
      workflowUid: 'wf-1',
      environmentId: null,
      stepCaptures: { s1: { token: 'abc' } },
      stepResponseBytes: { s1: 12 },
      extractedAt: 1_000,
      expiresAt: 1_000 + 60 * 1000,
      skippedStepIds: [],
    });
  });

  it('derives expires-in expiry from the named capture', async () => {
    h.runChain.mockResolvedValue(successOutcome({ stepCaptures: new Map([['s1', new Map([['ttl', '90']])]]) }));
    const workflow = makeWorkflow({
      refresh: { kind: 'expires-in', stepId: 's1', captureName: 'ttl', leadSeconds: 0 },
    });

    await runWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: 'env-1' });

    expect(h.putWorkflowRunCache.mock.calls[0][0].expiresAt).toBe(1_000 + 90 * 1000);
  });

  it('writes a null expiry for a manual policy', async () => {
    h.runChain.mockResolvedValue(successOutcome());
    const workflow = makeWorkflow({ refresh: { kind: 'manual' } });

    await runWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(h.putWorkflowRunCache.mock.calls[0][0].expiresAt).toBeNull();
  });
});

describe('runWorkflowRefresh — script capability injection', () => {
  it('builds the adapter without a script runner on a host with no capability', async () => {
    h.runChain.mockResolvedValue(successOutcome());
    await runWorkflowRefresh({ workspaceId: 'ws-1', workflow: makeWorkflow(), environmentId: null });
    const options = vi.mocked(buildChainFetchAdapter).mock.calls[0][0];
    expect(options.scriptRunner).toBeUndefined();
  });

  it('injects the OAuth refresh-on-expired hook into the adapter', async () => {
    h.runChain.mockResolvedValue(successOutcome());
    await runWorkflowRefresh({ workspaceId: 'ws-1', workflow: makeWorkflow(), environmentId: null });
    const options = vi.mocked(buildChainFetchAdapter).mock.calls[0][0];
    expect(typeof options.refreshOAuth).toBe('function');
  });

  it('hands the adapter a chain-context runner when the host registered a capability', async () => {
    const runScript = vi.fn(async () => ({
      executionId: 'e1',
      succeeded: true,
      assertions: [],
      consoleLog: [],
      durationMs: 1,
    }));
    setHostScriptCapabilities({ safe: { mode: 'safe', runScript } });
    try {
      h.runChain.mockResolvedValue(successOutcome());
      await runWorkflowRefresh({ workspaceId: 'ws-1', workflow: makeWorkflow(), environmentId: null });
      const options = vi.mocked(buildChainFetchAdapter).mock.calls[0][0];
      expect(options.scriptRunner).toBeDefined();
      await options.scriptRunner?.({
        kind: 'pre-request',
        source: 'oh.setHeader("X", "1");',
        request: {
          method: 'GET',
          url: 'https://api.openheaders.io/x',
          headers: [],
          params: [],
          body: { type: 'none' },
        },
      });
      expect(runScript).toHaveBeenCalledWith(expect.objectContaining({ hostContext: 'chain' }));
    } finally {
      setHostScriptCapabilities(null);
    }
  });
});

describe('runWorkflowRefresh — failure commit', () => {
  it('records an extractor failure (extractorOk=false) and never writes captures', async () => {
    h.runChain.mockResolvedValue({
      ok: false,
      failedPhase: 'extract',
      failedReason: 'bad json path',
      failedStepId: 's1',
      partialStepStatuses: new Map([['s1', 200]]),
    });
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    const result = await runWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(result).toEqual({ ok: false, failedStepId: 's1', failedPhase: 'extract', message: 'bad json path' });
    expect(h.putWorkflowRunCache).not.toHaveBeenCalled();
    expect(h.recordRefreshError).toHaveBeenCalledTimes(1);
    const [input, workspaceId] = h.recordRefreshError.mock.calls[0];
    expect(workspaceId).toBe('ws-1');
    expect(input).toMatchObject({
      workflowUid: 'wf-1',
      failedStepId: 's1',
      message: 'bad json path',
      extractorOk: false,
      // C7: 200-status extract failure on a non-credential step → source.
      refreshHealth: 'source-failing',
    });
  });

  it('marks a fetch failure extractor-ok (structural, not a user extractor fault)', async () => {
    h.runChain.mockResolvedValue({
      ok: false,
      failedPhase: 'fetch',
      failedReason: 'ECONNREFUSED',
      failedStepId: 's2',
      partialStepStatuses: new Map(),
    });
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    await runWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(h.recordRefreshError.mock.calls[0][0].extractorOk).toBe(true);
    expect(h.recordRefreshError.mock.calls[0][0].refreshHealth).toBe('source-failing');
  });

  it('classifies a 401 on the failed step as auth-failing (C7)', async () => {
    h.runChain.mockResolvedValue({
      ok: false,
      failedPhase: 'extract',
      failedReason: 'unauthorized',
      failedStepId: 's1',
      partialStepStatuses: new Map([['s1', 401]]),
    });
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    await runWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(h.recordRefreshError.mock.calls[0][0].refreshHealth).toBe('auth-failing');
  });
});
