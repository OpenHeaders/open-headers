/**
 * Auth pool round-trip — a container's pool is set members at `auths`
 * plus the `defaultAuthUid` scalar. `seedRequestCollection` /
 * `seedRequestFolder` fan the entries out as `addToSet`; the pool
 * replacement (`buildSet*AuthPoolBatch`) converges entries by uid,
 * moves the default scalar, and retires the pre-pool single `auth`
 * field's leaves in the same batch. Pins:
 *   - seed + materialize round-trips entries and default, in order;
 *   - a default switch is one scalar write; a config edit keeps the uid;
 *   - dropping the default entry with no default = transparent;
 *   - the legacy `auth` field reads as a one-entry pool and is
 *     tombstoned by the first pool write;
 *   - a no-op edit yields an empty batch;
 *   - a malformed pool member never surfaces from the folder projection.
 */

import { describe, expect, it } from 'vitest';
import { authPoolOf, defaultAuthEntry, LEGACY_AUTH_ENTRY_UID } from '../../src/auth-inheritance';
import { InMemoryDocumentStore, type MutatorContext } from '../../src/sync';
import {
  buildSetRequestCollectionAuthPoolBatch,
  type RequestCollectionMutationPayload,
} from '../../src/sync-builders/mutations/request-collection-mutations';
import { buildSetRequestFolderAuthPoolBatch } from '../../src/sync-builders/mutations/request-folder-mutations';
import {
  projectRequestCollection,
  seedRequestCollection,
} from '../../src/sync-builders/projections/request-collection-projection';
import { projectRequestFolder, seedRequestFolder } from '../../src/sync-builders/projections/request-folder-projection';
import type { AuthPoolEntry, Collection, Folder } from '../../src/types';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function applyBatch(store: InMemoryDocumentStore, payload: RequestCollectionMutationPayload): void {
  for (const env of payload.batch.mutations) store.apply(env);
}

const ADMIN: AuthPoolEntry = { uid: 'auth0001', name: 'Admin token', config: { type: 'bearer', token: '{{admin}}' } };
const USER: AuthPoolEntry = { uid: 'auth0002', name: 'User token', config: { type: 'bearer', token: '{{user}}' } };

const collectionSeed: Collection = {
  schemaVersion: 5,
  uid: 'rc-1',
  path: 'requests/auth-rc-1',
  name: 'Auth',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
  auths: [ADMIN, USER],
  defaultAuthUid: 'auth0002',
};

const folderSeed: Folder = {
  schemaVersion: 5,
  uid: 'rf-1',
  path: 'requests/auth-rc-1/tokens-rf-1',
  name: 'Tokens',
  auths: [{ uid: 'auth0003', name: '', config: { type: 'basic', username: 'svc', password: 'secret' } }],
  defaultAuthUid: 'auth0003',
};

function materializedCollection(store: InMemoryDocumentStore): Collection {
  const m = store.materializeOne('request-collection', 'rc-1');
  const c = m ? projectRequestCollection(m) : null;
  if (!c) throw new Error('collection did not materialize');
  return c;
}

function materializedFolder(store: InMemoryDocumentStore): Folder {
  const m = store.materializeOne('request-folder', 'rf-1');
  const f = m ? projectRequestFolder(m, 'requests/auth-rc-1') : null;
  if (!f) throw new Error('folder did not materialize');
  return f;
}

/** The live per-uid order keys — what the write client reads off the mirror. */
function currentKeys(store: InMemoryDocumentStore, type: string, uid: string): Map<string, string> {
  return new Map(store.liveOrderedSetItems(type, uid, 'auths').map((e) => [e.itemId, e.key] as const));
}

function poolInput(
  store: InMemoryDocumentStore,
  auths: AuthPoolEntry[],
  defaultAuthUid: string | undefined,
): Parameters<typeof buildSetRequestCollectionAuthPoolBatch>[0] {
  return {
    collectionUid: 'rc-1',
    auths,
    defaultAuthUid,
    current: materializedCollection(store),
    currentKeys: currentKeys(store, 'request-collection', 'rc-1'),
  };
}

function setCollectionPool(
  store: InMemoryDocumentStore,
  auths: AuthPoolEntry[],
  defaultAuthUid: string | undefined,
  at: number,
): RequestCollectionMutationPayload {
  const payload = buildSetRequestCollectionAuthPoolBatch(poolInput(store, auths, defaultAuthUid), ctx(at));
  applyBatch(store, payload);
  return payload;
}

