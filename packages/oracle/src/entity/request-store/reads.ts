// ── Reads ────────────────────────────────────────────────────────────

import {
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { Collection, CollectionTree, Request, TreeNode } from '@openheaders/core/types';
import type { PersistedLocalFolder } from '@openheaders/oracle/storage';
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

/** Build CollectionTree[] from flat collections + folders + requests. */
export function getRequestCollectionTrees(): CollectionTree[] {
  return collections.map((collection) => {
    const tree = buildTreeForParent(REQUEST_COLLECTION_ENTITY_TYPE, collection.uid, collection.path);
    return { ...collection, tree };
  });
}

/**
 * Build TreeNode[] for the children of a request-collection or
 * request-folder. Folder siblings render in the order carried by the
 * parent's `folders` set (§7.2 + §23.5). Requests inside the same
 * parent keep their cache-array order — requests don't live in a
 * parent set today.
 */
function buildTreeForParent(
  parentType: typeof REQUEST_COLLECTION_ENTITY_TYPE | typeof REQUEST_FOLDER_ENTITY_TYPE,
  parentUid: string,
  parentPath: string,
): TreeNode[] {
  const nodes: TreeNode[] = [];

  const oracle = getOracleForCurrentWorkspace();
  const slots = oracle ? oracle.liveOrderedSetItems(parentType, parentUid, REQUEST_FOLDER_CHILDREN_PATH) : [];

  let childFolders: PersistedLocalFolder[];
  if (slots.length > 0) {
    const byUid = new Map(folders.map((f) => [f.uid, f]));
    childFolders = slots.map((slot) => byUid.get(slot.itemId)).filter((f): f is PersistedLocalFolder => Boolean(f));
  } else {
    childFolders = folders.filter((f) => f.path.substring(0, f.path.lastIndexOf('/')) === parentPath);
  }

  for (const folder of childFolders) {
    nodes.push({
      type: 'folder',
      uid: folder.uid,
      name: folder.name,
      path: folder.path,
      children: buildTreeForParent(REQUEST_FOLDER_ENTITY_TYPE, folder.uid, folder.path),
    });
  }

  const childRequests = requests.filter((r) => r.path.substring(0, r.path.lastIndexOf('/')) === parentPath);
  for (const request of childRequests) {
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
