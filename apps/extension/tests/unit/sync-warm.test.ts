/**
 * Sync-warm DNR compile path — `requireFreshOnRuleBuild` contract.
 *
 * Contract:
 *   - `kickSyncWarmRefreshes()` is a no-op when no enabled LV opts in,
 *     or when every opted-in LV's cache row is still fresh.
 *   - When an opted-in LV's cache is absent or expired, the function
 *     drives `refreshLiveWorkflowSynchronously` for the backing
 *     workflow and awaits up to `SYNC_WARM_TIMEOUT_MS`.
 *   - Multiple LVs pointing at the same workflow collapse into one
 *     refresh (uid dedup).
 *   - A refresh that exceeds `SYNC_WARM_TIMEOUT_MS` emits a `warn`
 *     observability entry; the caller proceeds with the stale value.
 *   - Manual-override active LVs never trigger warm-up (their value is
 *     fixed; the workflow's cache is irrelevant until override lifts).
 */

import type { V5 } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const recordLogMock = vi.fn();
vi.mock('@/background/modules/observability-log', () => ({
  recordLog: (...args: unknown[]) => recordLogMock(...args),
}));

const refreshSyncMock = vi.fn();

let liveVariables: V5.LiveVariable[] = [];
vi.mock('@/background/modules/live-variable-store', () => ({
  getLiveVariables: () => liveVariables.slice(),
  onLiveVariableStoreChange: () => () => {},
}));

let cachedRuns: Array<{
  workflowUid: string;
  environmentId: string | null;
  expiresAt: number | null;
  extractedAt: number;
}> = [];
vi.mock('@/background/modules/live-cache-store', () => ({
  listWorkflowRunCaches: async () => cachedRuns.slice(),
  onLiveCacheStoreChange: () => () => {},
}));

vi.mock('@/background/modules/rule-store', () => ({
  getRules: () => [],
  getCollections: () => [],
}));

vi.mock('@/background/modules/workspace-store', () => ({
  getActiveWorkspaceId: () => 'ws-test',
}));

const activeEnv: { id: string | null } = { id: 'env-prod' };
vi.mock('@/background/modules/environment-store', () => ({
  getVault: () => ({ schemaVersion: 5, version: 1, secrets: [] }),
  getEnvironments: () => [],
  getActiveEnvironmentId: () => activeEnv.id,
  getDefaultEnvironmentId: () => null,
  getWorkspaceVariables: () => ({ schemaVersion: 5, version: 1, variables: [] }),
}));

import {
  __setSyncWarmRunner,
  hydrateLiveCacheMirror,
  kickSyncWarmRefreshes,
  __resetForTests as resetResolver,
  SYNC_WARM_TIMEOUT_MS,
} from '@/background/modules/variables-resolver';

function makeLv(overrides: Partial<V5.LiveVariable>): V5.LiveVariable {
  return {
    schemaVersion: 5,
    version: 1,
    uid: 'lv000001',
    path: 'live-variables/v',
    name: 'token',
    workflowUid: 'wflowaa1',
    stepId: 'login',
    captureName: 'access',
    enabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  liveVariables = [];
  cachedRuns = [];
  activeEnv.id = 'env-prod';
  refreshSyncMock.mockReset();
  recordLogMock.mockReset();
  resetResolver();
  __setSyncWarmRunner(refreshSyncMock);
});

afterEach(() => {
  __setSyncWarmRunner(null);
  vi.restoreAllMocks();
});

describe('kickSyncWarmRefreshes', () => {
  it('is a no-op when no LV opts into requireFreshOnRuleBuild', async () => {
    liveVariables = [makeLv({ requireFreshOnRuleBuild: false })];
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).not.toHaveBeenCalled();
  });

  it('is a no-op when the opted-in LV cache is fresh (expiresAt in future)', async () => {
    liveVariables = [makeLv({ requireFreshOnRuleBuild: true })];
    cachedRuns = [
      {
        workflowUid: 'wflowaa1',
        environmentId: 'env-prod',
        extractedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ];
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).not.toHaveBeenCalled();
  });

  it('triggers a refresh when the cache row is absent', async () => {
    liveVariables = [makeLv({ requireFreshOnRuleBuild: true })];
    cachedRuns = [];
    refreshSyncMock.mockResolvedValue(undefined);
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).toHaveBeenCalledWith('ws-test', 'wflowaa1', 'env-prod');
  });

  it('triggers a refresh when the cache row is past expiresAt', async () => {
    liveVariables = [makeLv({ requireFreshOnRuleBuild: true })];
    cachedRuns = [
      {
        workflowUid: 'wflowaa1',
        environmentId: 'env-prod',
        extractedAt: Date.now() - 120_000,
        expiresAt: Date.now() - 60_000,
      },
    ];
    refreshSyncMock.mockResolvedValue(undefined);
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).toHaveBeenCalledTimes(1);
  });

  it('collapses multiple stale LVs targeting the same workflow into one refresh', async () => {
    liveVariables = [
      makeLv({ uid: 'lv1aaaaa', name: 'a', requireFreshOnRuleBuild: true }),
      makeLv({ uid: 'lv2aaaaa', name: 'b', requireFreshOnRuleBuild: true, captureName: 'other' }),
    ];
    cachedRuns = [];
    refreshSyncMock.mockResolvedValue(undefined);
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).toHaveBeenCalledTimes(1);
  });

  it('skips LVs whose manual override is still active', async () => {
    liveVariables = [
      makeLv({
        requireFreshOnRuleBuild: true,
        manualOverride: { value: 'pinned' },
      }),
    ];
    cachedRuns = [];
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).not.toHaveBeenCalled();
  });

  it('warms LVs whose manual override has expired', async () => {
    liveVariables = [
      makeLv({
        requireFreshOnRuleBuild: true,
        manualOverride: { value: 'pinned', until: Date.now() - 1000 },
      }),
    ];
    cachedRuns = [];
    refreshSyncMock.mockResolvedValue(undefined);
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to stale on timeout and logs a warn entry', async () => {
    vi.useFakeTimers();
    try {
      liveVariables = [makeLv({ requireFreshOnRuleBuild: true })];
      cachedRuns = [];
      // Refresh hangs forever — simulates a slow upstream that exceeds budget.
      refreshSyncMock.mockReturnValue(new Promise(() => {}));
      await hydrateLiveCacheMirror();

      const kick = kickSyncWarmRefreshes();
      await vi.advanceTimersByTimeAsync(SYNC_WARM_TIMEOUT_MS + 100);
      await kick;

      expect(recordLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subsystem: 'live',
          op: 'sync-warm-timeout',
          level: 'warn',
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores disabled LVs even when their cache is stale', async () => {
    liveVariables = [makeLv({ enabled: false, requireFreshOnRuleBuild: true })];
    cachedRuns = [];
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).not.toHaveBeenCalled();
  });

  it('scopes cache freshness check to the active environment', async () => {
    liveVariables = [makeLv({ requireFreshOnRuleBuild: true })];
    // Fresh cache for a DIFFERENT env should not count as fresh for this one.
    cachedRuns = [
      {
        workflowUid: 'wflowaa1',
        environmentId: 'env-dev',
        extractedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      },
    ];
    refreshSyncMock.mockResolvedValue(undefined);
    await hydrateLiveCacheMirror();
    await kickSyncWarmRefreshes();
    expect(refreshSyncMock).toHaveBeenCalledWith('ws-test', 'wflowaa1', 'env-prod');
  });
});
