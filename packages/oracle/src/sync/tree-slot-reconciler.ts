/**
 * Tree slot reconciler — path-derived slot seeding and conflict
 * healing, run forever.
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
 * Merged state also needs healing. The tree index resolves conflicts
 * deterministically in projection (`treeConflicts`: a shadowed slot
 * loses to the higher add-HLC one; a folder cycle breaks at its
 * lowest add-HLC slot; a slot whose child is tombstoned is garbage);
 * this pass makes the store agree with the projection: one
 * `removeFromSet` tombstone per dropped slot, and the ONE rehome
 * primitive for every child left without a live parent —
 * cycle victims, and orphans whose container was tombstoned under a
 * concurrent move (delete-wins on the parent, §7.2). A rehomed child
 * lands on a collection root of its tree with a `rehome-entity` feed
 * row. With no live collection to land on, a child whose own
 * collection is KNOWN deleted follows it (invariant 11: delete-wins
 * extends to the child); one whose collection is merely unknown —
 * a drifted projection, a restart that dropped tombstones — stays
 * slot-less on the by-path net, because an absence is never grounds
 * for a permanent tombstone.
 *
 * Peers relay batches as single frames, so a create can be observed
 * before its slot and a slot before its create. Shadow healing and
 * cycle breaks act on converged facts and run at once; an orphan or a
 * dead-child slot at runtime is healed only after
 * {@link REHOME_GRACE_MS} of staying that way (hydration is immediate
 * — persisted state is settled), and a leaf this host never saw
 * slotted keeps today's path seeding rather than a rehome, so an
 * in-flight create lands where its author put it.
 *
 * Order: at hydration the persisted arrays are read back and replayed
 * in array order (the caches persist tree order, so keys mint
 * ascending in the order the user last saw); a later inbound arrival
 * appends after the parent's live tail. Collections without a roots
 * slot join their tree's roots the same way.
 */

import {
  type ChildMutators,
  type COLLECTION_ENTITY_TYPE,
  collectionChild,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  folderChild,
  GRPC_REQUEST_ENTITY_TYPE,
  grpcRequestChild,
  type MaterializedEntity,
  MQTT_REQUEST_ENTITY_TYPE,
  type MutationBody,
  type MutationEnvelope,
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
  requestFolderChild,
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
  templateFolderChild,
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
import { recordHostActivityEntry } from './activity/activity-host-entries';
import type { BroadcastEvent, InMemoryBroadcast } from './broadcast';
import type { EntityCacheLike } from './entity-registry';
import type { EntityOracle } from './oracle';
import { RULE_TREE } from './post-state/folder-post-state';
import {
  affectsTreeContainment,
  type FolderTreeKinds,
  hasTreeSlot,
  type TreeContainers,
  type TreeSlotRecord,
  treeConflicts,
  treeContainers,
  treeMaterialized,
} from './post-state/folder-tree-post-state';
import { REQUEST_TREE } from './post-state/request-folder-post-state';
import { TEMPLATE_TREE } from './post-state/template-folder-post-state';
import type { SwMutatorContextFactory } from './sw-context';
import { type RehomePlan, type RehomeReason, rehomeActivityEntry } from './tree-rehome';

/** Inbound creates coalesce into one pass per burst (peer streams, snapshot replay). */
const RECONCILE_DEBOUNCE_MS = 50;

/** How long a runtime orphan (or a dead-child slot) must persist before it is healed. */
export const REHOME_GRACE_MS = 2_000;

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
  folderChild: ChildMutators<TreeParentRef<C, F>>;
  leaves: ReadonlyArray<LeafKind<TreeParentRef<C, F>>>;
}

const RULES: TreeSpec<typeof COLLECTION_ENTITY_TYPE, typeof RULE_TREE.folderType> = {
  kinds: RULE_TREE,
  parentKinds: FOLDER_TREE_KINDS,
  itemsPath: FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_RULE_COLLECTIONS_PATH,
  collectionChild,
  collectionStorageKey: (ws) => wsKeys(ws).collections,
  folderChild,
  leaves: [{ entityType: RULE_ENTITY_TYPE, child: ruleChild, storageKey: (ws) => wsKeys(ws).rules }],
};

