/**
 * Shared parent-walk + path-resolution for the three folder-tree
 * post-state projectors (collection-folder, request-folder,
 * template-folder).
 *
 * Each tree has the same shape: a root entity type ("collection") that
 * owns a `folders` set on its children path, and a folder entity type
 * that may nest under either kind. `Folder.path` is reconstructed
 * from the parent walk — sibling order + parent linkage live on the
 * parent's `folders` set (§23.5). Parent-linkage that can't be
 * resolved (mid-batch boot replay; tombstoned parent) is reported as
 * `null`; the cache republishes once the chain becomes resolvable.
 *
 * Caches don't read each other; this projector reads everything off
 * the shared oracle, which already holds collection + folder state in
 * one document store.
 */

import type { MaterializedEntity, MutationEnvelope } from '@openheaders/core/sync';
import type { Collection, Folder } from '@openheaders/core/types';
import { buildFolderChildrenOrderKeys } from './folder-children-order-keys';
import type { EntityOracle } from '../oracle';

type Reads = Pick<EntityOracle, 'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems'>;

/**
 * Per-tree configuration. The two entity-type constants + the children
 * path are the only branch identity the walker needs; the projector
 * pair lifts each materialized entity into its `Collection` /
 * `Folder` shape.
 */
export interface FolderTreeKinds<C extends string = string, F extends string = string> {
  collectionType: C;
  folderType: F;
  childrenPath: string;
  projectCollection: (materialized: MaterializedEntity) => Collection | null;
  projectFolder: (materialized: MaterializedEntity, parentPath: string) => Folder | null;
}

/**
 * Per-envelope post-state: only fires for envelopes whose body targets
 * the folder entity directly. Envelopes that touch a parent's
 * `folders` set republish through the cache's full-refresh path
 * (paths can shift when a parent renames or reparents).
 */
export interface FolderPostStateProjection {
  folder: Folder;
  /** Live `(itemId, orderKey)` pairs at the folder's own `folders` set
   *  — the slot list for nested child folders. Keyed by setPath
   *  (`'folders'`) for shape consistency with other entities. */
  setOrderKeys: Record<string, Array<{ itemId: string; orderKey: string }>>;
}

export function projectFolderPostStateGeneric<C extends string, F extends string>(
  oracle: Reads,
  envelope: MutationEnvelope,
  kinds: FolderTreeKinds<C, F>,
): FolderPostStateProjection | null {
  if (envelope.body.type !== kinds.folderType) return null;
  return projectFolderByUidGeneric(oracle, envelope.body.id, kinds);
}

/**
 * Project a known folder uid. Used by the snapshot RPC + the cache's
 * broadcast-driven refresh path.
 */
export function projectFolderByUidGeneric<C extends string, F extends string>(
  oracle: Reads,
  folderUid: string,
  kinds: FolderTreeKinds<C, F>,
): FolderPostStateProjection | null {
  const materialized = oracle.materializeOne(kinds.folderType, folderUid);
  if (!materialized) return null;

  const parentPath = resolveParentPath(oracle, folderUid, kinds);
  if (parentPath === null) return null;

  const folder = kinds.projectFolder(materialized, parentPath);
  if (!folder) return null;

  return {
    folder,
    setOrderKeys: buildFolderChildrenOrderKeys(oracle, kinds.folderType, folderUid, kinds.childrenPath),
  };
}

/**
 * Project every folder the oracle holds under this tree. Skips folders
 * whose parent linkage isn't currently resolvable; those republish
 * once their parent slot lands.
 */
export function projectAllFoldersGeneric<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): Folder[] {
  const materialized = oracle.materializeAll();
  const out: Folder[] = [];
  for (const m of materialized) {
    if (m.type !== kinds.folderType) continue;
    const parentPath = resolveParentPath(oracle, m.id, kinds);
    if (parentPath === null) continue;
    const folder = kinds.projectFolder(m, parentPath);
    if (folder) out.push(folder);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}

interface ParentRef {
  type: string;
  uid: string;
}

/**
 * Walk the oracle's full materialization to find which collection or
 * folder holds `folderUid` in its children-path set, then resolve that
 * parent's absolute path. Returns null when the slot has no live
 * parent. Folder graphs are trees in well-formed state, but a corrupt
 * persisted snapshot could carry a cycle; the visited guard bails
 * safely instead of looping forever.
 */
function resolveParentPath<C extends string, F extends string>(
  oracle: Reads,
  folderUid: string,
  kinds: FolderTreeKinds<C, F>,
): string | null {
  const materialized = oracle.materializeAll();
  const visited = new Set<string>();

  let current = findSlotParent(oracle, materialized, folderUid, kinds);
  if (!current) return null;

  const chain: ParentRef[] = [];
  while (current) {
    const key = `${current.type}:${current.uid}`;
    if (visited.has(key)) return null;
    visited.add(key);
    chain.push(current);
    if (current.type === kinds.collectionType) break;
    const nextParent: ParentRef | null = findSlotParent(oracle, materialized, current.uid, kinds);
    if (!nextParent) return null;
    current = nextParent;
  }

  // Innermost ancestor (collection) sits at the end of `chain`. Walk
  // root→leaf to assemble the absolute path.
  let path: string | null = null;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const node = chain[i];
    if (node.type === kinds.collectionType) {
      const collMat = oracle.materializeOne(kinds.collectionType, node.uid);
      if (!collMat) return null;
      const coll = kinds.projectCollection(collMat);
      if (!coll) return null;
      path = coll.path;
      continue;
    }
    if (path === null) return null;
    const folderMat = oracle.materializeOne(kinds.folderType, node.uid);
    if (!folderMat) return null;
    const folder = kinds.projectFolder(folderMat, path);
    if (!folder) return null;
    path = folder.path;
  }
  return path;
}

function findSlotParent<C extends string, F extends string>(
  oracle: Reads,
  materialized: MaterializedEntity[],
  childUid: string,
  kinds: FolderTreeKinds<C, F>,
): ParentRef | null {
  for (const m of materialized) {
    if (m.type !== kinds.collectionType && m.type !== kinds.folderType) continue;
    const slots = oracle.liveSetItems(m.type, m.id, kinds.childrenPath);
    for (const slot of slots) {
      if (slot.itemId === childUid) {
        return { type: m.type, uid: m.id };
      }
    }
  }
  return null;
}
