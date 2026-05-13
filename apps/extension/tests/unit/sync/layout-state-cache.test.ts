/**
 * Phase B — layout-state cache subscribes to broadcast, re-projects to
 * the persisted opaque blob shape, and persists to chrome.storage.local.
 */

import { setLayoutState } from '@openheaders/core/sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createLayoutStateCache } from '@openheaders/oracle/sync/layout-state-cache';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

const ctxFactory = () => ({
  workspaceId: 'ws-1',
  hlc: { physicalMs: Date.now(), logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('LayoutStateCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createLayoutStateCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getSnapshot()).toEqual({ layout: null });
    cache.dispose();
  });

  it('seeds the oracle from a persisted layout and projects it back', async () => {
    const cache = createLayoutStateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedLayout({
      sidebarRatio: 0.2,
      inspectorRatio: 0.25,
      bottomRatio: 0.3,
    });
    expect(cache.getSnapshot().layout).toEqual({
      sidebarRatio: 0.2,
      inspectorRatio: 0.25,
      bottomRatio: 0.3,
    });
    cache.dispose();
  });

  it('seedFromPersistedLayout is a no-op when given null', async () => {
    const cache = createLayoutStateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedLayout(null);
    expect(cache.getSnapshot()).toEqual({ layout: null });
    cache.dispose();
  });

  it('updates the cache when a new layout is set via the catalog', async () => {
    const cache = createLayoutStateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedLayout({
      sidebarRatio: 0.2,
      inspectorRatio: 0.25,
      bottomRatio: 0.3,
    });

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });

    const laterCtx = {
      ...ctxFactory(),
      hlc: { physicalMs: Date.now() + 1_000, logical: 0, nodeId: 'n0' as const },
    };
    const intent = setLayoutState(laterCtx, {
      layout: { sidebarRatio: 0.5, inspectorRatio: 0.3, bottomRatio: 0.2 },
    });
    await oracle.apply(intent.batch, []);
    expect(calls).toBeGreaterThan(0);
    expect(cache.getSnapshot().layout).toEqual({
      sidebarRatio: 0.5,
      inspectorRatio: 0.3,
      bottomRatio: 0.2,
    });
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createLayoutStateCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedLayout({
      sidebarRatio: 0.2,
      inspectorRatio: 0.25,
      bottomRatio: 0.3,
    });

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });
    cache.dispose();

    const intent = setLayoutState(ctxFactory(), { layout: { sidebarRatio: 0.4 } });
    await oracle.apply(intent.batch, []);
    expect(calls).toBe(0);
  });
});
