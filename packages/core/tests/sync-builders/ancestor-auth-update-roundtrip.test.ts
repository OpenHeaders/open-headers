/**
 * Ancestor default auth (D2) — collection/folder `auth` edits must
 * mirror create's per-leaf granularity. `seedRequestCollection` /
 * `seedRequestFolder` flatten the shell (including a seeded `auth`) to
 * per-leaf field paths, so `buildSetRequestCollectionAuthBatch` /
 * `buildSetRequestFolderAuthBatch` route through `synthesizeFieldDiff`
 * — same trap `request-auth-body-update-roundtrip.test.ts` covers for
 * request auth. Clearing the field entirely (level goes transparent)
 * must tombstone every auth leaf.
 */

import { describe, expect, it } from 'vitest';
import { InMemoryDocumentStore, type MutatorContext } from '../../src/sync';
import {
  buildSetRequestCollectionAuthBatch,
  type RequestCollectionMutationPayload,
} from '../../src/sync-builders/mutations/request-collection-mutations';
import { buildSetRequestFolderAuthBatch } from '../../src/sync-builders/mutations/request-folder-mutations';
import {
  projectRequestCollection,
  seedRequestCollection,
} from '../../src/sync-builders/projections/request-collection-projection';
import { projectRequestFolder, seedRequestFolder } from '../../src/sync-builders/projections/request-folder-projection';
import type { AuthConfig, Collection, Folder } from '../../src/types';

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

const collectionSeed: Collection = {
  schemaVersion: 5,
  uid: 'rc-1',
  path: 'requests/auth-rc-1',
  name: 'Auth',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
  auth: { type: 'bearer', token: '{{auth_token}}' },
};

const folderSeed: Folder = {
  schemaVersion: 5,
  uid: 'rf-1',
  path: 'requests/auth-rc-1/tokens-rf-1',
  name: 'Tokens',
  auth: { type: 'basic', username: 'svc', password: 'secret' },
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

function setCollectionAuth(store: InMemoryDocumentStore, auth: AuthConfig | undefined, at: number): void {
  applyBatch(
    store,
    buildSetRequestCollectionAuthBatch(
      { collectionUid: 'rc-1', auth, currentAuth: materializedCollection(store).auth },
      ctx(at),
    ),
  );
}

function setFolderAuth(store: InMemoryDocumentStore, auth: AuthConfig | undefined, at: number): void {
  applyBatch(
    store,
    buildSetRequestFolderAuthBatch({ folderUid: 'rf-1', auth, currentAuth: materializedFolder(store).auth }, ctx(at)),
  );
}

describe('ancestor auth update round-trip (request-collection)', () => {
  it('seeds a collection with auth and materializes it back', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    expect(materializedCollection(store).auth).toEqual({ type: 'bearer', token: '{{auth_token}}' });
  });

  it('persists a bearer → basic variant switch instead of reverting to the seed type', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const basic: AuthConfig = { type: 'basic', username: 'u', password: 'p' };
    setCollectionAuth(store, basic, 2_000);
    expect(materializedCollection(store).auth).toEqual(basic);
  });

  it('emits a per-leaf diff, not a whole-object setField at `auth`', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const payload = buildSetRequestCollectionAuthBatch(
      {
        collectionUid: 'rc-1',
        auth: { type: 'basic', username: 'u', password: 'p' },
        currentAuth: materializedCollection(store).auth,
      },
      ctx(2_000),
    );
    const paths = payload.batch.mutations.map((m) => (m.body.kind === 'setField' ? m.body.path : m.body.kind));
    expect(paths).not.toContain('auth');
    expect(paths).toEqual(expect.arrayContaining(['auth.type', 'auth.username', 'auth.password']));
  });

  it('clears the field entirely (transparent level) — every auth leaf tombstones', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    setCollectionAuth(store, undefined, 2_000);
    expect(materializedCollection(store).auth).toBeUndefined();
  });

  it('sets auth on a collection seeded without one', () => {
    const store = new InMemoryDocumentStore();
    const { auth: _omitted, ...bare } = collectionSeed;
    applyBatch(store, { batch: seedRequestCollection(bare, ctx(1_000)), sideEffects: [] });
    expect(materializedCollection(store).auth).toBeUndefined();
    setCollectionAuth(store, { type: 'none' }, 2_000);
    expect(materializedCollection(store).auth).toEqual({ type: 'none' });
  });

  it('a no-op edit yields an empty batch', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestCollection(collectionSeed, ctx(1_000)), sideEffects: [] });
    const payload = buildSetRequestCollectionAuthBatch(
      { collectionUid: 'rc-1', auth: collectionSeed.auth, currentAuth: materializedCollection(store).auth },
      ctx(2_000),
    );
    expect(payload.batch.mutations).toHaveLength(0);
  });
});

describe('ancestor auth update round-trip (request-folder)', () => {
  it('seeds a folder with auth and materializes it back', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestFolder(folderSeed, ctx(1_000)), sideEffects: [] });
    expect(materializedFolder(store).auth).toEqual({ type: 'basic', username: 'svc', password: 'secret' });
  });

  it('persists a basic → api-key switch and tombstones the basic-only leaves', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestFolder(folderSeed, ctx(1_000)), sideEffects: [] });
    const apiKey: AuthConfig = { type: 'api-key', key: 'X-Key', value: 'v', in: 'header' };
    setFolderAuth(store, apiKey, 2_000);
    expect(materializedFolder(store).auth).toEqual(apiKey);
  });

  it('clears the field entirely — the folder goes transparent', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, { batch: seedRequestFolder(folderSeed, ctx(1_000)), sideEffects: [] });
    setFolderAuth(store, undefined, 2_000);
    expect(materializedFolder(store).auth).toBeUndefined();
  });

  it('drops a malformed materialized auth at projection instead of surfacing it', () => {
    const store = new InMemoryDocumentStore();
    const { auth: _omitted, ...bare } = folderSeed;
    applyBatch(store, { batch: seedRequestFolder(bare, ctx(1_000)), sideEffects: [] });
    // A transient per-leaf compose can hold an incomplete variant —
    // write only `auth.type` for a variant whose other leaves are
    // required, and the projection must stay fail-soft.
    store.apply({
      mutationId: 'mut-partial',
      hlc: { physicalMs: 2_000, logical: 0, nodeId: 'node-x' },
      origin: { surfaceId: 'workbench', deviceId: 'device-a', userId: undefined },
      workspaceId: 'ws-1',
      orgId: 'org-test',
      mutatorVersion: 1,
      body: { kind: 'setField', type: 'request-folder', id: 'rf-1', path: 'auth.type', value: 'basic' },
    });
    expect(materializedFolder(store).auth).toBeUndefined();
  });
});
