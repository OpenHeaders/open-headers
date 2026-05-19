/**
 * Phase C F7 — Activity Feed auto-decay sweep.
 *
 * Pins the host-neutral sweep core. Per-host installers (chrome.alarms
 * for the SW, setInterval for desktop main) have their own tests; both
 * delegate the iteration to `runActivityPruneSweep`.
 */

import { activityEntryId, type ActivityEntry } from '@openheaders/core/sync';
import {
  ACTIVITY_PRUNE_DEFAULT_RETENTION_MS,
  InMemoryActivityLog,
  runActivityPruneSweep,
  type ActivityLog,
} from '@openheaders/oracle/sync';
import { describe, expect, it, vi } from 'vitest';

const WS_A = '0193a8ff-c000-7000-8000-00000000000a';
const WS_B = '0193a8ff-c000-7000-8000-00000000000b';
const NOW = 1_700_000_000_000;

function makeEntry(overrides: Partial<ActivityEntry>): ActivityEntry {
  const base: ActivityEntry = {
    id: '',
    workspaceId: WS_A,
    orgId: 'org-test',
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

describe('runActivityPruneSweep', () => {
  it('returns an empty result with no totalRemoved when log is null', async () => {
    const result = await runActivityPruneSweep({
      log: null,
      workspaceIds: [WS_A],
      now: NOW,
    });
    expect(result.totalRemoved).toBe(0);
    expect(result.perWorkspace).toEqual([]);
    expect(result.cutoffObservedAtMs).toBe(NOW - ACTIVITY_PRUNE_DEFAULT_RETENTION_MS);
  });

  it('returns an empty perWorkspace when no workspace ids are supplied', async () => {
    const log = new InMemoryActivityLog();
    const result = await runActivityPruneSweep({ log, workspaceIds: [], now: NOW });
    expect(result.perWorkspace).toEqual([]);
    expect(result.totalRemoved).toBe(0);
  });

  it('prunes rows older than the default 7-day retention window', async () => {
    const log = new InMemoryActivityLog();
    const eightDaysAgo = NOW - 8 * 24 * 60 * 60 * 1000;
    const sixDaysAgo = NOW - 6 * 24 * 60 * 60 * 1000;
    await log.append(makeEntry({ mutationId: 'old', observedAt: eightDaysAgo }));
    await log.append(makeEntry({ mutationId: 'new', observedAt: sixDaysAgo }));

    const result = await runActivityPruneSweep({ log, workspaceIds: [WS_A], now: NOW });

    expect(result.totalRemoved).toBe(1);
    expect(result.perWorkspace).toEqual([{ workspaceId: WS_A, removed: 1 }]);
    const remaining = await log.list(WS_A);
    expect(remaining.map((r) => r.mutationId)).toEqual(['new']);
  });

  it('honours a caller-supplied retention override', async () => {
    const log = new InMemoryActivityLog();
    const tenMinutesAgo = NOW - 10 * 60 * 1000;
    const oneMinuteAgo = NOW - 1 * 60 * 1000;
    await log.append(makeEntry({ mutationId: 'old', observedAt: tenMinutesAgo }));
    await log.append(makeEntry({ mutationId: 'new', observedAt: oneMinuteAgo }));

    const result = await runActivityPruneSweep({
      log,
      workspaceIds: [WS_A],
      now: NOW,
      retentionMs: 5 * 60 * 1000,
    });

    expect(result.totalRemoved).toBe(1);
    expect(result.cutoffObservedAtMs).toBe(NOW - 5 * 60 * 1000);
  });

  it('iterates every supplied workspace independently and aggregates totals', async () => {
    const log = new InMemoryActivityLog();
    const old = NOW - 8 * 24 * 60 * 60 * 1000;
    await log.append(makeEntry({ workspaceId: WS_A, mutationId: 'a-old', observedAt: old }));
    await log.append(makeEntry({ workspaceId: WS_A, mutationId: 'a-old-2', observedAt: old }));
    await log.append(makeEntry({ workspaceId: WS_B, mutationId: 'b-old', observedAt: old }));

    const result = await runActivityPruneSweep({
      log,
      workspaceIds: [WS_A, WS_B],
      now: NOW,
    });

    expect(result.totalRemoved).toBe(3);
    expect(result.perWorkspace).toEqual([
      { workspaceId: WS_A, removed: 2 },
      { workspaceId: WS_B, removed: 1 },
    ]);
  });

  it('records a null per-workspace result when prune throws and continues with the rest', async () => {
    const inner = new InMemoryActivityLog();
    const old = NOW - 8 * 24 * 60 * 60 * 1000;
    await inner.append(makeEntry({ workspaceId: WS_B, mutationId: 'b-old', observedAt: old }));
    const faulty: ActivityLog = {
      append: inner.append.bind(inner),
      list: inner.list.bind(inner),
      markRead: inner.markRead.bind(inner),
      countUnread: inner.countUnread.bind(inner),
      has: inner.has.bind(inner),
      prune: vi.fn(async (workspaceId: string, beforeObservedAtMs: number) => {
        if (workspaceId === WS_A) throw new Error('boom');
        return inner.prune(workspaceId, beforeObservedAtMs);
      }),
    };

    const result = await runActivityPruneSweep({
      log: faulty,
      workspaceIds: [WS_A, WS_B],
      now: NOW,
    });

    expect(result.perWorkspace).toEqual([
      { workspaceId: WS_A, removed: null },
      { workspaceId: WS_B, removed: 1 },
    ]);
    expect(result.totalRemoved).toBe(1);
  });
});
