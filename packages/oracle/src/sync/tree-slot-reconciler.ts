/**
 * Tree slot reconciler — path-derived slot seeding, run forever.
 *
 * The parent's ordered set is the one containment authority, but the
 * fleet is mixed-version: 2026.8.4 clients create leaves with a stored
 * `path` and no slot, persisted projections predate slots, git trees
 * carry no slots at all. So "a leaf with a `path` and no live slot gets
 * a slot derived from its parent path" is a PERMANENT reconciliation
 * rule (the tree containment plan), not a migration: it runs after
 * every hydration and after every inbound create that lands slot-less
 * (peer stream, snapshot bootstrap), and it is idempotent — only
 * slot-less children are touched.
 *
 * Order: at hydration the persisted arrays are read back and replayed
 * in array order (the caches persist tree order, so keys mint
 * ascending in the order the user last saw); a later inbound arrival
 * appends after the parent's live tail. Collections without a roots
 * slot join their tree's roots the same way.
 *
 * Nothing is lost silently: a child whose stored parent path resolves
 * to no live container stays slot-less on the by-path net and is
 * logged — rehoming it to the collection root is the conflict slice's
 * primitive.
 */

import {
  type ChildMutators,
  type COLLECTION_ENTITY_TYPE,
  collectionChild,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  GRPC_REQUEST_ENTITY_TYPE,
  grpcRequestChild,
  MQTT_REQUEST_ENTITY_TYPE,
  type MutationBody,
  mintBatch,
  mqttRequestChild,
  newBatchId,
  type ParentRefShape,
  type REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  RULE_ENTITY_TYPE,
  requestChild,
  requestCollectionChild,
  resolveTreeParent,
  ruleChild,
  type TEMPLATE_COLLECTION_ENTITY_TYPE,
  TEMPLATE_ENTITY_TYPE,
  TEMPLATE_FOLDER_ITEMS_PATH,
  TEMPLATE_FOLDER_TREE_KINDS,
  type TreeParentKinds,
  type TreeParentRef,
  templateChild,
  templateCollectionChild,
  WEBSOCKET_REQUEST_ENTITY_TYPE,
  WORKSPACE_ROOTS_ENTITY_TYPE,
  WORKSPACE_ROOTS_ID,
  WORKSPACE_ROOTS_REF,
  WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
  type WorkspaceRootsRef,
  webSocketRequestChild,
} from '@openheaders/core/sync';
import { createTailTracker } from '@openheaders/core/sync-builders/mutations/workspace-import-emission';
import { logger, parentPathOf } from '@openheaders/core/utils';
import { hostStorage, type StorageKey, wsKeys } from '@openheaders/oracle/storage';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityCacheLike } from './entity-registry';
import type { EntityOracle } from './oracle';
import { RULE_TREE } from './post-state/folder-post-state';
import {
  type FolderTreeKinds,
  hasTreeSlot,
  treeContainers,
  treeMaterialized,
} from './post-state/folder-tree-post-state';
import { REQUEST_TREE } from './post-state/request-folder-post-state';
import { TEMPLATE_TREE } from './post-state/template-folder-post-state';
import type { SwMutatorContextFactory } from './sw-context';

/** Inbound creates coalesce into one pass per burst (peer streams, snapshot replay). */
const RECONCILE_DEBOUNCE_MS = 50;

interface LeafKind<P extends ParentRefShape> {
  entityType: string;
  child: ChildMutators<P>;
  storageKey: (workspaceId: string) => StorageKey<ReadonlyArray<{ uid: string }>>;
}

interface TreeSpec<C extends string, F extends string> {
  kinds: FolderTreeKinds<C, F>;
  /** The path → parent-ref vocabulary (`resolveTreeParent`). */
  parentKinds: TreeParentKinds<C, F>;
  itemsPath: string;
  rootsPath: string;
  collectionChild: ChildMutators<WorkspaceRootsRef>;
  collectionStorageKey: (workspaceId: string) => StorageKey<ReadonlyArray<{ uid: string }>>;
  leaves: ReadonlyArray<LeafKind<TreeParentRef<C, F>>>;
}