const REQUESTS: TreeSpec<typeof REQUEST_COLLECTION_ENTITY_TYPE, typeof REQUEST_TREE.folderType> = {
  kinds: REQUEST_TREE,
  parentKinds: REQUEST_FOLDER_TREE_KINDS,
  itemsPath: REQUEST_FOLDER_ITEMS_PATH,
  rootsPath: WORKSPACE_ROOTS_REQUEST_COLLECTIONS_PATH,
  collectionChild: requestCollectionChild,
  collectionStorageKey: (ws) => wsKeys(ws).requestCollections,
  folderChild: requestFolderChild,
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
  folderChild: templateFolderChild,
  leaves: [{ entityType: TEMPLATE_ENTITY_TYPE, child: templateChild, storageKey: (ws) => wsKeys(ws).templates }],
};

const TREES = [RULES, REQUESTS, TEMPLATES] as const;

/** Entity types whose slot-less inbound create schedules a pass. */
const SEEDED_TYPES: ReadonlySet<string> = new Set(
  TREES.flatMap((tree) => [tree.kinds.collectionType, ...tree.leaves.map((leaf) => leaf.entityType)]),
);

/** Container types whose inbound delete can orphan children. */
const CONTAINER_TYPES: ReadonlySet<string> = new Set(
  TREES.flatMap((tree) => [tree.kinds.collectionType, tree.kinds.folderType]),
);

const COLLECTION_TYPES: ReadonlySet<string> = new Set(TREES.map((tree) => tree.kinds.collectionType));

export interface TreeSlotReconciler extends EntityCacheLike {
  /** One idempotent pass over the three trees. `persistedOrder` replays
   *  the stored arrays' order and rehomes orphans at once (hydration);
   *  otherwise uid order and the runtime grace. */
  reconcile(persistedOrder?: boolean): Promise<void>;
}

export interface TreeSlotReconcilerOptions {
  /** Wall clock for the orphan grace. Inject for tests. */
  now?: () => number;
}

/** Persisted-array positions per uid; absent → after every listed uid, by uid. */
type UidOrder = ReadonlyMap<string, number>;

/** Cross-pass memory: what this host has seen slotted, and since when each orphan has waited. */
interface ReconcilerMemory {
  everSlotted: Set<string>;
  orphanSince: Map<string, number>;
}

interface Pass {
  bodies: MutationBody[];
  rehomes: RehomePlan[];
  tail: (parent: ParentRefShape, setPath: string) => string;
  /** Hydration: persisted order + immediate rehome. */
  settled: boolean;
  now: number;
  /** Orphans seen this pass — the grace map is pruned to them. */
  orphans: Set<string>;
  /** An orphan is still inside its grace — schedule a follow-up pass. */
  deferred: boolean;
}

export function createTreeSlotReconciler(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
  contextFactory: SwMutatorContextFactory,
  options: TreeSlotReconcilerOptions = {},
): TreeSlotReconciler {
  const now = options.now ?? Date.now;
  const memory: ReconcilerMemory = { everSlotted: new Set(), orphanSince: new Map() };
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: Promise<void> | null = null;

  const reconcile = async (persistedOrder = false): Promise<void> => {
    if (running) {
      await running;
    }
    running = runPass(workspaceId, oracle, contextFactory, memory, persistedOrder, now())
      .then((deferred) => {
        if (deferred) schedule(REHOME_GRACE_MS);
      })
      .finally(() => {
        running = null;
      });
    await running;
  };

  const schedule = (delayMs: number): void => {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void reconcile().catch((err: unknown) => {
        logger.info('TreeSlotReconciler', `pass failed (ws=${workspaceId}): ${(err as Error).message}`);
      });
    }, delayMs);
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!armed || !triggersPass(event.envelope.body, event.applyOrigin)) return;
    schedule(RECONCILE_DEBOUNCE_MS);
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

