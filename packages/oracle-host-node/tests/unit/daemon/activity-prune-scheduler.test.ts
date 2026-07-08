/**
 * Phase C F7 — Node-host activity-prune scheduler wiring.
 *
 * Pins:
 *   - setInterval drives a sweep at the configured period;
 *   - sweep calls `prune` on every listed workspace with the 7-day cutoff;
 *   - stop() halts further ticks.
 */

import { type ActivityEntry, activityEntryId } from '@openheaders/core/sync';
import { InMemoryActivityLog } from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@openheaders/core/logger', () => ({
  hostLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { installActivityPruneScheduler } from '../../../src/daemon/activity-prune-scheduler';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const NOW = 1_700_000_000_000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function makeEntry(overrides: Partial<ActivityEntry>): ActivityEntry {
  const base: ActivityEntry = {
    id: '',
    workspaceId: WS,
    mutationId: 'mut-001',
    hlc: { physicalMs: NOW, logical: 0, nodeId: 'n' },
    kind: 'edit-entity',
    entityType: 'rule',
    entityId: 'r1',
    origin: { surfaceId: 'main', deviceId: 'device-A' },
    observedAt: NOW,
    read: false,
    ...overrides,
  };
  return { ...base, id: activityEntryId(base) };
}

describe('node-host activity-prune scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sweeps every resident workspace on each tick', async () => {
    const log = new InMemoryActivityLog();
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'old', observedAt: NOW - RETENTION_MS - 1 }));
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'fresh', observedAt: NOW }));

    const stop = installActivityPruneScheduler({
      getLog: () => log,
      listWorkspaceIds: () => [WS],
      periodMs: 1_000,
      now: () => NOW,
    });

    await vi.advanceTimersByTimeAsync(1_000);

    const remaining = await log.list(WS);
    expect(remaining.map((r) => r.mutationId)).toEqual(['fresh']);
    stop();
  });

  it('stop() halts further ticks', async () => {
    const log = new InMemoryActivityLog();
    const pruneSpy = vi.spyOn(log, 'prune');

    const stop = installActivityPruneScheduler({
      getLog: () => log,
      listWorkspaceIds: () => [WS],
      periodMs: 1_000,
      now: () => NOW,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(pruneSpy).toHaveBeenCalledTimes(1);

    stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(pruneSpy).toHaveBeenCalledTimes(1);
  });

  it('tolerates a null log without throwing', async () => {
    const stop = installActivityPruneScheduler({
      getLog: () => null,
      listWorkspaceIds: () => [WS],
      periodMs: 1_000,
      now: () => NOW,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    stop();
  });

  it('picks up new workspaces on each tick (no re-install)', async () => {
    const log = new InMemoryActivityLog();
    await log.append(makeEntry({ workspaceId: WS, mutationId: 'a-old', observedAt: NOW - RETENTION_MS - 1 }));
    await log.append(makeEntry({ workspaceId: 'other', mutationId: 'b-old', observedAt: NOW - RETENTION_MS - 1 }));
    const pruneSpy = vi.spyOn(log, 'prune');

    let workspaces: readonly string[] = [WS];
    const stop = installActivityPruneScheduler({
      getLog: () => log,
      listWorkspaceIds: () => workspaces,
      periodMs: 1_000,
      now: () => NOW,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    expect(pruneSpy).toHaveBeenCalledTimes(1);
    expect(pruneSpy).toHaveBeenLastCalledWith(WS, NOW - RETENTION_MS);

    workspaces = [WS, 'other'];
    await vi.advanceTimersByTimeAsync(1_000);
    expect(pruneSpy).toHaveBeenCalledTimes(3);

    stop();
  });
});
