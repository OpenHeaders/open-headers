/**
 * Per-envelope request-folder post-state projection.
 *
 * Same shape as `folder-post-state.ts` for the request-folder entity
 * type. `V5.Folder.path` is reconstructed from the parent walk —
 * sibling order + parent linkage live on the parent's `folders` set
 * (§23.5). The projector walks every request-collection +
 * request-folder in the oracle to find which parent holds the target
 * folder's slot, then prefixes the parent's resolved path. Returns
 * null when the parent linkage cannot be resolved (e.g. mid-batch boot
 * replay where the parent hasn't seeded yet) — the next folder/parent
 * broadcast republishes the post-state once the chain resolves.
 */

import type { SyncRequestFolderPostState } from '@openheaders/core/protocol';
import {
  type MaterializedEntity,
  type MutationEnvelope,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { projectRequestCollection } from '@/shared/sync/request-collection-projection';
import { projectRequestFolder } from '@/shared/sync/request-folder-projection';
import type { EntityOracle } from './oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'materializeAll' | 'liveSetItems'>;

export function projectRequestFolderPostState(
  oracle: Reads,
  envelope: MutationEnvelope,
): SyncRequestFolderPostState | null {
  if (envelope.body.type !== REQUEST_FOLDER_ENTITY_TYPE) return null;
  return projectRequestFolderByUid(oracle, envelope.body.id);
}

export function projectRequestFolderByUid(
  oracle: Reads,
  folderUid: string,
): SyncRequestFolderPostState | null {
  const materialized = oracle.materializeOne(REQUEST_FOLDER_ENTITY_TYPE, folderUid);
  if (!materialized) return null;

  const parentPath = resolveParentPath(oracle, folderUid);
  if (parentPath === null) return null;

  const folder = projectRequestFolder(materialized, parentPath);
  if (!folder) return null;

  return { folder };
}

interface ParentRef {
  type: typeof REQUEST_COLLECTION_ENTITY_TYPE | typeof REQUEST_FOLDER_ENTITY_TYPE;
  uid: string;
}

function resolveParentPath(oracle: Reads, folderUid: string): string | null {
  const materialized = oracle.materializeAll();
  const visited = new Set<string>();

  let current = findSlotParent(oracle, materialized, folderUid);
  if (!current) return null;

  const chain: ParentRef[] = [];
  while (current) {
    if (visited.has(`${current.type}:${current.uid}`)) return null;
    visited.add(`${current.type}:${current.uid}`);
    chain.push(current);
    if (current.type === REQUEST_COLLECTION_ENTITY_TYPE) break;
    const next = findSlotParent(oracle, materialized, current.uid);
    if (!next) return null;
    current = next;
  }

  let path: string | null = null;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const node = chain[i];
    if (node.type === REQUEST_COLLECTION_ENTITY_TYPE) {
      const collMat = oracle.materializeOne(REQUEST_COLLECTION_ENTITY_TYPE, node.uid);
      if (!collMat) return null;
      const coll = projectRequestCollection(collMat);
      if (!coll) return null;
      path = coll.path;
      continue;
    }
    if (path === null) return null;
    const folderMat = oracle.materializeOne(REQUEST_FOLDER_ENTITY_TYPE, node.uid);
    if (!folderMat) return null;
    const folder = projectRequestFolder(folderMat, path);
    if (!folder) return null;
    path = folder.path;
  }
  return path;
}

function findSlotParent(
  oracle: Reads,
  materialized: MaterializedEntity[],
  childUid: string,
): ParentRef | null {
  for (const m of materialized) {
    if (m.type !== REQUEST_COLLECTION_ENTITY_TYPE && m.type !== REQUEST_FOLDER_ENTITY_TYPE) continue;
    const slots = oracle.liveSetItems(m.type, m.id, REQUEST_FOLDER_CHILDREN_PATH);
    for (const slot of slots) {
      if (slot.itemId === childUid) {
        return { type: m.type as ParentRef['type'], uid: m.id };
      }
    }
  }
  return null;
}

/**
 * Project the full set of request-folders the oracle holds. Used by
 * the cache to mirror oracle state into `chrome.storage.local`. Skips
 * folders whose parent linkage isn't currently resolvable; those
 * republish once their parent slot lands.
 */
export function projectAllRequestFolders(oracle: Reads): V5.Folder[] {
  const materialized = oracle.materializeAll();
  const out: V5.Folder[] = [];
  for (const m of materialized) {
    if (m.type !== REQUEST_FOLDER_ENTITY_TYPE) continue;
    const parentPath = resolveParentPath(oracle, m.id);
    if (parentPath === null) continue;
    const folder = projectRequestFolder(m, parentPath);
    if (folder) out.push(folder);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}