describe('auth pool round-trip (request-collection)', () => {
  it('seeds the pool as set members and materializes entries + default back in order', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const seeded = store.materializeOne('request-collection', 'rc-1');
    if (!seeded) throw new Error('collection did not materialize');
    expect((seeded.data as { auths?: unknown }).auths).toEqual([ADMIN, USER]);
    const collection = materializedCollection(store);
    expect(collection.auths).toEqual([ADMIN, USER]);
    expect(collection.defaultAuthUid).toBe('auth0002');
    expect(defaultAuthEntry(collection)).toEqual(USER);
  });

  it('switching the default is one scalar write; the entries emit nothing', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const payload = setCollectionPool(store, [ADMIN, USER], 'auth0001', 2_000);
    expect(payload.batch.mutations.map((m) => m.body.kind)).toEqual(['setField']);
    expect(defaultAuthEntry(materializedCollection(store))).toEqual(ADMIN);
  });

  it('editing an entry keeps its uid and converges the record', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const edited: AuthPoolEntry = { ...USER, config: { type: 'basic', username: 'u', password: 'p' } };
    setCollectionPool(store, [ADMIN, edited], 'auth0002', 2_000);
    expect(materializedCollection(store).auths).toEqual([ADMIN, edited]);
  });

  it('dropping the default entry with no default leaves the named entries and the level transparent', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    setCollectionPool(store, [ADMIN], undefined, 2_000);
    const collection = materializedCollection(store);
    expect(collection.auths).toEqual([ADMIN]);
    expect(collection.defaultAuthUid).toBeUndefined();
    // The reader's rule: no explicit default → the first entry.
    expect(defaultAuthEntry(collection)).toEqual(ADMIN);
    setCollectionPool(store, [], undefined, 3_000);
    expect(authPoolOf(materializedCollection(store))).toBeNull();
  });

  it('a default naming no surviving entry persists absent', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    setCollectionPool(store, [ADMIN], 'auth0002', 2_000);
    expect(materializedCollection(store).defaultAuthUid).toBeUndefined();
  });

  it('a no-op edit yields an empty batch', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const payload = buildSetRequestCollectionAuthPoolBatch(poolInput(store, [ADMIN, USER], 'auth0002'), ctx(2_000));
    expect(payload.batch.mutations).toHaveLength(0);
  });

  it('the pre-pool `auth` field reads as a one-entry pool and the first pool write retires it', () => {
    const store = new InMemoryDocumentStore();
    const { auths: _a, defaultAuthUid: _d, ...bare } = collectionSeed;
    const legacy: Collection = { ...bare, auth: { type: 'bearer', token: '{{auth_token}}' } };
    applyBatch(store, { batch: seedRequestCollection(legacy, ctx(1_000)), sideEffects: [] });
    const before = materializedCollection(store);
    expect(before.auth).toEqual({ type: 'bearer', token: '{{auth_token}}' });
    expect(authPoolOf(before)).toEqual({
      entries: [{ uid: LEGACY_AUTH_ENTRY_UID, name: '', config: { type: 'bearer', token: '{{auth_token}}' } }],
      defaultUid: LEGACY_AUTH_ENTRY_UID,
    });
    const payload = setCollectionPool(store, [ADMIN], 'auth0001', 2_000);
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'unsetField' ? m.body.path : m.body.kind));
    expect(paths).toEqual(expect.arrayContaining(['auth.type', 'auth.token']));
    const after = materializedCollection(store);
    expect(after.auth).toBeUndefined();
    expect(after.auths).toEqual([ADMIN]);
  });
});

describe('auth pool round-trip (request-folder)', () => {
  it('seeds a folder pool and materializes it back', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestFolder(folderSeed, ctx(1_000)), sideEffects: [] });
    const folder = materializedFolder(store);
    expect(folder.auths).toEqual(folderSeed.auths);
    expect(folder.defaultAuthUid).toBe('auth0003');
  });

  it('replaces the pool and clears the default — the folder goes transparent', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestFolder(folderSeed, ctx(1_000)), sideEffects: [] });
    applyBatch(
      store,
      buildSetRequestFolderAuthPoolBatch(
        {
          folderUid: 'rf-1',
          auths: [],
          defaultAuthUid: undefined,
          current: materializedFolder(store),
          currentKeys: currentKeys(store, 'request-folder', 'rf-1'),
        },
        ctx(2_000),
      ),
    );
    const folder = materializedFolder(store);
    expect(folder.auths).toBeUndefined();
    expect(folder.defaultAuthUid).toBeUndefined();
    expect(authPoolOf(folder)).toBeNull();
  });

  it('drops a malformed pool member at projection instead of surfacing it', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestFolder(folderSeed, ctx(1_000)), sideEffects: [] });
    store.apply({
      mutationId: 'mut-partial',
      hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
      origin: { surfaceId: 'workbench', deviceId: 'device-a', userId: undefined },
      workspaceId: 'ws-1',
      orgId: 'org-test',
      mutatorVersion: 1,
      body: {
        kind: 'addToSet',
        type: 'request-folder',
        id: 'rf-1',
        path: 'auths',
        itemId: 'auth0009',
        item: { uid: 'auth0009', name: 'broken' },
      },
    });
    expect(materializedFolder(store).auths).toEqual(folderSeed.auths);
  });
});
