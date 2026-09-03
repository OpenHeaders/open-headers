/**
 * The request-folder cache's persistence sink — the slot the renderer
 * mirrors read (`oh.ws.<id>.requestFolders`) carries the PROJECTED
 * folders whole: a request folder's ancestor fields (the inheritable
 * settings, the auth pool, the script slots) ride it beside the
 * identity fields. A slot trimmed to the identity fields left every
 * container editor blind to what its folder carried — the settings
 * inheritance S5 finding. Pins:
 *   - a local settings write on a folder republishes the slot with
 *     the kind's slice;
 *   - a folder's pool and script slot ride the slot too;
 *   - a cleared knob leaves the slot.
 */

import { type HostStorage, type StorageKey, setHostStorage, wsKeys } from '@openheaders/core/storage';
import {
  InMemoryDocumentStore,
  type MutationEnvelope,
  type MutatorContext,
  mintBatch,
  requestFolderChild,
} from '@openheaders/core/sync';
import { buildSetRequestFolderSettingsBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import { seedRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { seedRequestFolder } from '@openheaders/core/sync-builders/projections/request-folder-projection';
import type { Collection, Folder } from '@openheaders/core/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import { createRequestFolderCache, type RequestFolderCache } from '../../src/sync/caches/request-folder-cache';
import { buildLocalWriteValidator, buildSchemaRegistry, WORKSPACE_REGISTRY } from '../../src/sync/entity-registry';
import { InMemoryMutationLog } from '../../src/sync/mutation-log';
import { EntityOracle } from '../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../src/sync/pending-intents';

let clock = 1_000;
const ctx = (): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs: clock++, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function createHostStorageFake(): HostStorage & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T>(spec: StorageKey<T>): Promise<T | undefined> {
      return store.get(spec.key) as T | undefined;
    },
    async getMany() {
      throw new Error('unused');
    },
    async set<T>(spec: StorageKey<T>, value: T): Promise<void> {
      store.set(spec.key, value);
    },
    async remove<T>(spec: StorageKey<T>): Promise<void> {
      store.delete(spec.key);
    },
    subscribe() {
      return () => {};
    },
    async getValidated() {
      throw new Error('unused');
    },
    async getManyValidated() {
      throw new Error('unused');
    },
  } as unknown as HostStorage & { store: Map<string, unknown> };
}

const collection: Collection = {
  schemaVersion: 5,
  uid: 'col00001',
  path: 'requests/api-col00001',
  name: 'API',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
};

const folder: Folder = {
  schemaVersion: 5,
  uid: 'fld00001',
  path: 'requests/api-col00001/auth-fld00001',
  name: 'Auth',
  preRequestScript: 'oh.setHeader("x-e2e", "1")',
  auths: [{ uid: 'auth0001', name: 'Admin', config: { type: 'bearer', token: 'tok' } }],
  defaultAuthUid: 'auth0001',
};

function applyAll(store: InMemoryDocumentStore, envelopes: readonly MutationEnvelope[]): void {
  for (const env of envelopes) store.apply(env);
}

let storage: ReturnType<typeof createHostStorageFake>;
let oracle: EntityOracle;
let cache: RequestFolderCache;

const slot = (): Folder[] => (storage.store.get(wsKeys('ws-1').requestFolders.key) as Folder[] | undefined) ?? [];
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(async () => {
  storage = createHostStorageFake();
  setHostStorage(storage);
  const store = new InMemoryDocumentStore(buildSchemaRegistry(WORKSPACE_REGISTRY));
  applyAll(store, seedRequestCollection(collection, ctx()).mutations);
  applyAll(store, seedRequestFolder(folder, ctx()).mutations);
  applyAll(
    store,
    mintBatch(ctx(), [requestFolderChild.slotAdd(folder.uid, { type: 'request-collection', uid: collection.uid })])
      .mutations,
  );
  const broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock: async (_ws, _type, _id, fn) => fn(),
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
    store,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
    validateLocalWrite: buildLocalWriteValidator(WORKSPACE_REGISTRY),
  });
  cache = createRequestFolderCache('ws-1', oracle, broadcast, ctx);
});

afterEach(() => {
  cache.dispose();
});

describe('the request-folder slot carries the projected folders whole', () => {
  it('a local settings write republishes the slot with the kind’s slice beside the pool and the script slot', async () => {
    const result = await oracle.apply(
      buildSetRequestFolderSettingsBatch(
        { folderUid: folder.uid, updates: [{ kind: 'http', key: 'tlsMaxVersion', value: '1.2' }] },
        ctx(),
      ).batch,
      [],
      'local',
    );
    expect(result.failure?.detail).toBeUndefined();
    await settle();
    expect(cache.getRequestFolders()[0]?.settings).toEqual({ http: { tlsMaxVersion: '1.2' } });
    const persisted = slot();
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      uid: folder.uid,
      path: folder.path,
      name: folder.name,
      preRequestScript: folder.preRequestScript,
      auths: folder.auths,
      defaultAuthUid: folder.defaultAuthUid,
      settings: { http: { tlsMaxVersion: '1.2' } },
    });
  });

  it('a cleared knob leaves the slot', async () => {
    await oracle.apply(
      buildSetRequestFolderSettingsBatch(
        { folderUid: folder.uid, updates: [{ kind: 'http', key: 'tlsMaxVersion', value: '1.2' }] },
        ctx(),
      ).batch,
      [],
      'local',
    );
    await oracle.apply(
      buildSetRequestFolderSettingsBatch(
        { folderUid: folder.uid, updates: [{ kind: 'http', key: 'tlsMaxVersion', value: undefined }] },
        ctx(),
      ).batch,
      [],
      'local',
    );
    await settle();
    expect(slot()[0]?.settings).toBeUndefined();
  });
});
