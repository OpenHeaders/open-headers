/**
 * Phase B — projector reads post-commit state for Collection envelopes
 * and returns null for non-Collection envelopes / deletes / unknown ids.
 * Mirrors env-post-state.test.ts.
 */

import {
  COLLECTION_ENTITY_TYPE,
  COLLECTION_VARS_PATH,
  createFolder,
  FOLDER_CHILDREN_PATH,
  mintBatch,
  moveFolder,
  type MutationEnvelope,
  type MutatorContext,
  RULE_ENTITY_TYPE,
  seedKey,
  setCollectionVar,
} from '@openheaders/core/sync';
import type { Collection } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import { InMemoryBroadcast } from '@/background/sync/broadcast';
import { projectCollectionByUid, projectCollectionPostState } from '@/background/sync/collection-post-state';
import { InMemoryMutationLog } from '@/background/sync/mutation-log';
import { type LockAcquirer, EntityOracle } from '@/background/sync/oracle';
import { InMemoryPendingIntents } from '@/background/sync/pending-intents';
import { seedCollection } from '@/shared/sync/collection-projection';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number, hlc: [number, number] = [ms, 0]): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: hlc[0], logical: hlc[1], nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

const makeCollection = (uid: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: 'staging',
    path: `rules/staging-${uid}`,
    variables: [
      { uid: 'bfdb4aeb', name: 'API_BASE', value: 'https://staging.openheaders.io', type: 'default' },
      { uid: '5a1f3cb6', name: 'TIMEOUT', value: '10', type: 'default' },
    ],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    version: 1,
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

describe('projectCollectionPostState', () => {
  it('returns post-state after seedCollection + setCollectionVar', async () => {
    const oracle = newOracle();
    const coll = makeCollection('coll-1');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    const setIntent = setCollectionVar(ctx(2), {
      collectionUid: coll.uid,
      variable: { uid: 'vrcollnew', name: 'NEW', value: 'v', type: 'default' },
    });
    const setResult = await oracle.apply(setIntent.batch, []);
    expect(setResult.ok).toBe(true);

    const envelope = setIntent.batch.mutations[0];
    const post = projectCollectionPostState(oracle, envelope);
    expect(post).not.toBeNull();
    expect(post?.collection.uid).toBe('coll-1');
    // Set-member identity is the variable uid (post-session-66); `varUids`
    // is the protocol field name but carries itemIds = uids.
    expect(post?.varUids.sort()).toEqual(['5a1f3cb6', 'bfdb4aeb', 'vrcollnew']);
  });

  it('returns null for non-Collection envelopes', () => {
    const oracle = newOracle();
    const ruleEnvelope: MutationEnvelope = {
      mutationId: 'm',
      hlc: { physicalMs: 1, logical: 0, nodeId: 'n' },
      origin: { surfaceId: 's', deviceId: 'd' },
      workspaceId: wsId,
      mutatorVersion: 1,
      body: { kind: 'setField', type: RULE_ENTITY_TYPE, id: 'r', path: 'name', value: 'x' },
    };
    expect(projectCollectionPostState(oracle, ruleEnvelope)).toBeNull();
  });

  it('returns null for unknown collection ids', () => {
    const oracle = newOracle();
    expect(projectCollectionByUid(oracle, 'no-such-id')).toBeNull();
  });

  it('returns null for tombstoned collections', async () => {
    const oracle = newOracle();
    const coll = makeCollection('coll-2');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    const deleteBatch = mintBatch(ctx(2), [
      { kind: 'delete', type: COLLECTION_ENTITY_TYPE, id: coll.uid },
    ]);
    await oracle.apply(deleteBatch, []);
    expect(projectCollectionByUid(oracle, coll.uid)).toBeNull();
  });

  it('reports varUids matching COLLECTION_VARS_PATH itemIds', async () => {
    const oracle = newOracle();
    const coll = makeCollection('coll-3');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    const live = oracle.liveSetItems(COLLECTION_ENTITY_TYPE, coll.uid, COLLECTION_VARS_PATH);
    const projected = projectCollectionByUid(oracle, coll.uid);
    expect(projected?.varUids.sort()).toEqual(live.map((e) => e.itemId).sort());
  });

  it('carries setOrderKeys.folders matching the parent-set order, reflecting moveFolder', async () => {
    const oracle = newOracle();
    const coll = makeCollection('coll-4');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    // Two child folders seed at distinct keys so initial order is stable.
    await oracle.apply(
      createFolder(ctx(2), {
        folderUid: 'fold-a',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'A',
        orderKey: 'a0',
      }).batch,
      [],
    );
    await oracle.apply(
      createFolder(ctx(3), {
        folderUid: 'fold-b',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'B',
        orderKey: 'b0',
      }).batch,
      [],
    );

    const before = projectCollectionByUid(oracle, coll.uid);
    expect(before?.setOrderKeys[FOLDER_CHILDREN_PATH]?.map((s) => s.itemId)).toEqual([
      'fold-a',
      'fold-b',
    ]);

    // Move fold-b to before fold-a — orderKey lexicographically less than 'a0'.
    await oracle.apply(
      moveFolder(ctx(4), {
        folderUid: 'fold-b',
        newParent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        orderKey: 'a',
      }).batch,
      [],
    );

    const after = projectCollectionByUid(oracle, coll.uid);
    expect(after?.setOrderKeys[FOLDER_CHILDREN_PATH]?.map((s) => s.itemId)).toEqual([
      'fold-b',
      'fold-a',
    ]);
  });

  it('omits setOrderKeys.folders for collections with no child folders', async () => {
    const oracle = newOracle();
    const coll = makeCollection('coll-5');
    await oracle.apply(seedCollection(coll, ctx(1)), []);
    const projected = projectCollectionByUid(oracle, coll.uid);
    expect(projected?.setOrderKeys[FOLDER_CHILDREN_PATH]).toBeUndefined();
    // Sanity: seedKey is the canonical first-slot key — kept in this
    // assertion to ensure the export remains live.
    expect(seedKey()).toBeDefined();
  });
});
