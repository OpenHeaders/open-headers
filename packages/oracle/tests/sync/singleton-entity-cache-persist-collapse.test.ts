/**
 * Singleton-entity-cache — persist-failure log collapse.
 *
 * Re-projections fire once per broadcast event per scope, so a standing
 * persist failure (the at-rest cipher unavailable being the canonical case)
 * would log one line per event per workspace. The cache must log the FIRST
 * failure of a message, count identical repeats silently, log again when the
 * message changes, and report the suppressed count once on recovery.
 */

import type { MutationBatch } from '@openheaders/core/sync';
import { logger } from '@openheaders/core/utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import { createSingletonEntityCache } from '../../src/sync/caches/singleton-entity-cache';
import type { EntityOracle } from '../../src/sync/oracle';

interface Snap {
  value: string;
}

const ENTITY_TYPE = 'test-entity';
const EMPTY: Snap = { value: 'empty' };
const PROJECTED: Snap = { value: 'projected' };

const oracleStub = { apply: async () => ({ ok: true }) } as unknown as EntityOracle;
const contextFactory = () => ({}) as never;

function makeCache(persist: (scope: string, snapshot: Snap) => Promise<void>) {
  const broadcast = new InMemoryBroadcast();
  const cache = createSingletonEntityCache<Snap, Snap>('ws-1', oracleStub, broadcast, contextFactory, {
    entityType: ENTITY_TYPE,
    loggerTag: 'TestCache',
    emptySnapshot: EMPTY,
    project: () => PROJECTED,
    buildSeedBatch: () => ({}) as MutationBatch,
    persist,
  });
  return { cache, broadcast };
}

function entityMutation(): Parameters<InMemoryBroadcast['publish']>[0] {
  return { envelope: { body: { type: ENTITY_TYPE } }, outcome: {} } as unknown as Parameters<
    InMemoryBroadcast['publish']
  >[0];
}

/** Persist settles on a microtask; flush before asserting log calls. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('singleton-entity-cache — persist-failure log collapse', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the first failure once and counts identical repeats silently', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { broadcast } = makeCache(() => Promise.reject(new Error('cipher unavailable')));

    for (let i = 0; i < 5; i += 1) broadcast.publish(entityMutation());
    await flush();

    const persistLines = info.mock.calls.filter(([, msg]) => String(msg).startsWith('persist failed'));
    expect(persistLines).toHaveLength(1);
    expect(persistLines[0]?.[1]).toContain('scope=ws-1');
    expect(persistLines[0]?.[2]).toBe('cipher unavailable');
  });

  it('logs again when the failure message changes', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    let message = 'cipher unavailable';
    const { broadcast } = makeCache(() => Promise.reject(new Error(message)));

    broadcast.publish(entityMutation());
    broadcast.publish(entityMutation());
    await flush();
    message = 'disk full';
    broadcast.publish(entityMutation());
    await flush();

    const persistLines = info.mock.calls.filter(([, msg]) => String(msg).startsWith('persist failed'));
    expect(persistLines).toHaveLength(2);
    expect(persistLines[1]?.[2]).toBe('disk full');
  });

  it('reports the suppressed count once on recovery, then stays quiet', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    let fail = true;
    const { broadcast } = makeCache(() => (fail ? Promise.reject(new Error('cipher unavailable')) : Promise.resolve()));

    for (let i = 0; i < 4; i += 1) broadcast.publish(entityMutation());
    await flush();
    fail = false;
    broadcast.publish(entityMutation());
    broadcast.publish(entityMutation());
    await flush();

    const recoveredLines = info.mock.calls.filter(([, msg]) => String(msg).startsWith('persist recovered'));
    expect(recoveredLines).toHaveLength(1);
    expect(recoveredLines[0]?.[1]).toContain('3 repeat failure(s) were suppressed');
  });

  it('logs nothing when persists succeed from the start', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => undefined);
    const { broadcast } = makeCache(() => Promise.resolve());

    broadcast.publish(entityMutation());
    await flush();

    const lines = info.mock.calls.filter(
      ([, msg]) => String(msg).startsWith('persist failed') || String(msg).startsWith('persist recovered'),
    );
    expect(lines).toHaveLength(0);
  });
});
