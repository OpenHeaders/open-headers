/**
 * Phase B Folder — projector reads cross-entity oracle state to
 * reconstruct V5.Folder.path via parent walk. Returns null for
 * non-folder envelopes / tombstoned folders / folders whose parent
 * linkage hasn't seeded yet.
 */

import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  FOLDER_ENTITY_TYPE,
  mintBatch,
  type MutationEnvelope,
  type MutatorContext,
  renameFolder,
  RULE_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import {
  projectAllFolders,
  projectFolderByUid,
  projectFolderPostState,
} from '@/background/sync/folder-post-state';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { seedCollection } from '@/shared/sync/collection-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeCollection = (uid: string): V5.Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: 'auth',
    path: `rules/auth-${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as V5.Collection;

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
  });
}

describe('projectFolderPostState', () => {
  it('reconstructs path via parent collection walk', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-1');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    const intent = createFolder(ctx(2), {
      folderUid: 'fold-a',
      parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
      name: 'Login',
    });
    const result = await oracle.apply(intent.batch, []);
    expect(result.ok).toBe(true);

    const envelope = intent.batch.mutations[0];
    const post = projectFolderPostState(oracle, envelope);
    expect(post).not.toBeNull();
    expect(post?.folder).toMatchObject({
      schemaVersion: 5,
      uid: 'fold-a',
      name: 'Login',
      path: `rules/auth-col-1/login-fold-a`,
    });
  });

  it('walks nested folder parents', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-2');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    const root = createFolder(ctx(2), {
      folderUid: 'fold-root',
      parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
      name: 'API',
    });
    await oracle.apply(root.batch, []);
    const leaf = createFolder(ctx(3), {
      folderUid: 'fold-leaf',
      parent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-root' },
      name: 'v2',
    });
    await oracle.apply(leaf.batch, []);

    const post = projectFolderByUid(oracle, 'fold-leaf');
    expect(post?.folder.path).toBe('rules/auth-col-2/api-fold-root/v2-fold-leaf');
  });

  it('preserves persisted pathSegment across rename (legacy invariant)', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-3');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'f-x',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Original',
      }).batch,
      [],
    );
    await oracle.apply(renameFolder(ctx(3), { folderUid: 'f-x', name: 'Renamed' }).batch, []);

    const post = projectFolderByUid(oracle, 'f-x');
    expect(post?.folder.name).toBe('Renamed');
    expect(post?.folder.path).toBe('rules/auth-col-3/original-f-x');
  });

  it('returns null for non-Folder envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r', path: 'name', value: 'x' },
    };
    expect(projectFolderPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null for tombstoned folders', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-4');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'f-del',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Doomed',
      }).batch,
      [],
    );
    const tomb = mintBatch(ctx(3), [{ kind: 'delete', type: FOLDER_ENTITY_TYPE, id: 'f-del' }]);
    await oracle.apply(tomb, []);
    expect(projectFolderByUid(oracle, 'f-del')).toBeNull();
  });

  it('returns null when parent slot is missing', async () => {
    const oracle = newOracle();
    // Mint a bare folder entity without any parent slot.
    const orphan = mintBatch(ctx(1), [
      {
        kind: 'create',
        type: FOLDER_ENTITY_TYPE,
        id: 'orphan',
        payload: { schemaVersion: 5, name: 'Orphan', pathSegment: 'orphan-orphan' },
      },
    ]);
    await oracle.apply(orphan, []);
    expect(projectFolderByUid(oracle, 'orphan')).toBeNull();
  });
});

describe('projectAllFolders', () => {
  it('skips folders whose parent linkage is unresolvable, returns rest', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-z');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'good',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Good',
      }).batch,
      [],
    );
    // Orphan folder with no parent slot.
    await oracle.apply(
      mintBatch(ctx(3), [
        {
          kind: 'create',
          type: FOLDER_ENTITY_TYPE,
          id: 'orph',
          payload: { schemaVersion: 5, name: 'Orph', pathSegment: 'orph-orph' },
        },
      ]),
      [],
    );

    const all = projectAllFolders(oracle);
    expect(all.map((f) => f.uid)).toEqual(['good']);
  });
});