/**
 * A slot-less create, any containment set write (a merged move can
 * shadow a slot or close a cycle) or a container delete (its children
 * may be orphans now) — all inbound, local gestures are well-formed by
 * construction — plus ANY collection create: a child waiting for a
 * root to be rehomed onto gets one.
 */
function triggersPass(body: MutationBody, applyOrigin: BroadcastEvent['applyOrigin']): boolean {
  if (body.kind === 'create' && COLLECTION_TYPES.has(body.type)) return true;
  if (applyOrigin !== 'inbound') return false;
  if (body.kind === 'create') return SEEDED_TYPES.has(body.type);
  if (body.kind === 'delete') return CONTAINER_TYPES.has(body.type);
  return TREES.some((tree) => affectsTreeContainment(body, tree.kinds));
}

/** Returns whether an orphan is still inside its grace (a follow-up pass is owed). */
async function runPass(
  workspaceId: string,
  oracle: EntityOracle,
  contextFactory: SwMutatorContextFactory,
  memory: ReconcilerMemory,
  settled: boolean,
  now: number,
): Promise<boolean> {
  const pass: Pass = {
    bodies: [],
    rehomes: [],
    tail: createTailTracker((type, id, setPath) =>
      oracle
        .liveOrderedSetItems(type, id, setPath)
        .map((entry) => ({ itemId: entry.itemId, item: entry.item, orderKey: entry.key })),
    ),
    settled,
    now,
    orphans: new Set(),
    deferred: false,
  };
  for (const tree of TREES) {
    await reconcileTree(workspaceId, oracle, tree, memory, pass);
  }
  for (const key of memory.orphanSince.keys()) {
    if (!pass.orphans.has(key)) memory.orphanSince.delete(key);
  }
  if (pass.bodies.length === 0) return pass.deferred;

  const ctx = { ...contextFactory(), batchId: `tree-reconcile-${newBatchId()}` };
  const result = await oracle.apply(mintBatch(ctx, pass.bodies), [], 'inbound');
  if (!result.ok) {
    logger.info(
      'TreeSlotReconciler',
      `pass failed (ws=${workspaceId}): ${result.failure?.status} — ${result.failure?.detail ?? 'no detail'}`,
    );
    return pass.deferred;
  }
  logger.info(
    'TreeSlotReconciler',
    `applied ${pass.bodies.length} body(ies), ${pass.rehomes.length} rehome(s) for ws=${workspaceId}`,
  );
  for (const plan of pass.rehomes) {
    const landed = result.outcomes.find(({ envelope }) => landsRehome(envelope, plan));
    if (!landed) continue;
    const originalParentAlive =
      plan.from !== null && oracle.materializeOne(plan.from.parent.type, plan.from.parent.uid) !== null;
    recordHostActivityEntry(rehomeActivityEntry(landed.envelope, plan, originalParentAlive, now));
  }
  return pass.deferred;
}

function landsRehome(envelope: MutationEnvelope, plan: RehomePlan): boolean {
  const body = envelope.body;
  return (
    body.kind === 'addToSet' &&
    body.type === plan.to.parent.type &&
    body.id === plan.to.parent.uid &&
    body.path === plan.to.setPath &&
    body.itemId === plan.child.uid
  );
}

