/**
 * Suite plan — resolve a `runs_execute` collection/folder target and
 * flatten its requests in sidebar tree order, from the same
 * post-state snapshots every MCP tool reads.
 *
 * Ordering is the request store's tree builder's
 * (`entity/request-store/reads.ts`): a container's child folders and
 * requests are ONE sequence — the parent's `folders` and `items` sets
 * merged by key, interleaved as the sidebar shows them — and a child
 * without a live slot follows by its stored path (`orderedChildren`).
 * Flattening is depth-first in that order.
 *
 * Target resolution is uid-first (a uid is never reinterpreted as a
 * name), then unique exact name; a folder ref additionally accepts a
 * `Collection/Folder[/Subfolder]` name walk for names that repeat
 * across collections. Ambiguity is an agent-correctable error naming
 * the candidate uids.
 */

import { mergeOrderedEntries, REQUEST_FOLDER_CHILDREN_PATH, REQUEST_FOLDER_ITEMS_PATH } from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
import { indexTreeChildren, type OrderedChild, orderedChildren } from '@openheaders/core/utils';
import {
  snapshotRequestCollectionPostStates,
  snapshotRequestFolderPostStates,
  snapshotRequestPostStates,
} from '@openheaders/oracle/sync/service';
import { McpToolInputError } from '../registry';

export interface SuitePlan {
  kind: 'collection' | 'folder';
  uid: string;
  name: string;
  path: string;
  /** The target's requests, flattened in sidebar tree order. */
  requests: Request[];
}

interface TreeParent {
  uid: string;
  name: string;
  path: string;
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export function resolveSuitePlan(workspaceId: string, kind: 'collection' | 'folder', ref: string): SuitePlan {
  const collections: TreeParent[] = snapshotRequestCollectionPostStates(workspaceId).map((ps) => ({
    uid: ps.collection.uid,
    name: ps.collection.name,
    path: ps.collection.path,
    setOrderKeys: ps.setOrderKeys,
  }));
  const folders: TreeParent[] = snapshotRequestFolderPostStates(workspaceId).map((ps) => ({
    uid: ps.folder.uid,
    name: ps.folder.name,
    path: ps.folder.path,
    setOrderKeys: ps.setOrderKeys,
  }));
  const requests = snapshotRequestPostStates(workspaceId).map((ps) => ps.request);
  const index = indexTreeChildren(
    folders,
    requests,
    (folder) => folder.path,
    (request) => request.path,
  );

  const children = (parent: TreeParent): OrderedChild<TreeParent, Request>[] => {
    const slots = mergeOrderedEntries(
      parent.setOrderKeys[REQUEST_FOLDER_CHILDREN_PATH] ?? [],
      parent.setOrderKeys[REQUEST_FOLDER_ITEMS_PATH] ?? [],
      (slot) => slot.orderKey,
      (slot) => slot.itemId,
    ).map((slot) => slot.itemId);
    return orderedChildren(index, parent.path, slots);
  };
  const childFolders = (parent: TreeParent): TreeParent[] =>
    children(parent).flatMap((child) => (child.kind === 'folder' ? [child.entity] : []));

  const collectRequests = (parent: TreeParent): Request[] => {
    const out: Request[] = [];
    for (const child of children(parent)) {
      if (child.kind === 'folder') out.push(...collectRequests(child.entity));
      else out.push(child.entity);
    }
    return out;
  };

  const target =
    kind === 'collection'
      ? resolveByRef(collections, ref, 'request collection', workspaceId)
      : resolveFolder(collections, folders, childFolders, ref, workspaceId);

  return { kind, uid: target.uid, name: target.name, path: target.path, requests: collectRequests(target) };
}

function resolveByRef(rows: TreeParent[], ref: string, what: string, workspaceId: string): TreeParent {
  const byUid = rows.find((row) => row.uid === ref);
  if (byUid) return byUid;
  const byName = rows.filter((row) => row.name === ref);
  const [match] = byName;
  if (match !== undefined && byName.length === 1) return match;
  if (byName.length > 1) {
    throw new McpToolInputError(
      `${what} name '${ref}' is ambiguous — use a uid: ${byName.map((row) => row.uid).join(', ')}`,
    );
  }
  throw new McpToolInputError(`no ${what} matching '${ref}' in workspace '${workspaceId}'`);
}

function resolveFolder(
  collections: TreeParent[],
  folders: TreeParent[],
  orderedChildFolders: (parent: TreeParent) => TreeParent[],
  ref: string,
  workspaceId: string,
): TreeParent {
  if (ref.includes('/')) {
    // A `Collection/Folder[/Subfolder]` name walk — each segment
    // resolves among the current parent's own children, so names that
    // repeat elsewhere in the workspace stay unambiguous.
    const [collectionRef, ...segments] = ref.split('/');
    let parent = resolveByRef(collections, collectionRef ?? '', 'request collection', workspaceId);
    for (const segment of segments) {
      parent = resolveByRef(orderedChildFolders(parent), segment, `folder under '${parent.name}'`, workspaceId);
    }
    return parent;
  }
  return resolveByRef(folders, ref, 'request folder', workspaceId);
}
