// ── Reads ────────────────────────────────────────────────────────────

import { REQUEST_COLLECTION_ENTITY_TYPE, REQUEST_FOLDER_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Collection, CollectionTree, Request, TreeNode } from '@openheaders/core/types';
import { indexTreeChildren, orderedChildren, type TreeChildIndex } from '@openheaders/core/utils';
import { REQUEST_TREE } from '@openheaders/oracle/sync/post-state/request-folder-post-state';
import { getOracleForCurrentWorkspace } from '@openheaders/oracle/sync/service/accessors';
import { mergedChildSlots } from '@openheaders/oracle/sync/tree-child-slots';
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
 * request-folder: folders and requests in ONE order — the parent's
 * `folders` and `items` sets merged by key (§7.2 + §23.5). Children
 * without a live slot yet follow by their stored path
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
  const slots = oracle
    ? mergedChildSlots(oracle, REQUEST_TREE, parentType, parentUid).map((slot) => slot.itemId)
    : null;

  for (const child of orderedChildren(index, parentPath, slots)) {
    if (child.kind === 'folder') {
      const folder = child.entity;
      nodes.push({
        type: 'folder',
        uid: folder.uid,
        name: folder.name,
        path: folder.path,
        children: buildTreeForParent(index, REQUEST_FOLDER_ENTITY_TYPE, folder.uid, folder.path),
      });
      continue;
    }
    const request = child.entity;
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
