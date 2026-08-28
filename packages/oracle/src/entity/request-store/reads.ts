// ── Reads ────────────────────────────────────────────────────────────

import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
} from '@openheaders/core/sync';
import type { Collection, CollectionTree, Request, TreeNode } from '@openheaders/core/types';
import { indexTreeChildren, orderedChildren, type TreeChildIndex } from '@openheaders/core/utils';
import { getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { collections, folders, type LocalFolder, requests } from './state';

export function getRequests(): Request[] {
  return requests;
}

export function getRequestCollections(): Collection[] {
  return collections;
}

export function getRequestFolders(): LocalFolder[] {
  return folders;
}

/** Build CollectionTree[] from flat collections + folders + requests, collections in roots order. */
export function getRequestCollectionTrees(): CollectionTree[] {
  const index = indexTreeChildren(
    folders,
    requests,
    (f) => f.path,
    (r) => r.path,
  );
  return collections.map((collection) => {
    const tree = buildTreeForParent(index, REQUEST_COLLECTION_ENTITY_TYPE, collection.uid, collection.path);
    return { ...collection, tree };
  });
}

/**
 * Build TreeNode[] for the children of a request-collection or
 * request-folder: child folders first, then requests, each run in the
 * order carried by the parent's `folders` / `items` set (§7.2 + §23.5).
 * Children without a live slot yet follow by their stored path
 * (`orderedChildren`) — never require a slot on read.
 */
function buildTreeForParent(
  index: TreeChildIndex<LocalFolder, Request>,
  parentType: typeof REQUEST_COLLECTION_ENTITY_TYPE | typeof REQUEST_FOLDER_ENTITY_TYPE,
  parentUid: string,
  parentPath: string,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const oracle = getOracleForCurrentWorkspace();
  const slotUids = (setPath: string): string[] =>
    oracle ? oracle.liveOrderedSetItems(parentType, parentUid, setPath).map((slot) => slot.itemId) : [];
  const children = orderedChildren(index, parentPath, {
    folders: slotUids(REQUEST_FOLDER_CHILDREN_PATH),
    items: slotUids(REQUEST_FOLDER_ITEMS_PATH),
  });

  for (const folder of children.folders) {
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildTreeForParent(index, REQUEST_FOLDER_ENTITY_TYPE, folder.uid, folder.path),
    });
  }

  for (const request of children.leaves) {
    nodes.push({
      type: 'request',
      uid: request.uid,
      name: request.name,
      path: request.path,
      method: request.method,
    });
  }

  return nodes;
}
