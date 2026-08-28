/**
 * Phase B Folder — projector reads cross-entity oracle state to
 * reconstruct Folder.path via parent walk. Returns null for
 * non-folder envelopes / tombstoned folders / folders whose parent
 * linkage hasn't seeded yet.
 */

import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  type FolderParentRef,
  type MutationEnvelope,
  type MutatorContext,
  mintBatch,
  moveFolder,
  RULE_ENTITY_TYPE,
  renameFolder,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Collection, Folder } from '@openheaders/core/types';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  projectAllFolders,
  projectFolderByUid,
  projectFolderPostState,
  RULE_TREE,
} from '@openheaders/oracle/sync/post-state/folder-post-state';
import { treeConflicts } from '@openheaders/oracle/sync/post-state/folder-tree-post-state';
import { projectRuleByUid } from '@openheaders/oracle/sync/post-state/rule-post-state';
import { describe, expect, it } from 'vitest';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeCollection = (uid: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: 'auth',
    path: `rules/auth-${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;

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
      orgId: 'org-test',
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

  it('carries setOrderKeys.folders for nested child folders, reflecting moveFolder', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-ord');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'parent',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Parent',
      }).batch,
      [],
    );
    await oracle.apply(
      createFolder(ctx(3), {
        folderUid: 'child-a',
        parent: { type: FOLDER_ENTITY_TYPE, uid: 'parent' },
        name: 'A',
        orderKey: 'a0',
      }).batch,
      [],
    );
    await oracle.apply(
      createFolder(ctx(4), {
        folderUid: 'child-b',
        parent: { type: FOLDER_ENTITY_TYPE, uid: 'parent' },
        name: 'B',
        orderKey: 'b0',
      }).batch,
      [],
    );

    const before = projectFolderByUid(oracle, 'parent');
    expect(before?.setOrderKeys[FOLDER_CHILDREN_PATH]?.map((s) => s.itemId)).toEqual(['child-a', 'child-b']);

    await oracle.apply(
      moveFolder(ctx(5), {
        folderUid: 'child-b',
        newParent: { type: FOLDER_ENTITY_TYPE, uid: 'parent' },
        orderKey: 'a',
      }).batch,
      [],
    );

    const after = projectFolderByUid(oracle, 'parent');
    expect(after?.setOrderKeys[FOLDER_CHILDREN_PATH]?.map((s) => s.itemId)).toEqual(['child-b', 'child-a']);
  });

  it('omits setOrderKeys.folders for leaf folders', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-leaf');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'leaf',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Leaf',
      }).batch,
      [],
    );
    const post = projectFolderByUid(oracle, 'leaf');
    expect(post?.setOrderKeys[FOLDER_CHILDREN_PATH]).toBeUndefined();
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

describe('leaf path projection (tree containment slice 2)', () => {
  const makeRule = (uid: string, path: string) =>
    ({
      schemaVersion: 5,
      uid,
      path,
      type: 'header',
      name: uid,
      enabled: true,
      conditions: [],
      action: { requestHeaders: [], responseHeaders: [] },
    }) as unknown as Parameters<typeof seedRule>[0];

  it('composes a slotted leaf path from the parent walk and cascades a folder move', async () => {
    const oracle = newOracle();
    const collA = makeCollection('col-a');
    const collB = { ...makeCollection('col-b'), path: 'rules/other-col-b' } as Collection;
    await oracle.apply(seedCollection(collA, ctx(1)), []);
    await oracle.apply(seedCollection(collB, ctx(2)), []);
    await oracle.apply(
      createFolder(ctx(3), {
        folderUid: 'fold-m',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: collA.uid },
        name: 'Moving',
      }).batch,
      [],
    );
    const rule = makeRule('rul00001', `${collA.path}/moving-fold-m/probe-rul00001`);
    await oracle.apply(seedRule(rule, ctx(4), { parent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-m' } }), []);
    expect(projectRuleByUid(oracle, 'rul00001')?.rule.path).toBe(`${collA.path}/moving-fold-m/probe-rul00001`);
    expect(projectRuleByUid(oracle, 'rul00001')?.rule.pathSegment).toBe('probe-rul00001');

    await oracle.apply(
      moveFolder(ctx(5), {
        folderUid: 'fold-m',
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: collA.uid },
        newParent: { type: COLLECTION_ENTITY_TYPE, uid: collB.uid },
        orderKey: 'a',
      }).batch,
      [],
    );
    expect(projectFolderByUid(oracle, 'fold-m')?.folder.path).toBe(`${collB.path}/moving-fold-m`);
    expect(projectRuleByUid(oracle, 'rul00001')?.rule.path).toBe(`${collB.path}/moving-fold-m/probe-rul00001`);
  });

  it('keeps the stored path for a slot-less leaf (the mixed-fleet net)', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-n');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(seedRule(makeRule('rul00002', `${coll.path}/legacy-rul00002`), ctx(2)), []);
    const post = projectRuleByUid(oracle, 'rul00002');
    expect(post?.rule.path).toBe(`${coll.path}/legacy-rul00002`);
    expect(post?.rule.pathSegment).toBeUndefined();
  });

  it('projects folders in tree order — parent path, then slot position', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-o');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    for (const [uid, key] of [
      ['fold-z', 'a'],
      ['fold-a', 'b'],
    ] as const) {
      await oracle.apply(
        createFolder(ctx(2), {
          folderUid: uid,
          parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
          name: uid,
          orderKey: key,
        }).batch,
        [],
      );
    }
    expect(projectAllFolders(oracle).map((f) => f.uid)).toEqual(['fold-z', 'fold-a']);
  });
});

describe('conflict rules in the index (tree containment slice 3)', () => {
  const folderAt = (uid: string, parent: FolderParentRef, ms: number) =>
    createFolder(ctx(ms), { folderUid: uid, parent, name: uid }).batch;

  it('a child in two live slots follows the higher add-HLC parent; the loser is reported shadowed', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-s');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(folderAt('fold-a', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid }, 2), []);
    await oracle.apply(folderAt('fold-b', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid }, 3), []);
    await oracle.apply(folderAt('fold-x', { type: FOLDER_ENTITY_TYPE, uid: 'fold-a' }, 10), []);
    // A concurrent peer added the same child under fold-b with a LATER add-HLC —
    // no removal of the fold-a slot ever arrived.
    await oracle.apply(
      mintBatch(ctx(20), [
        {
          kind: 'addToSet',
          type: FOLDER_ENTITY_TYPE,
          id: 'fold-b',
          path: FOLDER_CHILDREN_PATH,
          itemId: 'fold-x',
          item: { uid: 'fold-x' },
        },
      ]),
      [],
    );

    expect(projectFolderByUid(oracle, 'fold-x')?.folder.path).toBe(`${coll.path}/fold-b-fold-b/fold-x-fold-x`);
    const conflicts = treeConflicts(oracle, RULE_TREE);
    expect(conflicts.shadowed).toEqual([
      {
        childUid: 'fold-x',
        parent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-a' },
        setPath: FOLDER_CHILDREN_PATH,
        item: { uid: 'fold-x' },
        orderKey: expect.any(String),
      },
    ]);
    expect(conflicts.cycleVictims).toEqual([]);
    expect(conflicts.deadSlots).toEqual([]);
  });

  it('breaks a folder cycle at the lowest add-HLC slot and reports the victim', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-c');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(folderAt('fold-p', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid }, 2), []);
    await oracle.apply(folderAt('fold-q', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid }, 3), []);
    // Peer A moved q into p (HLC 10); peer B moved p into q (HLC 11). Merged: a cycle.
    await oracle.apply(
      moveFolder(ctx(10), {
        folderUid: 'fold-q',
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        newParent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-p' },
        orderKey: 'a',
      }).batch,
      [],
    );
    await oracle.apply(
      moveFolder(ctx(11), {
        folderUid: 'fold-p',
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        newParent: { type: FOLDER_ENTITY_TYPE, uid: 'fold-q' },
        orderKey: 'a',
      }).batch,
      [],
    );

    const conflicts = treeConflicts(oracle, RULE_TREE);
    expect(conflicts.cycleVictims.map((v) => [v.childUid, v.parent.uid])).toEqual([['fold-q', 'fold-p']]);
    // The victim has no live parent until rehomed; the survivor chains through it and waits too.
    expect(projectFolderByUid(oracle, 'fold-q')).toBeNull();
    expect(projectFolderByUid(oracle, 'fold-p')).toBeNull();
    expect(projectAllFolders(oracle)).toEqual([]);
  });
});

describe('dead-child slots in the index', () => {
  it('drops a slot whose child is tombstoned and reports it', async () => {
    const oracle = newOracle();
    const coll = makeCollection('col-d');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'fold-g',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Gone',
      }).batch,
      [],
    );
    await oracle.apply(mintBatch(ctx(3), [{ kind: 'delete', type: FOLDER_ENTITY_TYPE, id: 'fold-g' }]), []);
    expect(treeConflicts(oracle, RULE_TREE).deadSlots).toEqual([
      {
        childUid: 'fold-g',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        setPath: FOLDER_CHILDREN_PATH,
        item: { uid: 'fold-g' },
        orderKey: expect.any(String),
      },
    ]);
    expect(projectAllFolders(oracle)).toEqual([]);
  });
});
