/**
 * Tree slot reconciler — the permanent path-derived seeding rule: a
 * slot-less leaf or collection gets its slot from its stored path,
 * keys ascend in persisted array order at hydration, the pass is
 * idempotent, an unresolvable parent stays slot-less, and an inbound
 * slot-less create schedules a pass.
 */

import { hostStorage } from '@openheaders/core/storage';
import {
  COLLECTION_ENTITY_TYPE,
  createFolder,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Collection, Rule } from '@openheaders/core/types';
import { wsKeys } from '@openheaders/oracle/storage';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { projectRuleByUid } from '@openheaders/oracle/sync/post-state/rule-post-state';
import { createTreeSlotReconciler } from '@openheaders/oracle/sync/tree-slot-reconciler';
import { beforeEach, describe, expect, it } from 'vitest';
import { installBackingStorage } from '../../helpers/chrome-storage-backing';

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

const makeCollection = (uid: string): Collection =>
  ({
    schemaVersion: 5,
    uid,
    name: uid,
    path: `rules/api-${uid}`,
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
  }) as unknown as Collection;

const makeRule = (uid: string, path: string): Rule =>
  ({
    schemaVersion: 5,
    uid,
    path,
    type: 'header',
    name: uid,
    enabled: true,
    conditions: [],
    action: { requestHeaders: [], responseHeaders: [] },
  }) as unknown as Rule;

let oracle: EntityOracle;
let broadcast: InMemoryBroadcast;

beforeEach(async () => {
  installBackingStorage();
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
  await hostStorage.set(wsKeys('ws-1').rules, []);
  await hostStorage.set(wsKeys('ws-1').collections, []);
});

const ruleSlots = (parentType: string, parentUid: string) =>
  oracle.liveOrderedSetItems(parentType, parentUid, FOLDER_ITEMS_PATH);

describe('tree slot reconciler', () => {
  it('seeds slot-less leaves and collections from their stored paths in persisted order', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await oracle.apply(
      createFolder(ctxFactory(), {
        folderUid: 'fol00001',
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        name: 'Sub',
      }).batch,
      [],
      'inbound',
    );
    const inCollection = [
      makeRule('rul00003', `${coll.path}/c-rul00003`),
      makeRule('rul00001', `${coll.path}/a-rul00001`),
    ];
    const inFolder = makeRule('rul00002', `${coll.path}/sub-fol00001/b-rul00002`);
    for (const rule of [...inCollection, inFolder]) await oracle.apply(seedRule(rule, ctxFactory()), [], 'inbound');
    await hostStorage.set(wsKeys('ws-1').rules, [...inCollection, inFolder]);

    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.hydrateFromStorage();

    const collectionSlots = ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid);
    expect(collectionSlots.map((s) => s.itemId)).toEqual(['rul00003', 'rul00001']);
    expect(collectionSlots[0].key < collectionSlots[1].key).toBe(true);
    expect(collectionSlots[0].item).toEqual({ uid: 'rul00003', type: 'rule' });
    expect(ruleSlots(FOLDER_ENTITY_TYPE, 'fol00001').map((s) => s.itemId)).toEqual(['rul00002']);
    expect(
      oracle
        .liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH)
        .map((s) => s.itemId),
    ).toEqual(['col00001']);
    // The slot is what the projection reads from now.
    expect(projectRuleByUid(oracle, 'rul00002')?.rule.path).toBe(`${coll.path}/sub-fol00001/b-rul00002`);
    reconciler.dispose();
  });

  it('is idempotent — a second pass mints nothing', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await oracle.apply(seedRule(makeRule('rul00001', `${coll.path}/a-rul00001`), ctxFactory()), [], 'inbound');
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.reconcile();
    const before = oracle.revision;
    const keys = ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid).map((s) => s.key);
    await reconciler.reconcile();
    expect(oracle.revision).toBe(before);
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid).map((s) => s.key)).toEqual(keys);
    reconciler.dispose();
  });

  it('appends after the live tail and leaves an unresolvable parent slot-less', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await oracle.apply(
      seedRule(makeRule('rul00001', `${coll.path}/a-rul00001`), ctxFactory(), {
        parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        orderKey: 'm',
      }),
      [],
      'inbound',
    );
    await oracle.apply(seedRule(makeRule('rul00000', `${coll.path}/z-rul00000`), ctxFactory()), [], 'inbound');
    const orphan = makeRule('rul00009', 'rules/gone-col0dead/x-rul00009');
    await oracle.apply(seedRule(orphan, ctxFactory()), [], 'inbound');

    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.reconcile();
    const slots = ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid);
    expect(slots.map((s) => s.itemId)).toEqual(['rul00001', 'rul00000']);
    expect(slots[1].key > 'm').toBe(true);
    expect(oracle.liveOrderedSetItems(COLLECTION_ENTITY_TYPE, 'col0dead', FOLDER_ITEMS_PATH)).toEqual([]);
    expect(projectRuleByUid(oracle, 'rul00009')?.rule.path).toBe('rules/gone-col0dead/x-rul00009');
    reconciler.dispose();
  });

  it('schedules a pass after an inbound slot-less create once armed', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.hydrateFromStorage();

    await oracle.apply(seedRule(makeRule('rul00001', `${coll.path}/a-rul00001`), ctxFactory()), [], 'inbound');
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid)).toEqual([]);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid).map((s) => s.itemId)).toEqual(['rul00001']);
    reconciler.dispose();
  });
});
