/**
 * Singleton-entity-cache — undecryptable-baseline lock (WS-B B2).
 *
 * When `hydrateFromStorage` reads a present-but-undecryptable persisted blob
 * (the at-rest key was lost out from under the surviving ciphertext), the
 * cache must enter a `locked` state and REFUSE to seed `emptySnapshot` over
 * it — otherwise a subsequent edit diffs against an empty baseline and
 * silently tombstones the orphaned secrets. An `absent` slot stays the
 * ordinary empty path; a real mutation clears the lock (re-entry).
 */

import type { GuardedRead } from '@openheaders/core/storage';
import type { MutationBatch } from '@openheaders/core/sync';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import type { EntityOracle } from '../../src/sync/oracle';
import { createSingletonEntityCache, type SingletonEntityCacheConfig } from '../../src/sync/singleton-entity-cache';

interface Snap {
  value: string;
}

const ENTITY_TYPE = 'test-entity';
const EMPTY: Snap = { value: 'empty' };
const PROJECTED: Snap = { value: 'projected' };

const oracleStub = { apply: async () => ({ ok: true }) } as unknown as EntityOracle;
const contextFactory = () => ({}) as never;

function makeCache(guarded: GuardedRead<Snap>, overrides: Partial<SingletonEntityCacheConfig<Snap, Snap>> = {}) {
  const broadcast = new InMemoryBroadcast();
  const project = vi.fn(() => PROJECTED);
  const buildSeedBatch = vi.fn(() => ({}) as MutationBatch);
  const cache = createSingletonEntityCache<Snap, Snap>('ws-1', oracleStub, broadcast, contextFactory, {
    entityType: ENTITY_TYPE,
    loggerTag: 'TestCache',
    emptySnapshot: EMPTY,
    project,
    isEmptySnapshot: (s) => s.value === 'empty',
    buildSeedBatch,
    loadGuardedFromStorage: async () => guarded,
    ...overrides,
  });
  return { cache, broadcast, project, buildSeedBatch };
}

/** A broadcast event for ENTITY_TYPE — enough to drive the subscription. */
function entityMutation(): Parameters<InMemoryBroadcast['publish']>[0] {
  return { envelope: { body: { type: ENTITY_TYPE } }, outcome: {} } as unknown as Parameters<
    InMemoryBroadcast['publish']
  >[0];
}

describe('singleton-entity-cache — undecryptable-baseline lock', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('locks and refuses to seed when the persisted blob is undecryptable', async () => {
    const { cache, project, buildSeedBatch } = makeCache({ status: 'undecryptable' });
    const listener = vi.fn();
    cache.onChange(listener);

    await cache.hydrateFromStorage();

    expect(cache.isLocked()).toBe(true);
    expect(cache.getSnapshot()).toBe(EMPTY); // NOT seeded
    expect(buildSeedBatch).not.toHaveBeenCalled();
    expect(project).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1); // surfaced to consumers
  });

  it('stays unlocked and empty for an absent slot', async () => {
    const { cache, buildSeedBatch } = makeCache({ status: 'absent' });
    await cache.hydrateFromStorage();
    expect(cache.isLocked()).toBe(false);
    expect(cache.getSnapshot()).toBe(EMPTY);
    expect(buildSeedBatch).not.toHaveBeenCalled();
  });

  it('seeds normally for an ok value', async () => {
    const { cache, project, buildSeedBatch } = makeCache({ status: 'ok', value: { value: 'persisted' } });
    await cache.hydrateFromStorage();
    expect(cache.isLocked()).toBe(false);
    expect(buildSeedBatch).toHaveBeenCalledTimes(1);
    expect(project).toHaveBeenCalled();
    expect(cache.getSnapshot()).toBe(PROJECTED);
  });

  it('clears the lock when authoritative content lands (re-entry)', async () => {
    const { cache, broadcast } = makeCache({ status: 'undecryptable' });
    await cache.hydrateFromStorage();
    expect(cache.isLocked()).toBe(true);

    broadcast.publish(entityMutation()); // project → PROJECTED (non-empty)

    expect(cache.isLocked()).toBe(false);
    expect(cache.getSnapshot()).toBe(PROJECTED);
  });

  it('keeps the lock through a benign empty re-seed (active-mirror bridge)', async () => {
    // The bridge seeds the active cache from a `null`/empty direct read; that
    // empty re-project must NOT clear the lost-key lock.
    const { cache, broadcast } = makeCache({ status: 'undecryptable' }, { project: () => EMPTY });
    await cache.hydrateFromStorage();
    expect(cache.isLocked()).toBe(true);

    broadcast.publish(entityMutation()); // project → EMPTY (still empty)

    expect(cache.isLocked()).toBe(true);
    expect(cache.getSnapshot()).toBe(EMPTY);
  });

  it('falls back to the plain loadFromStorage path when no guarded loader is wired', async () => {
    const broadcast = new InMemoryBroadcast();
    const project = vi.fn(() => PROJECTED);
    const cache = createSingletonEntityCache<Snap, Snap>('ws-1', oracleStub, broadcast, contextFactory, {
      entityType: ENTITY_TYPE,
      loggerTag: 'TestCache',
      emptySnapshot: EMPTY,
      project,
      buildSeedBatch: () => ({}) as MutationBatch,
      loadFromStorage: async () => ({ value: 'persisted' }),
    });
    await cache.hydrateFromStorage();
    expect(cache.isLocked()).toBe(false);
    expect(cache.getSnapshot()).toBe(PROJECTED);
  });
});
