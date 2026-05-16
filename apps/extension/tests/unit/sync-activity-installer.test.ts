/**
 * Phase C F2.b — activity installer wiring.
 *
 * Pins three behaviours independent of any host plumbing:
 *
 *   - Inbound + applied envelope → write to the activity log.
 *   - Outbound (local) envelope → skipped.
 *   - No log installed → entry dropped, count incremented.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MutationEnvelope } from '@openheaders/core/sync';
import { InMemoryActivityLog } from '@openheaders/oracle/sync';
import type { OracleSyncBroadcastEvent } from '@openheaders/oracle/sync';

const hasRecentlyAppliedMock = vi.fn<(id: string) => boolean>(() => false);

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/background/sync-mutation-receiver', () => ({
  hasRecentlyApplied: (id: string) => hasRecentlyAppliedMock(id),
}));

import {
  __getDroppedNoLogCount,
  __resetActivityInstallerForTests,
  countUnreadActivityEntries,
  observeForActivityFeed,
  setActivityClockForTests,
  setActivityLog,
  subscribeActivityEntries,
} from '../../src/background/sync-activity-installer';

const WS = '0193a8ff-c000-7000-8000-000000000001';

function event(
  mutationId: string,
  body: MutationEnvelope['body'],
  outcomeStatus: OracleSyncBroadcastEvent['outcome']['status'] = 'applied',
): OracleSyncBroadcastEvent {
  return {
    envelope: {
      mutationId,
      hlc: { physicalMs: 1_000, logical: 0, nodeId: 'sw' },
      origin: { surfaceId: 'sw', deviceId: 'self' },
      workspaceId: WS,
      mutatorVersion: 1,
      body,
    },
    outcome: { status: outcomeStatus },
  } as OracleSyncBroadcastEvent;
}

beforeEach(() => {
  hasRecentlyAppliedMock.mockReset();
  hasRecentlyAppliedMock.mockReturnValue(false);
  __resetActivityInstallerForTests();
  setActivityClockForTests(() => 1_700_000_000_000);
});

afterEach(() => {
  __resetActivityInstallerForTests();
});

describe('observeForActivityFeed', () => {
  it('writes an entry for an inbound applied envelope', async () => {
    const log = new InMemoryActivityLog();
    setActivityLog(log);
    hasRecentlyAppliedMock.mockReturnValue(true);

    observeForActivityFeed(event('m1', { kind: 'create', type: 'rule', id: 'r1', payload: {} }));
    // Append is fire-and-forget; flush microtasks before asserting.
    await Promise.resolve();

    const rows = await log.list(WS);
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe('create-entity');
    expect(rows[0].mutationId).toBe('m1');
    expect(rows[0].observedAt).toBe(1_700_000_000_000);
  });

  it('skips local-origin envelopes (not in the inbound seen-set)', async () => {
    const log = new InMemoryActivityLog();
    setActivityLog(log);
    hasRecentlyAppliedMock.mockReturnValue(false);

    observeForActivityFeed(event('m1', { kind: 'create', type: 'rule', id: 'r1', payload: {} }));
    await Promise.resolve();

    expect((await log.list(WS)).length).toBe(0);
  });

  it('skips non-applied outcomes', async () => {
    const log = new InMemoryActivityLog();
    setActivityLog(log);
    hasRecentlyAppliedMock.mockReturnValue(true);

    observeForActivityFeed(
      event('m1', { kind: 'create', type: 'rule', id: 'r1', payload: {} }, 'superseded-by-hlc'),
    );
    await Promise.resolve();

    expect((await log.list(WS)).length).toBe(0);
  });

  it('counts drops when no log is installed', () => {
    setActivityLog(null);
    hasRecentlyAppliedMock.mockReturnValue(true);

    observeForActivityFeed(event('m1', { kind: 'create', type: 'rule', id: 'r1', payload: {} }));
    observeForActivityFeed(event('m2', { kind: 'delete', type: 'rule', id: 'r1' }));

    expect(__getDroppedNoLogCount()).toBe(2);
  });

  it('notifies subscribers per classified entry', () => {
    const log = new InMemoryActivityLog();
    setActivityLog(log);
    hasRecentlyAppliedMock.mockReturnValue(true);

    const seen: string[] = [];
    const unsubscribe = subscribeActivityEntries((entry) => seen.push(entry.kind));

    observeForActivityFeed(event('m1', { kind: 'create', type: 'rule', id: 'r1', payload: {} }));
    observeForActivityFeed(event('m2', { kind: 'delete', type: 'rule', id: 'r1' }));

    expect(seen).toEqual(['create-entity', 'delete-entity']);

    unsubscribe();
    observeForActivityFeed(event('m3', { kind: 'create', type: 'rule', id: 'r2', payload: {} }));
    expect(seen).toEqual(['create-entity', 'delete-entity']);
  });

  it('countUnreadActivityEntries returns 0 when no log is installed', async () => {
    setActivityLog(null);
    await expect(countUnreadActivityEntries(WS)).resolves.toBe(0);
  });

  it('countUnreadActivityEntries delegates to the installed log', async () => {
    const log = new InMemoryActivityLog();
    setActivityLog(log);
    hasRecentlyAppliedMock.mockReturnValue(true);

    observeForActivityFeed(event('m1', { kind: 'create', type: 'rule', id: 'r1', payload: {} }));
    await Promise.resolve();

    await expect(countUnreadActivityEntries(WS)).resolves.toBe(1);
  });
});
