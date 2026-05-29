/**
 * Desktop live chain runner (WS-C C1/C4 glue).
 *
 * `runChain` + `buildChainFetchAdapter` + the Node transport are mocked
 * — those are exhaustively covered at the core/oracle level. These tests
 * pin the desktop-specific glue: that a success commits the mapped
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
}));

vi.mock('@openheaders/core/live', () => ({ runChain: h.runChain }));
vi.mock('@openheaders/oracle/live/request-exec/chain-adapter', () => ({
  buildChainFetchAdapter: vi.fn(() => ({ executeStep: vi.fn() })),
}));
vi.mock('@openheaders/oracle-host-node/live/node-request-transport', () => ({
  createNodeRequestTransport: vi.fn(() => ({ send: vi.fn() })),
}));
vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  putWorkflowRunCache: h.putWorkflowRunCache,
  recordRefreshError: h.recordRefreshError,
}));
vi.mock('@openheaders/core/utils', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() },
}));

import { runDesktopWorkflowRefresh } from '../../../../src/main/live/chain-runner';

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

describe('runDesktopWorkflowRefresh — success commit', () => {
  it('maps captures + derives interval expiry, then writes the cache', async () => {
    h.runChain.mockResolvedValue(successOutcome());
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    const result = await runDesktopWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

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
    });
  });

  it('derives expires-in expiry from the named capture', async () => {
    h.runChain.mockResolvedValue(successOutcome({ stepCaptures: new Map([['s1', new Map([['ttl', '90']])]]) }));
    const workflow = makeWorkflow({
      refresh: { kind: 'expires-in', stepId: 's1', captureName: 'ttl', leadSeconds: 0 },
    });

    await runDesktopWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: 'env-1' });

    expect(h.putWorkflowRunCache.mock.calls[0][0].expiresAt).toBe(1_000 + 90 * 1000);
  });

  it('writes a null expiry for a manual policy', async () => {
    h.runChain.mockResolvedValue(successOutcome());
    const workflow = makeWorkflow({ refresh: { kind: 'manual' } });

    await runDesktopWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(h.putWorkflowRunCache.mock.calls[0][0].expiresAt).toBeNull();
  });
});

describe('runDesktopWorkflowRefresh — failure commit', () => {
  it('records an extractor failure (extractorOk=false) and never writes captures', async () => {
    h.runChain.mockResolvedValue({
      ok: false,
      failedPhase: 'extract',
      failedReason: 'bad json path',
      failedStepId: 's1',
    });
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    const result = await runDesktopWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

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
    });
  });

  it('marks a fetch failure extractor-ok (structural, not a user extractor fault)', async () => {
    h.runChain.mockResolvedValue({ ok: false, failedPhase: 'fetch', failedReason: 'ECONNREFUSED', failedStepId: 's2' });
    const workflow = makeWorkflow({ refresh: { kind: 'interval', seconds: 60 } });

    await runDesktopWorkflowRefresh({ workspaceId: 'ws-1', workflow, environmentId: null });

    expect(h.recordRefreshError.mock.calls[0][0].extractorOk).toBe(true);
  });
});
