/**
 * Tree-order cache — persists every container's child order of the
 * three sidebar trees to `wsKeys(scope).treeOrder`.
 *
 * The persisted entity arrays are written in tree order, but the four
 * request kinds persist as four arrays, so the interleave inside one
 * `items` set has no home there; folder order likewise lives only in
 * array position. This record folds the live `folders` and `items`
 * sets of every collection and folder — uids in slot order, keyed by
 * `<type>:<uid>` — and is what the restart re-seed (the tree slot
 * reconciler for leaves, the folder caches for folders) replays
 * before falling back to the arrays. Containers with no children
 * carry no entry; a stale entry for a container that no longer
 * exists is ignored by every reader.
 */

import { TreeOrderRecordSchema } from '@openheaders/core/schemas';
import {
  EMPTY_TREE_ORDER,
  type TreeContainerOrder,
  type TreeOrderRecord,
  treeContainerKey,
} from '@openheaders/core/types';
import { logger } from '@openheaders/core/utils';
import { hostStorage, wsKeys } from '@openheaders/oracle/storage';
import type { BroadcastEvent, InMemoryBroadcast } from '../broadcast';
import type { EntityCacheLike } from '../entity-registry';
import type { EntityOracle } from '../oracle';
import { RULE_TREE } from '../post-state/folder-post-state';
import { affectsTreeContainment, type FolderTreeKinds, treeMaterialized } from '../post-state/folder-tree-post-state';
import { REQUEST_TREE } from '../post-state/request-folder-post-state';
import { TEMPLATE_TREE } from '../post-state/template-folder-post-state';
import { driftRecorder } from '../storage-drift';

const TREES: ReadonlyArray<FolderTreeKinds> = [RULE_TREE, REQUEST_TREE, TEMPLATE_TREE];

const CONTAINER_TYPES: ReadonlySet<string> = new Set(TREES.flatMap((tree) => [tree.collectionType, tree.folderType]));

export interface TreeOrderCache extends EntityCacheLike {
  readonly workspaceId: string;
  getTreeOrder(): TreeOrderRecord;
}

/** Fold the live sets of every container into the record. Pure over the oracle. */
export function projectTreeOrder(oracle: EntityOracle): TreeOrderRecord {
  const containers: Record<string, TreeContainerOrder> = {};
  for (const tree of TREES) {
    for (const m of treeMaterialized(oracle, tree)) {
      if (m.type !== tree.collectionType && m.type !== tree.folderType) continue;
      const folders = oracle.liveOrderedSetItems(m.type, m.id, tree.childrenPath).map((slot) => slot.itemId);
      const items = oracle.liveOrderedSetItems(m.type, m.id, tree.itemsPath).map((slot) => slot.itemId);
      if (folders.length === 0 && items.length === 0) continue;
      containers[treeContainerKey(m.type, m.id)] = { folders, items };
    }
  }
  return { schemaVersion: 5, containers };
}

/**
 * Child-uid ranks across every container of the record: a child's
 * position in its parent's set. Positions of different parents share
 * one map — siblings are only ever compared with each other.
 */
export function treeOrderRanks(record: TreeOrderRecord): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>();
  for (const entry of Object.values(record.containers)) {
    for (const [index, uid] of entry.folders.entries()) ranks.set(uid, index);
    for (const [index, uid] of entry.items.entries()) ranks.set(uid, index);
  }
  return ranks;
}

/** The persisted record's ranks, for a restart re-seed; empty when nothing is persisted. */
export async function loadTreeOrderRanks(workspaceId: string): Promise<ReadonlyMap<string, number>> {
  const key = wsKeys(workspaceId).treeOrder;
  const record = await hostStorage.getValidated(key, TreeOrderRecordSchema, {
    onError: driftRecorder({ subsystem: 'workspace', storageKey: key.key, workspaceId }),
  });
  return treeOrderRanks(record ?? EMPTY_TREE_ORDER);
}

export function createTreeOrderCache(
  workspaceId: string,
  oracle: EntityOracle,
  broadcast: InMemoryBroadcast,
): TreeOrderCache {
  let record: TreeOrderRecord = EMPTY_TREE_ORDER;
  // The persisted record is what THIS boot's re-seed reads; it must
  // not be overwritten by the seeding batches' own slot writes before
  // the reconciler has read it, so the cache stays quiet until its
  // hydrate — which runs after the re-seed.
  let armed = false;

  const refreshFromOracle = (): void => {
    record = projectTreeOrder(oracle);
    void hostStorage.set(wsKeys(workspaceId).treeOrder, record).catch((err: unknown) => {
      logger.info('TreeOrderCache', `persist failed (ws=${workspaceId}):`, (err as Error).message);
    });
  };

  const unsubscribe = broadcast.subscribe((event: BroadcastEvent) => {
    if (!armed || !affectsTreeOrder(event)) return;
    refreshFromOracle();
  });

  return {
    workspaceId,
    getTreeOrder: () => record,
    async hydrateFromStorage(): Promise<void> {
      armed = true;
      refreshFromOracle();
    },
    dispose(): void {
      unsubscribe();
    },
  };
}

/** A slot write on any tree, or a container's own lifecycle (its entry appears or goes). */
function affectsTreeOrder(event: BroadcastEvent): boolean {
  const body = event.envelope.body;
  if (TREES.some((tree) => affectsTreeContainment(body, tree))) return true;
  return (body.kind === 'create' || body.kind === 'delete') && CONTAINER_TYPES.has(body.type);
}
