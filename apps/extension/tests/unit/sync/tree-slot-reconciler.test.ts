/**
 * Tree slot reconciler — the permanent path-derived seeding rule: a
 * slot-less leaf or collection gets its slot from its stored path,
 * keys ascend in persisted array order at hydration, the pass is
 * idempotent, an unresolvable parent stays slot-less, and an inbound
 * slot-less create schedules a pass. Conflict healing (slice 3): a
 * shadowed slot gets one tombstone, a cycle breaks and rehomes its
 * victim, an orphan rehomes after the runtime grace (at once on
 * hydrate), every rehome lands a `rehome-entity` feed row.
 */

import { hostStorage } from '@openheaders/core/storage';
import {
  type ActivityEntry,
  COLLECTION_ENTITY_TYPE,
  createFolder,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  FOLDER_ITEMS_PATH,
  mintBatch,
  moveFolder,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
} from '@openheaders/core/sync';
import { seedCollection } from '@openheaders/core/sync-builders/projections/collection-projection';
import { seedRule } from '@openheaders/core/sync-builders/projections/rule-projection';
import type { Collection, Rule } from '@openheaders/core/types';
import { wsKeys } from '@openheaders/oracle/storage';
import { setHostActivityEntrySink } from '@openheaders/oracle/sync';
import { InMemoryBroadcast } from '@openheaders/oracle/sync/broadcast';
import { buildSchemaRegistry, WORKSPACE_REGISTRY } from '@openheaders/oracle/sync/entity-registry';
import { InMemoryMutationLog } from '@openheaders/oracle/sync/mutation-log';
import { EntityOracle, type LockAcquirer } from '@openheaders/oracle/sync/oracle';
import { InMemoryPendingIntents } from '@openheaders/oracle/sync/pending-intents';
import { projectFolderByUid } from '@openheaders/oracle/sync/post-state/folder-post-state';
import { projectRuleByUid } from '@openheaders/oracle/sync/post-state/rule-post-state';
import { createTreeSlotReconciler, REHOME_GRACE_MS } from '@openheaders/oracle/sync/tree-slot-reconciler';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
const folderSlots = (parentType: string, parentUid: string) =>
  oracle.liveOrderedSetItems(parentType, parentUid, FOLDER_CHILDREN_PATH).map((s) => s.itemId);

let entries: ActivityEntry[] = [];
beforeEach(() => {
  entries = [];
  setHostActivityEntrySink((entry) => entries.push(entry));
});
afterEach(() => setHostActivityEntrySink(null));

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

