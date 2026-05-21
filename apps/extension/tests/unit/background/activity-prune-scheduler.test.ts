/**
 * Phase C F7 — extension SW activity-prune scheduler wiring.
 *
 * Pins:
 *   - install creates a recurring alarm with the expected name + period;
 *   - the alarm-name predicate routes only the prune alarm;
 *   - handle delegates to the host-neutral sweep, passing the live log +
 *     workspace-id snapshot;
 *   - a null log short-circuits with totalRemoved === 0.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { activityEntryId, type ActivityEntry } from '@openheaders/core/sync';
import { InMemoryActivityLog } from '@openheaders/oracle/sync';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const createMock = vi.fn();

vi.mock('@utils/browser-api', () => ({
  alarms: {
    create: (...args: unknown[]) => createMock(...args),
  },
}));

import {
  __resetActivityPruneSchedulerForTests,
  handleActivityPruneAlarm,
  installActivityPruneScheduler,
  isActivityPruneAlarm,
} from '@/background/activity-prune-scheduler';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const NOW = 1_700_000_000_000;

function makeEntry(overrides: Partial<ActivityEntry>): ActivityEntry {
  const base: ActivityEntry = {
    id: '',
    workspaceId: WS,
    mutationId: 'mut-001',
    hlc: { physicalMs: NOW, logical: 0, nodeId: 'n' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'popup', deviceId: 'device-A' },
    observedAt: NOW,
    read: false,
    ...overrides,
  };
  return { ...base, id: activityEntryId(base) };
}

describe('extension activity-prune scheduler', () => {
  beforeEach(() => {
    createMock.mockClear();
    __resetActivityPruneSchedulerForTests();
  });

  afterEach(() => {
    __resetActivityPruneSchedulerForTests();
  });

  it('install registers a chrome.alarms tick with the canonical name + hourly period', () => {
    installActivityPruneScheduler({
      getLog: () => null,
      listWorkspaceIds: () => [],
    });
    expect(createMock).toHaveBeenCalledTimes(1);
    const [name, opts] = createMock.mock.calls[0];
    expect(name).toBe('oh.sync.activity-prune');
    expect(opts).toEqual({ periodInMinutes: 60 });
  });

  it('isActivityPruneAlarm matches only the canonical alarm name', () => {
    expect(isActivityPruneAlarm({ name: 'oh.sync.activity-prune' } as chrome.alarms.Alarm)).toBe(true);
    expect(isActivityPruneAlarm({ name: 'wsReconnect' } as chrome.alarms.Alarm)).toBe(false);
  });

  it('handle drops rows older than the 7-day retention across all listed workspaces', async () => {
    const log = new InMemoryActivityLog();
    const old = NOW - 8 * 24 * 60 * 60 * 1000;
    const fresh = NOW - 1 * 24 * 60 * 60 * 1000;
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'old', observedAt: old }));
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'fresh', observedAt: fresh }));

    installActivityPruneScheduler({
      getLog: () => log,
      listWorkspaceIds: () => [WS],
      now: () => NOW,
    });

    const result = await handleActivityPruneAlarm();
    expect(result.totalRemoved).toBe(1);
    const remaining = await log.list(WS);
    expect(remaining.map((r) => r.mutationId)).toEqual(['fresh']);
  });

  it('handle short-circuits with a zero result when no log is installed', async () => {
    installActivityPruneScheduler({
      getLog: () => null,
      listWorkspaceIds: () => [WS],
      now: () => NOW,
    });
    const result = await handleActivityPruneAlarm();
    expect(result.totalRemoved).toBe(0);
    expect(result.perWorkspace).toEqual([]);
  });

  it('handle picks up workspace additions on each tick (no re-install)', async () => {
    const log = new InMemoryActivityLog();
    const old = NOW - 30 * 24 * 60 * 60 * 1000;
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'a-old', observedAt: old }));
    await log.append(
      makeEntry({ workspaceId: 'other', mutationId: 'b-old', observedAt: old }),
    );

    let workspaces: readonly string[] = [WS];
    installActivityPruneScheduler({
      getLog: () => log,
      listWorkspaceIds: () => workspaces,
      now: () => NOW,
    });

    const first = await handleActivityPruneAlarm();
    expect(first.perWorkspace).toEqual([{ workspaceId: WS, removed: 1 }]);

    workspaces = [WS, 'other'];
    const second = await handleActivityPruneAlarm();
    expect(second.perWorkspace).toEqual([
      { workspaceId: WS, removed: 0 },
      { workspaceId: 'other', removed: 1 },
    ]);
  });
});
