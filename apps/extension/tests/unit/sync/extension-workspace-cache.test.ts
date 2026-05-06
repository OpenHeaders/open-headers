/**
 * Phase B — extensionWorkspace cache subscribes to broadcast, re-projects
 * to the `(workspaces, activeWorkspaceId)` shape, and exposes a
 * synchronous mirror. Lives at the GLOBAL scope so the durable record
 * shape (legacy `oh.workspaces` + `oh.runtimeActive.active`) is owned by
 * the legacy direct-write path until commit 3 — the cache is in-memory
 * only here.
 */

import {
  EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  type ExtensionWorkspaceSlot,
  removeExtensionWorkspace,
  setActiveExtensionWorkspace,
  setExtensionWorkspace,
} from '@openheaders/core/sync';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { createExtensionWorkspaceCache } from '@/background/sync/extension-workspace-cache';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import type { V5 } from '@openheaders/core/types';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

// Monotonic HLC across factory calls — the active-id scalar is shared
// across mutations, and Date.now() collisions in the same ms would
// cause LWW to drop the second emission against the first.
let hlcCounter = 0;
const ctxFactory = () => ({
  workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
  hlc: { physicalMs: ++hlcCounter, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const ws = (overrides: Partial<V5.ExtensionWorkspace> = {}): V5.ExtensionWorkspace => ({
  schemaVersion: 5,
  id: 'ws-a',
  kind: 'personal',
  name: 'A',
  sortIndex: 0,
  createdAt: '2026-04-30T10:00:00.000Z',
  updatedAt: '2026-04-30T10:00:00.000Z',
  ...overrides,
});

const slot = (overrides: Partial<ExtensionWorkspaceSlot> = {}): ExtensionWorkspaceSlot => ({
  id: 'ws-a',
  kind: 'personal',
  name: 'A',
  createdAt: '2026-04-30T10:00:00.000Z',
  updatedAt: '2026-04-30T10:00:00.000Z',
  ...overrides,
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: EXTENSION_WORKSPACE_GLOBAL_SCOPE,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
  });
});

describe('ExtensionWorkspaceCache', () => {
  it('returns an empty default before seeding', () => {
    const cache = createExtensionWorkspaceCache(
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      oracle,
      broadcast,
      ctxFactory,
    );
    expect(cache.getSnapshot()).toEqual({ workspaces: [], activeWorkspaceId: null });
    cache.dispose();
  });

  it('seeds the oracle from a persisted state and projects it back', async () => {
    const cache = createExtensionWorkspaceCache(
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      oracle,
      broadcast,
      ctxFactory,
    );
    await cache.seedFromPersistedState({
      workspaces: [ws({ id: 'ws-a' }), ws({ id: 'ws-b', sortIndex: 1, name: 'B' })],
      activeWorkspaceId: 'ws-a',
    });
    const snap = cache.getSnapshot();
    expect(snap.workspaces.map((w) => w.id)).toEqual(['ws-a', 'ws-b']);
    expect(snap.activeWorkspaceId).toBe('ws-a');
    cache.dispose();
  });

  it('updates the cache when a new workspace is added via the catalog', async () => {
    const cache = createExtensionWorkspaceCache(
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      oracle,
      broadcast,
      ctxFactory,
    );
    await cache.seedFromPersistedState({ workspaces: [ws()], activeWorkspaceId: 'ws-a' });

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });

    const intent = setExtensionWorkspace(ctxFactory(), {
      slot: slot({ id: 'ws-new', name: 'New' }),
      orderKey: 'p',
    });
    await oracle.apply(intent.batch, []);
    expect(calls).toBeGreaterThan(0);
    expect(cache.getSnapshot().workspaces.map((w) => w.id)).toEqual(['ws-a', 'ws-new']);
    cache.dispose();
  });

  it('drops a workspace on removeExtensionWorkspace', async () => {
    const cache = createExtensionWorkspaceCache(
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      oracle,
      broadcast,
      ctxFactory,
    );
    await cache.seedFromPersistedState({
      workspaces: [ws({ id: 'ws-a' }), ws({ id: 'ws-b', sortIndex: 1, name: 'B' })],
      activeWorkspaceId: 'ws-a',
    });
    const intent = removeExtensionWorkspace(ctxFactory(), { id: 'ws-a' });
    await oracle.apply(intent.batch, []);
    expect(cache.getSnapshot().workspaces.map((w) => w.id)).toEqual(['ws-b']);
    cache.dispose();
  });

  it('flips activeWorkspaceId on setActiveExtensionWorkspace', async () => {
    const cache = createExtensionWorkspaceCache(
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      oracle,
      broadcast,
      ctxFactory,
    );
    await cache.seedFromPersistedState({
      workspaces: [ws({ id: 'ws-a' }), ws({ id: 'ws-b', sortIndex: 1, name: 'B' })],
      activeWorkspaceId: 'ws-a',
    });
    const intent = setActiveExtensionWorkspace(ctxFactory(), { id: 'ws-b' });
    await oracle.apply(intent.batch, []);
    expect(cache.getSnapshot().activeWorkspaceId).toBe('ws-b');
    cache.dispose();
  });

  it('dispose drops the broadcast subscription', async () => {
    const cache = createExtensionWorkspaceCache(
      EXTENSION_WORKSPACE_GLOBAL_SCOPE,
      oracle,
      broadcast,
      ctxFactory,
    );
    await cache.seedFromPersistedState({ workspaces: [], activeWorkspaceId: null });

    let calls = 0;
    cache.onChange(() => {
      calls++;
    });
    cache.dispose();

    const intent = setExtensionWorkspace(ctxFactory(), { slot: slot({ id: 'ws-new' }), orderKey: 'p' });
    await oracle.apply(intent.batch, []);
    expect(calls).toBe(0);
  });
});
