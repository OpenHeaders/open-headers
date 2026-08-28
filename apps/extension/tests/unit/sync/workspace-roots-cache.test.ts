/**
 * Workspace-roots cache — the three trees' collection order seeds
 * from its persisted record with ascending keys, projects back in slot
 * order, and follows collection slot writes through the broadcast.
 */

import {
  COLLECTION_ENTITY_TYPE,
  createCollection,
  deleteCollection,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import type { WorkspaceRoots } from '@openheaders/core/types';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { createWorkspaceRootsCache } from '@openheaders/oracle/sync/caches/workspace-roots-cache';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { beforeEach, describe, expect, it } from 'vitest';

const lock: LockAcquirer = async (_ws, _t, _id, fn) => fn();

let hlcCounter = 0;
const ctxFactory = () => {
  hlcCounter += 1;
  return {
    workspaceId: 'ws-1',
    hlc: { physicalMs: 1_000 + hlcCounter, logical: 0, nodeId: 'n0' },
    surfaceId: 's',
    deviceId: 'd',
  };
};

const roots = (ruleCollections: string[]): WorkspaceRoots => ({
  schemaVersion: 5,
  ruleCollections,
  requestCollections: [],
  templateCollections: [],
});

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(() => {
  hlcCounter = 0;
  broadcast = new InMemoryBroadcast();
  oracle = new EntityOracle({
    workspaceId: 'ws-1',
    lock,
    log: new InMemoryMutationLog(),
    intents: new InMemoryPendingIntents(),
    broadcast,
    schemas: buildSchemaRegistry(WORKSPACE_REGISTRY),
  });
});

describe('WorkspaceRootsCache', () => {
  it('returns the empty roots before seeding', () => {
    const cache = createWorkspaceRootsCache('ws-1', oracle, broadcast, ctxFactory);
    expect(cache.getWorkspaceRoots().ruleCollections).toEqual([]);
    cache.dispose();
  });

  it('seeds the persisted order with ascending keys and projects it back', async () => {
    const cache = createWorkspaceRootsCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedWorkspaceRoots(roots(['col00002', 'col00001', 'col00003']));
    expect(cache.getWorkspaceRoots().ruleCollections).toEqual(['col00002', 'col00001', 'col00003']);
    const keys = oracle
      .liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)
      .map((e) => e.key);
    expect(keys[0] < keys[1] && keys[1] < keys[2]).toBe(true);
    cache.dispose();
  });

  it('follows a collection create and delete through the roots slots', async () => {
    const cache = createWorkspaceRootsCache('ws-1', oracle, broadcast, ctxFactory);
    await cache.seedFromPersistedWorkspaceRoots(roots(['col00001']));
    const created = createCollection(ctxFactory(), {
      collectionUid: 'col00009',
      payload: { schemaVersion: 5, name: 'Nine', path: 'rules/nine-col00009', pinnedEnvironmentIds: [] },
      orderKey: 'z',
    });
    await oracle.apply(created.batch, []);
    expect(cache.getWorkspaceRoots().ruleCollections).toEqual(['col00001', 'col00009']);
    expect(oracle.materializeOne(COLLECTION_ENTITY_TYPE, 'col00009')).not.toBeNull();

    await oracle.apply(deleteCollection(ctxFactory(), { collectionUid: 'col00001' }).batch, []);
    expect(cache.getWorkspaceRoots().ruleCollections).toEqual(['col00009']);
    cache.dispose();
  });
});
