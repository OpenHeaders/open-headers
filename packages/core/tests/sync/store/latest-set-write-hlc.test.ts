/**
 * `InMemoryDocumentStore.latestSetWriteHlc` — the HLC of the latest
 * statement a set holds about an itemId, its winning add or its
 * tombstone. The live reads hide a tombstoned member; a catalog that
 * changed its member key reads this to learn that the new key has
 * spoken even when its last word was a remove.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutationEnvelope } from '../../../src/sync';

const env = (body: MutationEnvelope['body'], ms: number, mutationId: string): MutationEnvelope => ({
  mutationId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n' },
  origin: { surfaceId: 's', deviceId: 'd' },
  workspaceId: 'ws-1',
  orgId: 'org-test',
  mutatorVersion: 2,
  body,
});

const TYPE = 'pause-markers';
const ID = 'pause-markers';
const SET = 'markers';

const add = (itemId: string, ms: number, mutationId: string): MutationEnvelope =>
  env(
    { kind: 'addToSet', type: TYPE, id: ID, path: SET, itemId, item: { uid: itemId, marker: 'paused' } },
    ms,
    mutationId,
  );
const remove = (itemId: string, ms: number, mutationId: string): MutationEnvelope =>
  env({ kind: 'removeFromSet', type: TYPE, id: ID, path: SET, itemId }, ms, mutationId);

function storeWithShell(): InMemoryDocumentStore {
  const store = new InMemoryDocumentStore();
  store.apply(env({ kind: 'create', type: TYPE, id: ID, payload: {} }, 1, 'm-create'));
  return store;
}

describe('document store latestSetWriteHlc', () => {
  it('answers null for an unknown entity, an unknown set and a member the set never heard of', () => {
    const store = storeWithShell();
    expect(store.latestSetWriteHlc('other', 'x', SET, 'f')).toBeNull();
    expect(store.latestSetWriteHlc(TYPE, ID, 'elsewhere', 'f')).toBeNull();
    expect(store.latestSetWriteHlc(TYPE, ID, SET, 'f')).toBeNull();
  });

  it('answers the winning add of a live member', () => {
    const store = storeWithShell();
    store.apply(add('f', 10, 'm-a1'));
    store.apply(add('f', 20, 'm-a2'));
    expect(store.latestSetWriteHlc(TYPE, ID, SET, 'f')).toEqual({ physicalMs: 20, logical: 0, nodeId: 'n' });
    expect(store.liveSetItems(TYPE, ID, SET).map((e) => e.itemId)).toEqual(['f']);
  });

  it('answers the tombstone of a removed member the live reads hide', () => {
    const store = storeWithShell();
    store.apply(add('f', 10, 'm-a1'));
    store.apply(remove('f', 30, 'm-r1'));
    expect(store.liveSetItems(TYPE, ID, SET)).toEqual([]);
    expect(store.latestSetWriteHlc(TYPE, ID, SET, 'f')).toEqual({ physicalMs: 30, logical: 0, nodeId: 'n' });
  });

  it('answers the later of an add and a tombstone whatever order they applied in', () => {
    const store = storeWithShell();
    store.apply(remove('f', 30, 'm-r1'));
    store.apply(add('f', 40, 'm-a1'));
    expect(store.latestSetWriteHlc(TYPE, ID, SET, 'f')).toEqual({ physicalMs: 40, logical: 0, nodeId: 'n' });
    expect(store.liveSetItems(TYPE, ID, SET).map((e) => e.itemId)).toEqual(['f']);

    const reversed = storeWithShell();
    reversed.apply(add('f', 40, 'm-a1'));
    reversed.apply(remove('f', 30, 'm-r1'));
    expect(reversed.latestSetWriteHlc(TYPE, ID, SET, 'f')).toEqual({ physicalMs: 40, logical: 0, nodeId: 'n' });
  });

  it('answers a tombstone alone, for a member removed before any add this store saw', () => {
    const store = storeWithShell();
    store.apply(remove('f', 30, 'm-r1'));
    expect(store.latestSetWriteHlc(TYPE, ID, SET, 'f')).toEqual({ physicalMs: 30, logical: 0, nodeId: 'n' });
  });
});
