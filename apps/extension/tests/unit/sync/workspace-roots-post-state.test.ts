/**
 * Workspace-roots post-state — the folded three-tree collection order
 * plus per-uid keys, and the roots-order read rule the collection
 * caches apply.
 */

import {
  createCollection,
  createRequestCollection,
  type MutatorContext,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import {
  arrangeInRootsOrder,
  projectWorkspaceRootsPostState,
  projectWorkspaceRootsSingleton,
} from '@openheaders/oracle/sync/post-state/workspace-roots-post-state';
import { describe, expect, it } from 'vitest';

const wsId = 'ws-1';
const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();
const ctx = (ms: number): MutatorContext => ({
  workspaceId: wsId,
  hlc: { physicalMs: ms, logical: 0, nodeId: 'n0' },
  surfaceId: 's',
  deviceId: 'd',
});

function newOracle(): EntityOracle {
  return new EntityOracle({
    workspaceId: wsId,
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast: new InMemoryBroadcast(),
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
  });
}

const collectionPayload = (uid: string, prefix: string) => ({
  schemaVersion: 5,
  name: uid,
  path: `${prefix}/${uid}`,
  pinnedEnvironmentIds: [],
});

describe('workspace-roots post-state', () => {
  it('is observable from the first collection slot on, without a roots create', async () => {
    const oracle = newOracle();
    const intent = createCollection(ctx(1), {
      collectionUid: 'col00001',
      payload: collectionPayload('col00001', 'rules'),
      orderKey: 'b',
    });
    await oracle.apply(intent.batch, []);
    const slotEnvelope = intent.batch.mutations.find((m) => m.body.type === WORKSPACE_ROOTS_ENTITY_TYPE);
    expect(slotEnvelope).toBeDefined();
    const post = projectWorkspaceRootsPostState(oracle, slotEnvelope!);
    expect(post?.workspaceRoots).toEqual({
      schemaVersion: 5,
      ruleCollections: ['col00001'],
      requestCollections: [],
      templateCollections: [],
    });
    expect(post?.setOrderKeys[WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH]).toEqual([{ itemId: 'col00001', orderKey: 'b' }]);
  });

  it('folds every tree in slot order and answers the singleton read', async () => {
    const oracle = newOracle();
    await oracle.apply(
      createCollection(ctx(1), {
        collectionUid: 'col00002',
        payload: collectionPayload('col00002', 'rules'),
        orderKey: 'b',
      }).batch,
      [],
    );
    await oracle.apply(
      createCollection(ctx(2), {
        collectionUid: 'col00001',
        payload: collectionPayload('col00001', 'rules'),
        orderKey: 'a',
      }).batch,
      [],
    );
    await oracle.apply(
      createRequestCollection(ctx(3), {
        collectionUid: 'rcol0001',
        payload: collectionPayload('rcol0001', 'requests'),
        orderKey: 'c',
      }).batch,
      [],
    );
    const post = projectWorkspaceRootsSingleton(oracle);
    expect(post?.workspaceRoots.ruleCollections).toEqual(['col00001', 'col00002']);
    expect(post?.workspaceRoots.requestCollections).toEqual(['rcol0001']);
    expect(post?.setOrderKeys[WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH]).toEqual([
      { itemId: 'rcol0001', orderKey: 'c' },
    ]);
  });

  it('returns null for a foreign envelope', async () => {
    const oracle = newOracle();
    const intent = createCollection(ctx(1), {
      collectionUid: 'col00001',
      payload: collectionPayload('col00001', 'rules'),
    });
    await oracle.apply(intent.batch, []);
    expect(projectWorkspaceRootsPostState(oracle, intent.batch.mutations[0])).toBeNull();
  });
});

describe('arrangeInRootsOrder', () => {
  it('orders by roots slot, slot-less collections after in uid order', async () => {
    const oracle = newOracle();
    await oracle.apply(
      createCollection(ctx(1), {
        collectionUid: 'col00003',
        payload: collectionPayload('col00003', 'rules'),
        orderKey: 'a',
      }).batch,
      [],
    );
    await oracle.apply(
      createCollection(ctx(2), {
        collectionUid: 'col00001',
        payload: collectionPayload('col00001', 'rules'),
        orderKey: 'b',
      }).batch,
      [],
    );
    const arranged = arrangeInRootsOrder(oracle, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH, [
      { uid: 'col00009' },
      { uid: 'col00001' },
      { uid: 'col00005' },
      { uid: 'col00003' },
    ]);
    expect(arranged.map((c) => c.uid)).toEqual(['col00003', 'col00001', 'col00005', 'col00009']);
  });
});
