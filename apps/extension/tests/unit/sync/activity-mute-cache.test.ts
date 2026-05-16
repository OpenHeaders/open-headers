/**
 * Phase C F6.b — Activity mute cache (host-neutral runtime).
 *
 * The cache is the synchronously-readable source of truth the
 * installer's gate consults. Tests pin: lazy hydration, sync gate
 * behaviour pre/post hydration, idempotent mute/unmute, subscriber
 * fan-out + isolation against thrown listeners.
 */

import {
  InMemoryActivityMuteStore,
  __resetActivityMuteCacheForTests,
  ensureMutesLoaded,
  isMutedForActivityFeed,
  listMutedActivityEntities,
  muteActivityEntity,
  setActivityMuteClockForTests,
  setActivityMuteStore,
  subscribeActivityMuteChanges,
  unmuteActivityEntity,
  type ActivityMuteChange,
} from '@openheaders/oracle/sync';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WS = '0193a8ff-c000-7000-8000-000000000001';
const WS2 = '0193a8ff-c000-7000-8000-000000000002';

beforeEach(() => {
  __resetActivityMuteCacheForTests();
});

afterEach(() => {
  __resetActivityMuteCacheForTests();
});

describe('activity-mute-cache', () => {
  it('isMuted returns false when the cache is empty + cold', () => {
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(false);
  });

  it('hydrates the cache from the persisted store on ensureMutesLoaded', async () => {
    const store = new InMemoryActivityMuteStore();
    await store.put({ workspaceId: WS, entityType: 'rule', entityId: 'r1', mutedAt: 100 });
    await store.put({ workspaceId: WS, entityType: 'request', entityId: 'req-9', mutedAt: 200 });
    setActivityMuteStore(store);
    await ensureMutesLoaded(WS);
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(true);
    expect(isMutedForActivityFeed(WS, 'request', 'req-9')).toBe(true);
    expect(isMutedForActivityFeed(WS, 'rule', 'r2')).toBe(false);
  });

  it('ensureMutesLoaded is idempotent (deduped promise)', async () => {
    const store = new InMemoryActivityMuteStore();
    const listSpy = vi.spyOn(store, 'list');
    setActivityMuteStore(store);
    await Promise.all([ensureMutesLoaded(WS), ensureMutesLoaded(WS), ensureMutesLoaded(WS)]);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('mute updates cache synchronously + persists store + notifies subscribers', async () => {
    setActivityMuteClockForTests(() => 1_234);
    const store = new InMemoryActivityMuteStore();
    setActivityMuteStore(store);
    const changes: ActivityMuteChange[] = [];
    const off = subscribeActivityMuteChanges((c) => changes.push(c));

    const entry = await muteActivityEntity(WS, 'rule', 'r1');

    // Cache reflects the mute synchronously (the await above completed).
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(true);
    // Persisted store has the entry.
    expect(await store.has(WS, 'rule', 'r1')).toBe(true);
    // Subscriber received the change.
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      workspaceId: WS,
      entityType: 'rule',
      entityId: 'r1',
      muted: true,
      at: 1_234,
    });
    expect(entry.mutedAt).toBe(1_234);
    off();
  });

  it('unmute removes from cache, persists store, notifies subscribers', async () => {
    const store = new InMemoryActivityMuteStore();
    setActivityMuteStore(store);
    await muteActivityEntity(WS, 'rule', 'r1');

    const changes: ActivityMuteChange[] = [];
    const off = subscribeActivityMuteChanges((c) => changes.push(c));
    await unmuteActivityEntity(WS, 'rule', 'r1');

    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(false);
    expect(await store.has(WS, 'rule', 'r1')).toBe(false);
    expect(changes).toEqual([
      expect.objectContaining({ muted: false, entityType: 'rule', entityId: 'r1' }),
    ]);
    off();
  });

  it('unmute on an absent pair still notifies (idempotent)', async () => {
    const store = new InMemoryActivityMuteStore();
    setActivityMuteStore(store);
    const changes: ActivityMuteChange[] = [];
    const off = subscribeActivityMuteChanges((c) => changes.push(c));
    await unmuteActivityEntity(WS, 'rule', 'never-muted');
    expect(changes).toEqual([
      expect.objectContaining({ muted: false, entityId: 'never-muted' }),
    ]);
    off();
  });

  it('listMutedActivityEntities returns workspace-scoped entries in mutedAt order', async () => {
    let now = 100;
    setActivityMuteClockForTests(() => now);
    const store = new InMemoryActivityMuteStore();
    setActivityMuteStore(store);
    await muteActivityEntity(WS, 'rule', 'r-late'); // 100
    now = 50;
    await muteActivityEntity(WS, 'request', 'r-early'); // 50
    now = 999;
    await muteActivityEntity(WS2, 'rule', 'in-other-ws');

    const wsRows = await listMutedActivityEntities(WS);
    expect(wsRows.map((r) => r.entityId)).toEqual(['r-early', 'r-late']);
    const ws2Rows = await listMutedActivityEntities(WS2);
    expect(ws2Rows.map((r) => r.entityId)).toEqual(['in-other-ws']);
  });

  it('throwing subscriber does not poison siblings or the mutation pipeline', async () => {
    const store = new InMemoryActivityMuteStore();
    setActivityMuteStore(store);
    const good = vi.fn();
    subscribeActivityMuteChanges(() => {
      throw new Error('listener boom');
    });
    subscribeActivityMuteChanges(good);

    await muteActivityEntity(WS, 'rule', 'r1');
    expect(good).toHaveBeenCalledOnce();
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(true);
  });

  it('falls back to a no-op + retries when ensureMutesLoaded throws', async () => {
    let calls = 0;
    const store = new InMemoryActivityMuteStore();
    vi.spyOn(store, 'list').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) throw new Error('boom');
      return [];
    });
    setActivityMuteStore(store);

    await expect(ensureMutesLoaded(WS)).rejects.toThrow('boom');
    // Second call retries (the failed promise was not memoized).
    await ensureMutesLoaded(WS);
    expect(calls).toBe(2);
  });

  it('no store installed → ensureMutesLoaded resolves and cache stays empty', async () => {
    await ensureMutesLoaded(WS);
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(false);
  });
});
