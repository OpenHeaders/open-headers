/**
 * Inheritable settings round-trip — a container's `settings` is one
 * leaf per knob under `settings.<key>`. The seeds flatten the record;
 * `buildSet*SettingsBatch` writes per knob (`setField` / `unsetField`).
 * Pins:
 *   - seed + materialize round-trips the record on both containers;
 *   - a knob write lands beside the seeded knobs; a peer's concurrent
 *     knob edit survives it (per-leaf convergence);
 *   - clearing the last knob leaves the container transparent — the
 *     folder projection drops the record, the collection's reads empty;
 *   - an empty record never seeds a `settings` leaf, and a later knob
 *     write still lands;
 *   - a malformed knob never surfaces from the folder projection.
 */

import { describe, expect, it } from 'vitest';
import { hasInheritableSettings } from '../../src/schemas/inheritable-settings';
import { settingUpdatesBetween } from '../../src/settings-inheritance';
import { InMemoryDocumentStore, type MutationBatch, type MutatorContext } from '../../src/sync';
import { buildSetRequestCollectionSettingsBatch } from '../../src/sync-builders/mutations/request-collection-mutations';
import { buildSetRequestFolderSettingsBatch } from '../../src/sync-builders/mutations/request-folder-mutations';
import {
  projectRequestCollection,
  seedRequestCollection,
} from '../../src/sync-builders/projections/request-collection-projection';
import { projectRequestFolder, seedRequestFolder } from '../../src/sync-builders/projections/request-folder-projection';
import type { Collection, Folder } from '../../src/types';

const ctx = (physicalMs: number, nodeId = 'node-x'): MutatorContext => ({
  workspaceId: 'ws-1',
  orgId: 'org-test',
  hlc: { physicalMs, logical: 0, nodeId },
  surfaceId: 'workbench',
  deviceId: 'device-a',
});

function applyBatch(store: InMemoryDocumentStore, batch: MutationBatch): void {
  for (const env of batch.mutations) store.apply(env);
}

const collectionSeed: Collection = {
  schemaVersion: 5,
  uid: 'rc-1',
  path: 'requests/api-rc-1',
  name: 'API',
  variables: [],
  pinnedEnvironmentIds: [],
  defaultEnvironmentId: null,
  settings: { timeoutMs: 30_000, sslVerification: false },
};

const folderSeed: Folder = {
  schemaVersion: 5,
  uid: 'rf-1',
  path: 'requests/api-rc-1/auth-rf-1',
  name: 'Auth',
  settings: { timeoutMs: 5_000 },
};

function materializedCollection(store: InMemoryDocumentStore): Collection {
  const m = store.materializeOne('request-collection', 'rc-1');
  const c = m ? projectRequestCollection(m) : null;
  if (!c) throw new Error('collection did not materialize');
  return c;
}

function materializedFolder(store: InMemoryDocumentStore): Folder {
  const m = store.materializeOne('request-folder', 'rf-1');
  const f = m ? projectRequestFolder(m, 'requests/api-rc-1') : null;
  if (!f) throw new Error('folder did not materialize');
  return f;
}

describe('collection settings', () => {
  it('seed + materialize round-trips the record', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, seedRequestCollection(collectionSeed, ctx(1_000)));
    expect(materializedCollection(store).settings).toEqual({ timeoutMs: 30_000, sslVerification: false });
  });

  it('a knob write lands beside the seeded knobs; a peer knob edit survives it', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, seedRequestCollection(collectionSeed, ctx(1_000)));
    applyBatch(
      store,
      buildSetRequestCollectionSettingsBatch(
        { collectionUid: 'rc-1', updates: [{ key: 'cookieJar', value: true }] },
        ctx(2_000),
      ).batch,
    );
    applyBatch(
      store,
      buildSetRequestCollectionSettingsBatch(
        { collectionUid: 'rc-1', updates: [{ key: 'timeoutMs', value: 1_000 }] },
        ctx(2_000, 'node-y'),
      ).batch,
    );
    expect(materializedCollection(store).settings).toEqual({
      timeoutMs: 1_000,
      sslVerification: false,
      cookieJar: true,
    });
  });

  it('clearing the last knob leaves the collection transparent', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, seedRequestCollection(collectionSeed, ctx(1_000)));
    const updates = settingUpdatesBetween(collectionSeed.settings, {});
    expect(updates).toEqual([
      { key: 'sslVerification', value: undefined },
      { key: 'timeoutMs', value: undefined },
    ]);
    applyBatch(store, buildSetRequestCollectionSettingsBatch({ collectionUid: 'rc-1', updates }, ctx(2_000)).batch);
    expect(hasInheritableSettings(materializedCollection(store).settings)).toBe(false);
  });

  it('an empty record never seeds a leaf; a later knob write still lands', () => {
    const store = new InMemoryDocumentStore();
    const seed = seedRequestCollection({ ...collectionSeed, settings: {} }, ctx(1_000));
    const create = seed.mutations[0]?.body;
    expect(create?.kind === 'create' && 'settings' in (create.payload as Record<string, unknown>)).toBe(false);
    applyBatch(store, seed);
    expect(materializedCollection(store).settings).toBeUndefined();
    applyBatch(
      store,
      buildSetRequestCollectionSettingsBatch(
        { collectionUid: 'rc-1', updates: [{ key: 'timeoutMs', value: 2_000 }] },
        ctx(2_000),
      ).batch,
    );
    expect(materializedCollection(store).settings).toEqual({ timeoutMs: 2_000 });
  });
});

describe('folder settings', () => {
  it('seed + materialize round-trips the record', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, seedRequestFolder(folderSeed, ctx(1_000)));
    expect(materializedFolder(store).settings).toEqual({ timeoutMs: 5_000 });
  });

  it('a knob write lands; clearing the last knob drops the record from the projection', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, seedRequestFolder(folderSeed, ctx(1_000)));
    applyBatch(
      store,
      buildSetRequestFolderSettingsBatch(
        { folderUid: 'rf-1', updates: [{ key: 'proxyMode', value: 'direct' }] },
        ctx(2_000),
      ).batch,
    );
    expect(materializedFolder(store).settings).toEqual({ timeoutMs: 5_000, proxyMode: 'direct' });
    applyBatch(
      store,
      buildSetRequestFolderSettingsBatch(
        {
          folderUid: 'rf-1',
          updates: [
            { key: 'timeoutMs', value: undefined },
            { key: 'proxyMode', value: undefined },
          ],
        },
        ctx(3_000),
      ).batch,
    );
    expect(materializedFolder(store).settings).toBeUndefined();
  });

  it('an empty record never seeds; a malformed knob never surfaces', () => {
    const store = new InMemoryDocumentStore();
    applyBatch(store, seedRequestFolder({ ...folderSeed, settings: {} }, ctx(1_000)));
    expect(materializedFolder(store).settings).toBeUndefined();
    // A peer's out-of-bound leaf (an older schema, a hand-edited file)
    // composes into the record; the projection stays fail-soft.
    store.apply({
      ...seedRequestFolder(folderSeed, ctx(2_000)).mutations[0],
      body: { kind: 'setField', type: 'request-folder', id: 'rf-1', path: 'settings.timeoutMs', value: 'soon' },
    });
    expect(materializedFolder(store).settings).toBeUndefined();
  });
});
