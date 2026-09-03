/**
 * A container's inheritable settings through the REAL oracle apply
 * path — the local-write gate and the projection the mirrors read.
 * Pins, per container kind:
 *   - a knob write on a kind's slice (`settings.<kind>.<key>`) passes
 *     the gate and projects onto the container;
 *   - a second kind's knob lands beside it; a cleared knob leaves;
 *   - a malformed knob is refused by name.
 */

import type { MutatorContext } from '@openheaders/core/sync';
import { buildSetRequestCollectionSettingsBatch } from '@openheaders/core/sync-builders/mutations/request-collection-mutations';
import { buildSetRequestFolderSettingsBatch } from '@openheaders/core/sync-builders/mutations/request-folder-mutations';
import {
  projectRequestCollection,
  seedRequestCollection,
} from '@openheaders/core/sync-builders/projections/request-collection-projection';
import {
  projectRequestFolder,
  seedRequestFolder,
} from '@openheaders/core/sync-builders/projections/request-folder-projection';
import type { Collection, Folder } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '../../src/sync/broadcast';
import { buildLocalWriteValidator, buildSchemaRegistry, WORKSPACE_REGISTRY } from '../../src/sync/entity-registry';
import { InMemoryMutationLog } from '../../src/sync/mutation-log';
import { EntityOracle } from '../../src/sync/oracle';
import { InMemoryPendingIntents } from '../../src/sync/pending-intents';

const ctx = (physicalMs: number): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId: 'node-x' },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function makeOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: 'ws-1',
    lock: async (_ws, _type, _id, fn) => fn(),
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
    validateLocalWrite: buildLocalWriteValidator(WORKSPACE_REGISTRY),
  });
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
};

function folderOf(oracle: EntityOracle): Folder {
  const m = oracle.materializeOne('request-folder', folder.uid);
  const f = m ? projectRequestFolder(m, collection.path) : null;
  if (!f) throw new Error('folder did not materialize');
  return f;
}

function collectionOf(oracle: EntityOracle): Collection {
  const m = oracle.materializeOne('request-collection', collection.uid);
  const c = m ? projectRequestCollection(m) : null;
  if (!c) throw new Error('collection did not materialize');
  return c;
}

describe('a request folder’s settings through the gate', () => {
  it('a knob write on the HTTP slice passes the gate and projects; a second kind lands beside it; a cleared knob leaves', async () => {
    const oracle = makeOracle();
    expect((await oracle.apply(seedRequestFolder(folder, ctx(1_000)), [], 'local')).ok).toBe(true);
    const first = await oracle.apply(
      buildSetRequestFolderSettingsBatch(
        { folderUid: folder.uid, updates: [{ kind: 'http', key: 'tlsMaxVersion', value: '1.2' }] },
        ctx(2_000),
      ).batch,
      [],
      'local',
    );
    expect(first.failure?.detail).toBeUndefined();
    expect(first.ok).toBe(true);
    expect(folderOf(oracle).settings).toEqual({ http: { tlsMaxVersion: '1.2' } });

    const second = await oracle.apply(
      buildSetRequestFolderSettingsBatch(
        {
          folderUid: folder.uid,
          updates: [
            { kind: 'websocket', key: 'timeoutMs', value: 5_000 },
            { kind: 'http', key: 'tlsMaxVersion', value: undefined },
          ],
        },
        ctx(3_000),
      ).batch,
      [],
      'local',
    );
    expect(second.failure?.detail).toBeUndefined();
    expect(folderOf(oracle).settings).toEqual({ websocket: { timeoutMs: 5_000 } });
  });

  it('a malformed knob is refused by name', async () => {
    const oracle = makeOracle();
    await oracle.apply(seedRequestFolder(folder, ctx(1_000)), [], 'local');
    const result = await oracle.apply(
      buildSetRequestFolderSettingsBatch(
        { folderUid: folder.uid, updates: [{ kind: 'http', key: 'timeoutMs', value: 1 }] },
        ctx(2_000),
      ).batch,
      [],
      'local',
    );
    expect(result.ok).toBe(false);
    expect(result.failure?.status).toBe('schema-rejected');
    expect(result.failure?.detail).toMatch(/timeoutMs/);
    expect(folderOf(oracle).settings).toBeUndefined();
  });
});

describe('a request collection’s settings through the gate', () => {
  it('a knob write on a kind’s slice passes the gate and projects', async () => {
    const oracle = makeOracle();
    expect((await oracle.apply(seedRequestCollection(collection, ctx(1_000)), [], 'local')).ok).toBe(true);
    const result = await oracle.apply(
      buildSetRequestCollectionSettingsBatch(
        { collectionUid: collection.uid, updates: [{ kind: 'grpc', key: 'timeoutMs', value: 2_000 }] },
        ctx(2_000),
      ).batch,
      [],
      'local',
    );
    expect(result.failure?.detail).toBeUndefined();
    expect(collectionOf(oracle).settings).toEqual({ grpc: { timeoutMs: 2_000 } });
  });
});
