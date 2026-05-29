/**
 * Phase G — `live` Status subsystem. The scheduler's
 * `recomputeLiveStatus` aggregates every workspace's cached runs into
 * one pill state per the plan:
 *
 *   green  = all workflows fresh (or no workflows configured)
 *   yellow = 1..4 consecutive failures, stale beyond 2× cadence, or
 *            `lastExtractorOk === false`
 *   red    = any `consecutiveFailures >= 5`
 *
 * Values never leak into Status messages — only counts + a
 * `firstRed`/`firstYellow` workflow uid for triage.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────

const listWorkflowRunCachesMock = vi.fn();

vi.mock('@utils/browser-api', () => ({
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn(() => Promise.resolve([])),
    onAlarm: { addListener: vi.fn(), removeListener: vi.fn() },
  },
}));

vi.mock('@utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/modules/observability-log', () => ({
  recordLog: vi.fn(),
}));

vi.mock('@openheaders/oracle/live/live-workflow-store', () => ({
  getLiveWorkflows: () => [],
  onLiveWorkflowStoreChange: () => () => {},
}));

vi.mock('@openheaders/oracle/live/live-variable-store', () => ({
  getLiveVariablesForWorkflow: () => [],
  onLiveVariableStoreChange: () => () => {},
}));

vi.mock('@openheaders/oracle/live/live-cache-store', () => ({
  listCachesForWorkflow: () => Promise.resolve([]),
  listWorkflowRunCaches: () => listWorkflowRunCachesMock(),
  onLiveCacheStoreChange: () => () => {},
  recordRefreshError: vi.fn(() => Promise.resolve()),
}));

import { __resetStatusForTests, getStatusSnapshot } from '@openheaders/ui/shared/status';
import * as scheduler from '@/background/modules/live-refresh-scheduler';
import { installBackingStorage } from '../helpers/chrome-storage-backing';

// ── Harness ────────────────────────────────────────────────────────
//
// Unlike the scheduler's unit test (which uses `vi.resetModules()` so
// each test gets a fresh scheduler), this file shares the module
// singleton across tests — the status store is a sibling singleton and
// its state must be observable across `reportStatus` → `getStatusSnapshot`.
// `__resetStatusForTests` clears state between runs; `stopLiveScheduler`
// unsubscribes the store listeners that `startLiveScheduler` installed.

beforeEach(() => {
  installBackingStorage();
  __resetStatusForTests();
  listWorkflowRunCachesMock.mockReset();
  listWorkflowRunCachesMock.mockResolvedValue([]);
});

afterEach(() => {
  scheduler.stopLiveScheduler();
  __resetStatusForTests();
});

function makeRun(overrides: {
  workflowUid?: string;
  consecutiveFailures?: number;
  lastExtractorOk?: boolean;
  extractedAt?: number;
  expiresAt?: number | null;
  exclusiveDegradedSince?: number;
}) {
  return {
    workflowUid: overrides.workflowUid ?? 'wflow001',
    environmentId: null,
    stepCaptures: { login: { token: 't' } },
    extractedAt: overrides.extractedAt ?? Date.now(),
    expiresAt: overrides.expiresAt ?? null,
    stepResponseBytes: { login: 10 },
    consecutiveFailures: overrides.consecutiveFailures ?? 0,
    lastExtractorOk: overrides.lastExtractorOk ?? true,
    exclusiveDegradedSince: overrides.exclusiveDegradedSince,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('live Status pill', () => {
  it('green + "No workflows configured" when the cache is empty', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([]);
    scheduler.startLiveScheduler();
    // Prime path runs async — settle.
    await new Promise((r) => setTimeout(r, 10));
    const snap = getStatusSnapshot();
    expect(snap.live?.state).toBe('green');
    expect(snap.live?.message).toContain('No workflows');
  });

  it('green + count when every run is fresh', async () => {
    const now = Date.now();
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ workflowUid: 'a', extractedAt: now, expiresAt: now + 300_000 }),
      makeRun({ workflowUid: 'b', extractedAt: now, expiresAt: now + 300_000 }),
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    const snap = getStatusSnapshot();
    expect(snap.live?.state).toBe('green');
    expect(snap.live?.message).toContain('2 workflows fresh');
  });

  it('yellow on 1..4 consecutive failures', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ consecutiveFailures: 2, workflowUid: 'fail-wf' })]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    const snap = getStatusSnapshot();
    expect(snap.live?.state).toBe('yellow');
    expect(snap.live?.message).toContain('stale or failing');
    expect(snap.live?.context?.firstYellow).toBe('fail-wf');
  });

  it('yellow on lastExtractorOk === false', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ lastExtractorOk: false, workflowUid: 'extract-wf' })]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    expect(getStatusSnapshot().live?.state).toBe('yellow');
  });

  it('yellow when stale beyond 2× cadence', async () => {
    const now = Date.now();
    // Window = expiresAt - extractedAt = 60s. Now - extractedAt > 2*60s = yellow.
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({
        workflowUid: 'stale-wf',
        extractedAt: now - 200_000,
        expiresAt: now - 200_000 + 60_000,
      }),
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    expect(getStatusSnapshot().live?.state).toBe('yellow');
  });

  it('red on consecutiveFailures >= 5', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([makeRun({ consecutiveFailures: 5, workflowUid: 'red-wf' })]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    const snap = getStatusSnapshot();
    expect(snap.live?.state).toBe('red');
    expect(snap.live?.message).toContain('failing');
    expect(snap.live?.context?.firstRed).toBe('red-wf');
  });

  it('red dominates yellow when both exist', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ consecutiveFailures: 3, workflowUid: 'yellow-wf' }),
      makeRun({ consecutiveFailures: 6, workflowUid: 'red-wf' }),
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    expect(getStatusSnapshot().live?.state).toBe('red');
  });

  it('yellow + "reconnect the desktop" when an exclusive cred is degraded (C9)', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ workflowUid: 'totp-wf', exclusiveDegradedSince: Date.now() }),
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    const snap = getStatusSnapshot();
    expect(snap.live?.state).toBe('yellow');
    expect(snap.live?.message).toContain('reconnect the desktop');
    expect(snap.live?.context?.degraded).toBe(1);
    expect(snap.live?.context?.firstDegraded).toBe('totp-wf');
  });

  it('the degraded message takes precedence over generic stale-yellow', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ workflowUid: 'stale-wf', consecutiveFailures: 2 }),
      makeRun({ workflowUid: 'degraded-wf', exclusiveDegradedSince: Date.now() }),
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    expect(getStatusSnapshot().live?.message).toContain('reconnect the desktop');
  });

  it('red dominates a degraded row', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([
      makeRun({ workflowUid: 'degraded-wf', exclusiveDegradedSince: Date.now() }),
      makeRun({ workflowUid: 'red-wf', consecutiveFailures: 6 }),
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    expect(getStatusSnapshot().live?.state).toBe('red');
  });

  it('does not leak captured values into the Status message/context', async () => {
    listWorkflowRunCachesMock.mockResolvedValue([
      {
        ...makeRun({ consecutiveFailures: 5, workflowUid: 'secret-wf' }),
        stepCaptures: { login: { token: 'super-secret-token-xyz' } },
      },
    ]);
    scheduler.startLiveScheduler();
    await new Promise((r) => setTimeout(r, 10));
    const snap = getStatusSnapshot();
    const serialized = JSON.stringify(snap);
    expect(serialized).not.toContain('super-secret-token-xyz');
  });
});