describe('tree slot reconciler — conflict healing', () => {
  const folderUnder = (
    uid: string,
    parent: { type: typeof COLLECTION_ENTITY_TYPE | typeof FOLDER_ENTITY_TYPE; uid: string },
  ) => oracle.apply(createFolder(ctxFactory(), { folderUid: uid, parent, name: uid }).batch, [], 'inbound');

  it('tombstones a shadowed slot so the store agrees with the higher add-HLC parent', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await folderUnder('fol0000a', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    await folderUnder('fol0000b', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    await folderUnder('fol0000x', { type: FOLDER_ENTITY_TYPE, uid: 'fol0000a' });
    await oracle.apply(
      mintBatch(ctxFactory(), [
        {
          kind: 'addToSet',
          type: FOLDER_ENTITY_TYPE,
          id: 'fol0000b',
          path: FOLDER_CHILDREN_PATH,
          itemId: 'fol0000x',
          item: { uid: 'fol0000x' },
        },
      ]),
      [],
      'inbound',
    );
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.reconcile();
    expect(folderSlots(FOLDER_ENTITY_TYPE, 'fol0000a')).toEqual([]);
    expect(folderSlots(FOLDER_ENTITY_TYPE, 'fol0000b')).toEqual(['fol0000x']);
    expect(projectFolderByUid(oracle, 'fol0000x')?.folder.path).toBe(
      `${coll.path}/fol0000b-fol0000b/fol0000x-fol0000x`,
    );
    const before = oracle.revision;
    await reconciler.reconcile();
    expect(oracle.revision).toBe(before);
    expect(entries).toEqual([]);
    reconciler.dispose();
  });

  it('breaks a cycle at the lowest add-HLC slot and rehomes the victim to the collection root with a feed row', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await folderUnder('fol0000p', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    await folderUnder('fol0000q', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    const intoP = moveFolder(ctxFactory(), {
      folderUid: 'fol0000q',
      oldParent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
      newParent: { type: FOLDER_ENTITY_TYPE, uid: 'fol0000p' },
      orderKey: 'a',
    }).batch;
    await oracle.apply(intoP, [], 'inbound');
    await oracle.apply(
      moveFolder(ctxFactory(), {
        folderUid: 'fol0000p',
        oldParent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        newParent: { type: FOLDER_ENTITY_TYPE, uid: 'fol0000q' },
        orderKey: 'a',
      }).batch,
      [],
      'inbound',
    );
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.reconcile();

    expect(folderSlots(FOLDER_ENTITY_TYPE, 'fol0000p')).toEqual([]);
    expect(folderSlots(COLLECTION_ENTITY_TYPE, coll.uid)).toEqual(['fol0000q']);
    expect(folderSlots(FOLDER_ENTITY_TYPE, 'fol0000q')).toEqual(['fol0000p']);
    expect(projectFolderByUid(oracle, 'fol0000p')?.folder.path).toBe(
      `${coll.path}/fol0000q-fol0000q/fol0000p-fol0000p`,
    );
    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry).toMatchObject({
      kind: 'rehome-entity',
      workspaceId: 'ws-1',
      entityType: FOLDER_ENTITY_TYPE,
      entityId: 'fol0000q',
      read: false,
      context: {
        path: FOLDER_CHILDREN_PATH,
        itemId: 'fol0000q',
        reason: 'cycle',
        from: { type: FOLDER_ENTITY_TYPE, uid: 'fol0000p' },
        to: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        inverse: {
          spec: {
            kind: 'slotTransfer',
            from: { type: COLLECTION_ENTITY_TYPE, id: coll.uid, path: FOLDER_CHILDREN_PATH },
            to: { type: FOLDER_ENTITY_TYPE, id: 'fol0000p', path: FOLDER_CHILDREN_PATH },
            itemId: 'fol0000q',
            item: { uid: 'fol0000q' },
            orderKey: 'a',
          },
        },
      },
    });
    expect(entry.id).toContain(entry.mutationId);
    const before = oracle.revision;
    await reconciler.reconcile();
    expect(oracle.revision).toBe(before);
    reconciler.dispose();
  });

  it('rehomes a leaf orphaned by a container deleted under it after the grace, once', async () => {
    let now = 100_000;
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await folderUnder('fol0000a', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    const rule = makeRule('rul00001', `${coll.path}/fol0000a-fol0000a/x-rul00001`);
    await oracle.apply(
      seedRule(rule, ctxFactory(), { parent: { type: FOLDER_ENTITY_TYPE, uid: 'fol0000a' } }),
      [],
      'inbound',
    );
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory, { now: () => now });
    await reconciler.reconcile();

    // The peer's delete cascade did not know about the rule: bare tombstone.
    await oracle.apply(
      mintBatch(ctxFactory(), [{ kind: 'delete', type: FOLDER_ENTITY_TYPE, id: 'fol0000a' }]),
      [],
      'inbound',
    );
    await reconciler.reconcile();
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid)).toEqual([]);
    expect(entries).toEqual([]);

    now += REHOME_GRACE_MS;
    await reconciler.reconcile();
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid).map((s) => s.itemId)).toEqual(['rul00001']);
    expect(projectRuleByUid(oracle, 'rul00001')?.rule.path).toBe(`${coll.path}/x-rul00001`);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: 'rehome-entity',
      entityType: 'rule',
      entityId: 'rul00001',
      context: {
        reason: 'orphan',
        from: null,
        to: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid },
        inverse: { spec: { kind: 'unavailable', reason: 'original-parent-gone' } },
      },
    });
    const before = oracle.revision;
    await reconciler.reconcile();
    expect(oracle.revision).toBe(before);
    expect(entries).toHaveLength(1);
    reconciler.dispose();
  });

  it('tombstones a slot whose child was deleted under a concurrent move, after the grace', async () => {
    let now = 100_000;
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await folderUnder('fol0000a', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    const rule = makeRule('rul00001', `${coll.path}/x-rul00001`);
    await oracle.apply(
      seedRule(rule, ctxFactory(), { parent: { type: COLLECTION_ENTITY_TYPE, uid: coll.uid } }),
      [],
      'inbound',
    );
    // Peer A moved the rule into the folder; peer B deleted it from the collection.
    await oracle.apply(
      mintBatch(ctxFactory(), [
        {
          kind: 'removeFromSet',
          type: COLLECTION_ENTITY_TYPE,
          id: coll.uid,
          path: FOLDER_ITEMS_PATH,
          itemId: 'rul00001',
        },
        {
          kind: 'addToSet',
          type: FOLDER_ENTITY_TYPE,
          id: 'fol0000a',
          path: FOLDER_ITEMS_PATH,
          itemId: 'rul00001',
          item: { uid: 'rul00001', type: 'rule' },
        },
      ]),
      [],
      'inbound',
    );
    await oracle.apply(mintBatch(ctxFactory(), [{ kind: 'delete', type: 'rule', id: 'rul00001' }]), [], 'inbound');
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory, { now: () => now });
    await reconciler.reconcile();
    expect(ruleSlots(FOLDER_ENTITY_TYPE, 'fol0000a').map((s) => s.itemId)).toEqual(['rul00001']);
    now += REHOME_GRACE_MS;
    await reconciler.reconcile();
    expect(ruleSlots(FOLDER_ENTITY_TYPE, 'fol0000a')).toEqual([]);
    expect(entries).toEqual([]);
    reconciler.dispose();
  });

  it('hydrate rehomes a persisted orphan at once, onto the first live collection when its own is gone', async () => {
    const live = makeCollection('col00001');
    await oracle.apply(seedCollection(live, ctxFactory()), [], 'inbound');
    const orphan = makeRule('rul00009', 'rules/gone-col0dead/x-rul00009');
    await oracle.apply(seedRule(orphan, ctxFactory()), [], 'inbound');
    await hostStorage.set(wsKeys('ws-1').rules, [orphan]);
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.hydrateFromStorage();
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, live.uid).map((s) => s.itemId)).toEqual(['rul00009']);
    expect(projectRuleByUid(oracle, 'rul00009')?.rule.path).toBe(`${live.path}/x-rul00009`);
    expect(entries.map((e) => [e.kind, e.entityId])).toEqual([['rehome-entity', 'rul00009']]);
    reconciler.dispose();
  });

  it('extends delete-wins to an orphan whose collection is known deleted when no collection is live', async () => {
    const dead = makeCollection('col0dead');
    await oracle.apply(seedCollection(dead, ctxFactory()), [], 'inbound');
    const orphan = makeRule('rul00009', `${dead.path}/x-rul00009`);
    await oracle.apply(seedRule(orphan, ctxFactory()), [], 'inbound');
    await oracle.apply(
      mintBatch(ctxFactory(), [{ kind: 'delete', type: COLLECTION_ENTITY_TYPE, id: dead.uid }]),
      [],
      'inbound',
    );
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.hydrateFromStorage();
    expect(oracle.materializeOne('rule', 'rul00009')).toBeNull();
    expect(entries).toEqual([]);
    reconciler.dispose();
  });

  it('keeps an orphan whose collection is merely unknown on the by-path net, and rehomes it once a collection appears', async () => {
    const orphan = makeRule('rul00009', 'rules/gone-col0dead/x-rul00009');
    await oracle.apply(seedRule(orphan, ctxFactory()), [], 'inbound');
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.hydrateFromStorage();
    expect(projectRuleByUid(oracle, 'rul00009')?.rule.path).toBe('rules/gone-col0dead/x-rul00009');
    expect(entries).toEqual([]);

    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'local');
    await new Promise((resolve) => setTimeout(resolve, 80));
    // Runtime: the orphan waits out the grace, so nothing moves yet — but the pass ran.
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid)).toEqual([]);
    await reconciler.reconcile(true);
    expect(ruleSlots(COLLECTION_ENTITY_TYPE, coll.uid).map((s) => s.itemId)).toEqual(['rul00009']);
    expect(projectRuleByUid(oracle, 'rul00009')?.rule.path).toBe(`${coll.path}/x-rul00009`);
    expect(entries.map((e) => e.entityId)).toEqual(['rul00009']);
    reconciler.dispose();
  });

  it('schedules a pass on an inbound containment write once armed', async () => {
    const coll = makeCollection('col00001');
    await oracle.apply(seedCollection(coll, ctxFactory()), [], 'inbound');
    await folderUnder('fol0000a', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    await folderUnder('fol0000b', { type: COLLECTION_ENTITY_TYPE, uid: coll.uid });
    await folderUnder('fol0000x', { type: FOLDER_ENTITY_TYPE, uid: 'fol0000a' });
    const reconciler = createTreeSlotReconciler('ws-1', oracle, broadcast, ctxFactory);
    await reconciler.hydrateFromStorage();
    await oracle.apply(
      mintBatch(ctxFactory(), [
        {
          kind: 'addToSet',
          type: FOLDER_ENTITY_TYPE,
          id: 'fol0000b',
          path: FOLDER_CHILDREN_PATH,
          itemId: 'fol0000x',
          item: { uid: 'fol0000x' },
        },
      ]),
      [],
      'inbound',
    );
    expect(folderSlots(FOLDER_ENTITY_TYPE, 'fol0000a')).toEqual(['fol0000x']);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(folderSlots(FOLDER_ENTITY_TYPE, 'fol0000a')).toEqual([]);
    reconciler.dispose();
  });
});