async function reconcileTree<C extends string, F extends string>(
  workspaceId: string,
  oracle: EntityOracle,
  tree: TreeSpec<C, F>,
  memory: ReconcilerMemory,
  pass: Pass,
): Promise<void> {
  const materialized = treeMaterialized(oracle, tree.kinds);
  const containers = treeContainers(oracle, tree.kinds);
  const liveContainers = new Set<string>([
    ...containers.collections.map((c) => c.uid),
    ...containers.folders.map((f) => f.uid),
  ]);

  // Heal the store to the projection: tombstone every slot the index
  // dropped; a cycle victim has no live parent left and rehomes in the
  // same batch.
  const conflicts = treeConflicts(oracle, tree.kinds);
  for (const slot of conflicts.shadowed) pass.bodies.push(slotTombstone(slot));
  for (const slot of conflicts.deadSlots) {
    if (settled(memory, pass, `slot:${slot.parent.type}:${slot.parent.uid}:${slot.childUid}`)) {
      pass.bodies.push(slotTombstone(slot));
    }
  }
  const victims = new Set<string>();
  for (const slot of conflicts.cycleVictims) {
    victims.add(slot.childUid);
    pass.bodies.push(slotTombstone(slot));
    planRehome(workspaceId, oracle, tree, containers, liveContainers, pass, {
      child: { type: tree.kinds.folderType, uid: slot.childUid },
      from: slot,
      reason: 'cycle',
      storedPath: null,
    });
  }

  // Collections without a roots slot — today's uid order unless the
  // persisted array says otherwise.
  const rooted = new Set(
    oracle.liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, tree.rootsPath).map((e) => e.itemId),
  );
  const collectionOrder = pass.settled ? await readOrder(tree.collectionStorageKey(workspaceId)) : new Map();
  const collections = materialized.filter((m) => m.type === tree.kinds.collectionType && !rooted.has(m.id));
  for (const m of sortByOrder(collections, collectionOrder)) {
    pass.bodies.push(
      tree.collectionChild.slotAdd(m.id, WORKSPACE_ROOTS_REF, pass.tail(WORKSPACE_ROOTS_REF, tree.rootsPath)),
    );
  }

  // Folders carry no stored path: a slot-less folder that is not this
  // pass's cycle victim is an orphan (its container was tombstoned).
  for (const m of materialized) {
    if (m.type !== tree.kinds.folderType || victims.has(m.id)) continue;
    if (hasTreeSlot(oracle, tree.kinds, m.id)) {
      memory.everSlotted.add(entityKey(m));
      continue;
    }
    if (!settled(memory, pass, entityKey(m))) continue;
    planRehome(workspaceId, oracle, tree, containers, liveContainers, pass, {
      child: { type: m.type, uid: m.id },
      from: null,
      reason: 'orphan',
      storedPath: null,
    });
  }

  for (const leaf of tree.leaves) {
    const order = pass.settled ? await readOrder(leaf.storageKey(workspaceId)) : new Map();
    const slotless: MaterializedEntity[] = [];
    for (const m of materialized) {
      if (m.type !== leaf.entityType) continue;
      if (hasTreeSlot(oracle, tree.kinds, m.id)) memory.everSlotted.add(entityKey(m));
      else slotless.push(m);
    }
    for (const m of sortByOrder(slotless, order)) {
      const path = storedPath(m.data);
      const parentPath = path === null ? null : parentPathOf(path);
      const parent = parentPath === null ? null : resolveTreeParent(parentPath, containers, tree.parentKinds);
      // A leaf this host never saw slotted is an old-client or
      // in-flight create: its stored path is where its author put it.
      if (parent && liveContainers.has(parent.uid) && !memory.everSlotted.has(entityKey(m))) {
        pass.bodies.push(leaf.child.slotAdd(m.id, parent, pass.tail(parent, tree.itemsPath)));
        continue;
      }
      if (!settled(memory, pass, entityKey(m))) continue;
      planRehome(workspaceId, oracle, tree, containers, liveContainers, pass, {
        child: { type: m.type, uid: m.id },
        from: null,
        reason: 'orphan',
        storedPath: path,
      });
    }
  }
}

/**
 * Runtime orphans and dead-child slots wait out {@link REHOME_GRACE_MS}
 * from the pass that first saw them; hydration heals at once.
 */
function settled(memory: ReconcilerMemory, pass: Pass, key: string): boolean {
  pass.orphans.add(key);
  if (pass.settled) return true;
  const since = memory.orphanSince.get(key) ?? pass.now;
  memory.orphanSince.set(key, since);
  if (pass.now - since >= REHOME_GRACE_MS) return true;
  pass.deferred = true;
  return false;
}

