/**
 * `InMemoryDocumentStore.evictSetItem` / `.forgetMutations` — the
 * backend-eviction surgery (multi-backend Discard). The load-bearing
 * contrast with `removeFromSet`: a tombstone outranks any older add
 * forever (delete-wins, §7.2), while an evicted item re-materializes
 * when the ORIGINAL `addToSet` envelope — same mutationId, same old
 * HLC — replays on a re-join.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutationEnvelope } from '../../../src/sync';

const env = (body: MutationEnvelope['body'], ms: number, mutationId: string): MutationEnvelope => ({
  mutationId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'daemon-node' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: '__global__',
  orgId: 'org-daemon',
  mutatorVersion: 1,
  body,
});

const SLOT = { id: 'ws-1', name: 'API openheaders.io' };

const addSlot = (mutationId = 'm-add', ms = 1_000): MutationEnvelope =>
  env(
    {
      kind: 'addToSet',
      type: 'extensionWorkspace',
      id: 'singleton',
      path: 'workspaces',
      itemId: 'ws-1',
      item: SLOT,
      orderKey: 'a0',
    },
    ms,
    mutationId,
  );

function storeWithSlot(): InMemoryDocumentStore {
  const store = new InMemoryDocumentStore();
  store.apply(env({ kind: 'create', type: 'extensionWorkspace', id: 'singleton', payload: {} }, 500, 'm-create'));
  store.apply(addSlot());
  return store;
}

const liveIds = (store: InMemoryDocumentStore): string[] =>
  store.liveSetItems('extensionWorkspace', 'singleton', 'workspaces').map((e) => e.itemId);

describe('document store evictSetItem / forgetMutations', () => {
  it('evicts the live entry without a tombstone — the original older add re-applies', () => {
    const store = storeWithSlot();
    expect(liveIds(store)).toEqual(['ws-1']);

    expect(store.evictSetItem('extensionWorkspace', 'singleton', 'workspaces', 'ws-1')).toBe(true);
    expect(liveIds(store)).toEqual([]);

    // Re-join replays the SAME envelope: forget its dedup id first,
    // then the old-HLC add must re-materialize the item (a tombstone
    // would have swallowed it forever).
    store.forgetMutations(['m-add']);
    expect(store.apply(addSlot()).status).toBe('applied');
    expect(liveIds(store)).toEqual(['ws-1']);
  });

  it('contrast: removeFromSet leaves a tombstone that outranks the replayed older add', () => {
    const store = storeWithSlot();
    store.apply(
      env(
        { kind: 'removeFromSet', type: 'extensionWorkspace', id: 'singleton', path: 'workspaces', itemId: 'ws-1' },
        2_000,
        'm-rm',
      ),
    );
    expect(liveIds(store)).toEqual([]);

    store.forgetMutations(['m-add']);
    store.apply(addSlot());
    expect(liveIds(store)).toEqual([]);
  });

  it('evicting also clears an existing tombstone for the itemId', () => {
    const store = storeWithSlot();
    store.apply(
      env(
        { kind: 'removeFromSet', type: 'extensionWorkspace', id: 'singleton', path: 'workspaces', itemId: 'ws-1' },
        2_000,
        'm-rm',
      ),
    );
    expect(store.evictSetItem('extensionWorkspace', 'singleton', 'workspaces', 'ws-1')).toBe(true);

    store.forgetMutations(['m-add']);
    store.apply(addSlot());
    expect(liveIds(store)).toEqual(['ws-1']);
  });

  it('is a no-op on unknown entities and absent itemIds', () => {
    const store = storeWithSlot();
    expect(store.evictSetItem('extensionWorkspace', 'other', 'workspaces', 'ws-1')).toBe(false);
    expect(store.evictSetItem('extensionWorkspace', 'singleton', 'workspaces', 'ws-absent')).toBe(false);
    expect(liveIds(store)).toEqual(['ws-1']);
  });

  it('duplicate protection stands until the id is forgotten', () => {
    const store = storeWithSlot();
    store.evictSetItem('extensionWorkspace', 'singleton', 'workspaces', 'ws-1');
    expect(store.apply(addSlot()).status).toBe('duplicate');
    expect(liveIds(store)).toEqual([]);
  });
});