const RULES: TreeSpec<typeof COLLECTION_ENTITY_TYPE, typeof RULE_TREE.folderType> = {
  kinds: RULE_TREE,
  parentKinds: FOLDER_TREE_KINDS,
  itemsPath: FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  collectionChild,
  collectionStorageKey: (ws) => wsKeys(ws).collections,
  leaves: [{ entityType: RULE_ENTITY_TYPE, child: ruleChild, storageKey: (ws) => wsKeys(ws).rules }],
};

const REQUESTS: TreeSpec<typeof REQUEST_COLLECTION_ENTITY_TYPE, typeof REQUEST_TREE.folderType> = {
  kinds: REQUEST_TREE,
  parentKinds: REQUEST_FOLDER_TREE_KINDS,
  itemsPath: REQUEST_FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  collectionChild: requestCollectionChild,
  collectionStorageKey: (ws) => wsKeys(ws).requestCollections,
  leaves: [
    { entityType: REQUEST_ENTITY_TYPE, child: requestChild, storageKey: (ws) => wsKeys(ws).requests },
    { entityType: GRPC_REQUEST_ENTITY_TYPE, child: grpcRequestChild, storageKey: (ws) => wsKeys(ws).grpcRequests },
    {
      entityType: WEBSOCKET_REQUEST_ENTITY_TYPE,
      child: webSocketRequestChild,
      storageKey: (ws) => wsKeys(ws).websocketRequests,
    },
    { entityType: MQTT_REQUEST_ENTITY_TYPE, child: mqttRequestChild, storageKey: (ws) => wsKeys(ws).mqttRequests },
  ],
};

const TEMPLATES: TreeSpec<typeof TEMPLATE_COLLECTION_ENTITY_TYPE, typeof TEMPLATE_TREE.folderType> = {
  kinds: TEMPLATE_TREE,
  parentKinds: TEMPLATE_FOLDER_TREE_KINDS,
  itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_TEMPLATE_COLLECTIONS_PATH,
  collectionChild: templateCollectionChild,
  collectionStorageKey: (ws) => wsKeys(ws).templateCollections,
  leaves: [{ entityType: TEMPLATE_ENTITY_TYPE, child: templateChild, storageKey: (ws) => wsKeys(ws).templates }],
};

const TREES = [RULES, REQUESTS, TEMPLATES] as const;

/** Entity types whose slot-less inbound create schedules a pass. */
const SEEDED_TYPES: ReadonlySet<string> = new Set(
  TREES.flatMap((tree) => [tree.kinds.collectionType, ...tree.leaves.map((leaf) => leaf.entityType)]),
);

export interface TreeSlotReconciler extends EntityCacheLike {
  /** One idempotent pass over the three trees. `persistedOrder` replays
   *  the stored arrays' order (hydration); otherwise uid order. */
  reconcile(persistedOrder?: boolean): Promise<void>;
}

/** Persisted-array positions per uid; absent → after every listed uid, by uid. */
type UidOrder = ReadonlyMap<string, number>;