interface RehomeInput {
  child: { type: string; uid: string };
  from: TreeSlotRecord | null;
  reason: RehomeReason;
  storedPath: string | null;
}

/**
 * Re-attach one child to a collection root of its tree: the collection
 * of its stored path when that is live, else the first live collection
 * in roots order. With none, a child whose own collection is known
 * deleted follows it (invariant 11: leaves have no root to live
 * under); otherwise it waits slot-less for a collection to appear.
 */
function planRehome<C extends string, F extends string>(
  workspaceId: string,
  oracle: EntityOracle,
  tree: TreeSpec<C, F>,
  containers: TreeContainers,
  liveContainers: ReadonlySet<string>,
  pass: Pass,
  input: RehomeInput,
): void {
  const home = rehomeRoot(oracle, tree, containers, liveContainers, input.storedPath);
  if (home.verdict === 'deleted') {
    logger.info(
      'TreeSlotReconciler',
      `${input.child.type} ${input.child.uid}: its collection is deleted and no other is live — delete-wins extends to it (ws=${workspaceId})`,
    );
    pass.bodies.push({ kind: 'delete', type: input.child.type, id: input.child.uid });
    return;
  }
  if (home.verdict === 'unknown') {
    logger.info(
      'TreeSlotReconciler',
      `${input.child.type} ${input.child.uid} stays slot-less — no live collection to rehome to (ws=${workspaceId})`,
    );
    return;
  }
  const root = home.root;
  const isFolder = input.child.type === tree.kinds.folderType;
  const setPath = isFolder ? tree.kinds.childrenPath : tree.itemsPath;
  const child = isFolder ? tree.folderChild : tree.leaves.find((leaf) => leaf.entityType === input.child.type)?.child;
  if (!child) return;
  pass.bodies.push(child.slotAdd(input.child.uid, root, pass.tail(root, setPath)));
  pass.rehomes.push({ child: input.child, from: input.from, to: { parent: root, setPath }, reason: input.reason });
  logger.info(
    'TreeSlotReconciler',
    `rehoming ${input.child.type} ${input.child.uid} (${input.reason}) to ${root.type} ${root.uid} (ws=${workspaceId})`,
  );
}

type RehomeHome<C extends string, F extends string> =
  | { verdict: 'root'; root: TreeParentRef<C, F> }
  | { verdict: 'deleted' }
  | { verdict: 'unknown' };

function rehomeRoot<C extends string, F extends string>(
  oracle: EntityOracle,
  tree: TreeSpec<C, F>,
  containers: TreeContainers,
  liveContainers: ReadonlySet<string>,
  storedPath: string | null,
): RehomeHome<C, F> {
  const segments = storedPath?.split('/') ?? [];
  const own =
    segments.length >= 2 ? resolveTreeParent(segments.slice(0, 2).join('/'), containers, tree.parentKinds) : null;
  if (own && own.type === tree.kinds.collectionType && liveContainers.has(own.uid))
    return { verdict: 'root', root: own };
  const roots = oracle.liveOrderedSetItems(WORKSPACE_ROOTS_ENTITY_TYPE, WORKSPACE_ROOTS_ID, tree.rootsPath);
  const first = roots.find((slot) => liveContainers.has(slot.itemId))?.itemId ?? containers.collections[0]?.uid;
  if (first !== undefined) return { verdict: 'root', root: { type: tree.kinds.collectionType, uid: first } };
  const ownDeleted = own !== null && oracle.isTombstoned(own.type, own.uid);
  return { verdict: ownDeleted ? 'deleted' : 'unknown' };
}

function slotTombstone(slot: TreeSlotRecord): MutationBody {
  return {
    kind: 'removeFromSet',
    type: slot.parent.type,
    id: slot.parent.uid,
    path: slot.setPath,
    itemId: slot.childUid,
  };
}

function entityKey(m: MaterializedEntity): string {
  return `${m.type}:${m.id}`;
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
