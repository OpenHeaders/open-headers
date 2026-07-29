/**
 * Suite plan — resolve a `runs_execute` collection/folder target and
 * flatten its requests in sidebar tree order, from the same
 * post-state snapshots every MCP tool reads.
 *
 * Ordering mirrors the request store's tree builder
 * (`entity/request-store/reads.ts`): child folders ride the parent's
 * ordered `folders` set when it carries slots (order keys sort
 * lexicographically — the `keyBetween` contract) and fall back to
 * path-parent matching otherwise; requests keep their cache-array
 * order within a parent. Flattening is depth-first, folders before
 * the parent's own requests — the order the sidebar shows.
 *
 * Target resolution is uid-first (a uid is never reinterpreted as a
 * name), then unique exact name; a folder ref additionally accepts a
 * `Collection/Folder[/Subfolder]` name walk for names that repeat
 * across collections. Ambiguity is an agent-correctable error naming
 * the candidate uids.
 */

import { REQUEST_FOLDER_CHILDREN_PATH } from '@openheaders/core/sync';
import type { Request } from '@openheaders/core/types';
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

function parentDir(path: string): string {
  return path.substring(0, path.lastIndexOf('/'));
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

  const orderedChildFolders = (parent: TreeParent): TreeParent[] => {
    const slots = parent.setOrderKeys[REQUEST_FOLDER_CHILDREN_PATH] ?? [];
    if (slots.length > 0) {
      const byUid = new Map(folders.map((folder) => [folder.uid, folder]));
      return [...slots]
        .sort((a, b) => (a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0))
        .map((slot) => byUid.get(slot.itemId))
        .filter((folder): folder is TreeParent => folder !== undefined);
    }
    return folders.filter((folder) => parentDir(folder.path) === parent.path);
  };

  const collectRequests = (parent: TreeParent): Request[] => {
    const out: Request[] = [];
    for (const child of orderedChildFolders(parent)) {
      out.push(...collectRequests(child));
    }
    out.push(...requests.filter((request) => parentDir(request.path) === parent.path));
    return out;
  };

  const target =
    kind === 'collection'
      ? resolveByRef(collections, ref, 'request collection', workspaceId)
      : resolveFolder(collections, folders, orderedChildFolders, ref, workspaceId);

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