export function createTreeSlotReconciler(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
): TreeSlotReconciler {
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;

  const reconcile = async (persistedOrder = false): Promise<void> => {
    if (running) {
      await running;
    }
    running = runPass(workspaceId, oracle, contextFactory, persistedOrder).finally(() => {
      running = null;
    });
    await running;
  };

  const schedule = (): void => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void reconcile().catch((err: unknown) => {
        logger.info('TreeSlotReconciler', `pass failed (ws=${workspaceId}): ${(err as Error).message}`);
      });
    }, RECONCILE_DEBOUNCE_MS);
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!armed || event.applyOrigin !== 'inbound') return;
    const body = event.envelope.body;
    if (body.kind !== 'create' || !SEEDED_TYPES.has(body.type)) return;
    schedule();
  });

  return {
    reconcile,
    async hydrateFromStorage(): Promise<void> {
      try {
        await reconcile(true);
      } catch (err) {
        logger.info('TreeSlotReconciler', `hydrate pass failed (ws=${workspaceId}): ${(err as Error).message}`);
      } finally {
        armed = true;
      }
    },
    dispose(): void {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

async function runPass(
  workspaceId: string,
  oracle: EntityOracle,
  contextFactory: SwMutatorContextFactory,
  persistedOrder: boolean,
): Promise<void> {
  const bodies: MutationBody[] = [];
  const tail = createTailTracker((type, id, setPath) =>
    oracle
      .liveOrderedSetItems(type, id, setPath)
      .map((entry) => ({ itemId: entry.itemId, item: entry.item, orderKey: entry.key })),
  );
  for (const tree of TREES) {
    await reconcileTree(workspaceId, oracle, tree, persistedOrder, tail, bodies);
  }
  if (bodies.length === 0) return;
  const ctx = { ...contextFactory(), batchId: `tree-reconcile-${newBatchId()}` };
  const result = await oracle.apply(mintBatch(ctx, bodies), [], 'inbound');
  if (!result.ok) {
    logger.info(
      'TreeSlotReconciler',
      `seed failed (ws=${workspaceId}): ${result.failure?.status} — ${result.failure?.detail ?? 'no detail'}`,
    );
    return;
  }
  logger.info('TreeSlotReconciler', `seeded ${bodies.length} slot(s) for ws=${workspaceId}`);
}

async function reconcileTree<C extends string, F extends string>(
  workspaceId: string,
  oracle: EntityOracle,
  tree: TreeSpec<C, F>,
  persistedOrder: boolean,
  tail: (parent: ParentRefShape, setPath: string) => string,
  bodies: MutationBody[],
): Promise<void> {
  const materialized = treeMaterialized(oracle, tree.kinds);
  const containers = treeContainers(oracle, tree.kinds);
  const liveContainers = new Set<string>([
    ...containers.collections.map((c) => c.uid),
    ...containers.folders.map((f) => f.uid),
  ]);

  // Collections without a roots slot — today's uid order unless the
  // persisted array says otherwise.
  const rooted = new Set(
    oracle.liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, tree.rootsPath).map((e) => e.itemId),
  );
  const collectionOrder = persistedOrder ? await readOrder(tree.collectionStorageKey(workspaceId)) : new Map();
  const collections = materialized.filter((m) => m.type === tree.kinds.collectionType && !rooted.has(m.id));
  for (const m of sortByOrder(collections, collectionOrder)) {
    bodies.push(tree.collectionChild.slotAdd(m.id, WORKSPACE_ROOTS_REF, tail(WORKSPACE_ROOTS_REF, tree.rootsPath)));
  }

  for (const leaf of tree.leaves) {
    const order = persistedOrder ? await readOrder(leaf.storageKey(workspaceId)) : new Map();
    const slotless = materialized.filter((m) => m.type === leaf.entityType && !hasTreeSlot(oracle, tree.kinds, m.id));
    for (const m of sortByOrder(slotless, order)) {
      const path = storedPath(m.data);
      const parentPath = path === null ? null : parentPathOf(path);
      const parent = parentPath === null ? null : resolveTreeParent(parentPath, containers, tree.parentKinds);
      if (!parent || !liveContainers.has(parent.uid)) {
        logger.info(
          'TreeSlotReconciler',
          `${leaf.entityType} ${m.id} stays slot-less — parent for path ${path ?? '(none)'} not live (ws=${workspaceId})`,
        );
        continue;
      }
      bodies.push(leaf.child.slotAdd(m.id, parent, tail(parent, tree.itemsPath)));
    }
  }
}

function storedPath(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('path' in data)) return null;
  return typeof data.path === 'string' ? data.path : null;
}

async function readOrder(key: StorageKey<ReadonlyArray<{ uid: string }>>): Promise<UidOrder> {
  const order = new Map<string, number>();
  const persisted = await hostStorage.get(key);
  if (!Array.isArray(persisted)) return order;
  persisted.forEach((entity, index) => {
    if (typeof entity?.uid === 'string') order.set(entity.uid, index);
  });
  return order;
}

function sortByOrder<T extends { id: string }>(entities: T[], order: UidOrder): T[] {
  const rank = (id: string): number => order.get(id) ?? Number.POSITIVE_INFINITY;
  return [...entities].sort((a, b) => {
    const ra = rank(a.id);
    const rb = rank(b.id);
    if (ra !== rb) return ra < rb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
