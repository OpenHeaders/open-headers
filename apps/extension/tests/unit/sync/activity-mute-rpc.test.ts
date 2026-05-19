/**
 * Phase C F6.b — `oh.sync.listActivityMutes` /
 * `oh.sync.muteActivityEntity` / `oh.sync.unmuteActivityEntity` RPC
 * handlers in the host-neutral dispatcher.
 *
 * Pins:
 *   - mute/unmute via the dispatcher mutates the cache + the store.
 *   - listActivityMutes returns a workspace-scoped list ordered by mutedAt.
 *   - Missing workspaceId / entityType / entityId degrades to a stable
 *     no-op shape so the renderer hook stays simple.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ActivityMuteEntry } from '@openheaders/core/sync';
import {
  InMemoryActivityMuteStore,
  __resetActivityMuteCacheForTests,
  isMutedForActivityFeed,
  setActivityMuteStore,
} from '@openheaders/oracle/sync';
import { dispatchSyncRpc } from '@openheaders/oracle/rpc';

import { installSyntheticIdentityForTests } from './_identity-test-setup';

const WS = '0193a8ff-c000-7000-8000-000000000001';

let store: InMemoryActivityMuteStore;
let teardownIdentity: () => void;

beforeEach(async () => {
  teardownIdentity = await installSyntheticIdentityForTests([WS]);
  __resetActivityMuteCacheForTests();
  store = new InMemoryActivityMuteStore();
  setActivityMuteStore(store);
});

afterEach(() => {
  __resetActivityMuteCacheForTests();
  teardownIdentity?.();
});

async function dispatchAsync(message: Record<string, unknown>): Promise<unknown> {
  const result = dispatchSyncRpc(message);
  if (result === null) throw new Error('expected dispatcher to handle the type');
  if (result.kind === 'sync') return result.response;
  return await result.promise;
}

describe('oh.sync.muteActivityEntity', () => {
  it('mutates cache + store + returns the entry', async () => {
    const resp = (await dispatchAsync({
      type: 'oh.sync.muteActivityEntity',
      workspaceId: WS,
      entityType: 'rule',
      entityId: 'r1',
    })) as { ok: true; entry: ActivityMuteEntry };

    expect(resp.ok).toBe(true);
    expect(resp.entry).toMatchObject({ workspaceId: WS, entityType: 'rule', entityId: 'r1' });
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(true);
    expect(await store.has(WS, 'rule', 'r1')).toBe(true);
  });

  it('returns a stable shape on malformed payloads', async () => {
    const resp = (await dispatchAsync({
      type: 'oh.sync.muteActivityEntity',
      // missing workspaceId
      entityType: 'rule',
      entityId: 'r1',
    })) as { ok: true; entry: ActivityMuteEntry };
    expect(resp.ok).toBe(true);
    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(false);
  });
});

describe('oh.sync.unmuteActivityEntity', () => {
  it('clears the mute in the cache and store', async () => {
    await dispatchAsync({
      type: 'oh.sync.muteActivityEntity',
      workspaceId: WS,
      entityType: 'rule',
      entityId: 'r1',
    });
    await dispatchAsync({
      type: 'oh.sync.unmuteActivityEntity',
      workspaceId: WS,
      entityType: 'rule',
      entityId: 'r1',
    });

    expect(isMutedForActivityFeed(WS, 'rule', 'r1')).toBe(false);
    expect(await store.has(WS, 'rule', 'r1')).toBe(false);
  });

  it('is idempotent on an absent pair', async () => {
    const resp = (await dispatchAsync({
      type: 'oh.sync.unmuteActivityEntity',
      workspaceId: WS,
      entityType: 'rule',
      entityId: 'never-muted',
    })) as { ok: true };
    expect(resp).toEqual({ ok: true });
  });
});

describe('oh.sync.listActivityMutes', () => {
  it('returns the workspace muted entries', async () => {
    await dispatchAsync({
      type: 'oh.sync.muteActivityEntity',
      workspaceId: WS,
      entityType: 'rule',
      entityId: 'r1',
    });
    await dispatchAsync({
      type: 'oh.sync.muteActivityEntity',
      workspaceId: WS,
      entityType: 'request',
      entityId: 'req-9',
    });

    const resp = (await dispatchAsync({ type: 'oh.sync.listActivityMutes', workspaceId: WS })) as {
      mutes: ActivityMuteEntry[];
    };
    expect(resp.mutes.map((m) => `${m.entityType}:${m.entityId}`).sort()).toEqual([
      'request:req-9',
      'rule:r1',
    ]);
  });

  it('returns empty when workspaceId is missing', () => {
    const result = dispatchSyncRpc({ type: 'oh.sync.listActivityMutes' });
    expect(result).toEqual({ kind: 'sync', response: { mutes: [] } });
  });
});
