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
import type { EntityOracle } from '../oracle';
import { buildFolderChildrenOrderKeys } from './folder-children-order-keys';

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
  return projectFolderWithIndex(oracle, buildTreeIndex(oracle, kinds), folderUid, kinds);
}

/**
 * Project every folder the oracle holds under this tree. Skips folders
 * whose parent linkage isn't currently resolvable; those republish
 * once their parent slot lands. One index build + memoized path
 * resolution keeps the whole projection linear in entity count —
 * this runs on every folder-affecting broadcast, so a per-folder
 * parent scan here turns bulk seeding quadratic.
 */
export function projectAllFoldersGeneric<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): Folder[] {
  const index = buildTreeIndex(oracle, kinds);
  const out: Folder[] = [];
  for (const m of index.materialized) {
    if (m.type !== kinds.folderType) continue;
    const parentPath = resolveParentPath(oracle, index, m.id, kinds);
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
 * One-pass view of the tree: every live parent slot inverted into a
 * `childUid → parent` map, plus a memo of resolved absolute paths.
 * Parent linkage is unique per child (each uid occupies one slot), so
 * the inverted map loses nothing the slot scan had.
 */
interface FolderTreeIndex {
  materialized: MaterializedEntity[];
  parentOf: Map<string, ParentRef>;
  /** Memoized absolute path per `type:uid` node; null = unresolvable. */
  pathOf: Map<string, string | null>;
}

function buildTreeIndex<C extends string, F extends string>(
  oracle: Reads,
  kinds: FolderTreeKinds<C, F>,
): FolderTreeIndex {
  const materialized = oracle.materializeAll();
  const parentOf = new Map<string, ParentRef>();
  for (const m of materialized) {
    if (m.type !== kinds.collectionType && m.type !== kinds.folderType) continue;
    for (const slot of oracle.liveSetItems(m.type, m.id, kinds.childrenPath)) {
      parentOf.set(slot.itemId, { type: m.type, uid: m.id });
    }
  }
  return { materialized, parentOf, pathOf: new Map() };
}

function projectFolderWithIndex<C extends string, F extends string>(
  oracle: Reads,
  index: FolderTreeIndex,
  folderUid: string,
  kinds: FolderTreeKinds<C, F>,
): FolderPostStateProjection | null {
  const materialized = oracle.materializeOne(kinds.folderType, folderUid);
  if (!materialized) return null;

  const parentPath = resolveParentPath(oracle, index, folderUid, kinds);
  if (parentPath === null) return null;

  const folder = kinds.projectFolder(materialized, parentPath);
  if (!folder) return null;

  return {
    folder,
    setOrderKeys: buildFolderChildrenOrderKeys(oracle, kinds.folderType, folderUid, kinds.childrenPath),
  };
}

/**
 * Resolve the absolute path of `folderUid`'s parent via the index.
 * Returns null when the slot has no live parent or the chain doesn't
 * terminate at a collection.
 */
function resolveParentPath<C extends string, F extends string>(
  oracle: Reads,
  index: FolderTreeIndex,
  folderUid: string,
  kinds: FolderTreeKinds<C, F>,
): string | null {
  const parent = index.parentOf.get(folderUid);
  if (!parent) return null;
  return resolveNodePath(oracle, index, parent, kinds, new Set());
}

/**
 * Absolute path of a collection or folder node, memoized on the index.
 * Folder graphs are trees in well-formed state, but a corrupt persisted
 * snapshot could carry a cycle; the visiting guard bails safely instead
 * of recursing forever.
 */
function resolveNodePath<C extends string, F extends string>(
  oracle: Reads,
  index: FolderTreeIndex,
  node: ParentRef,
  kinds: FolderTreeKinds<C, F>,
  visiting: Set<string>,
): string | null {
  const key = `${node.type}:${node.uid}`;
  const memo = index.pathOf.get(key);
  if (memo !== undefined) return memo;
  if (visiting.has(key)) return null;
  visiting.add(key);

  let path: string | null = null;
  if (node.type === kinds.collectionType) {
    const collMat = oracle.materializeOne(kinds.collectionType, node.uid);
    const coll = collMat ? kinds.projectCollection(collMat) : null;
    path = coll ? coll.path : null;
  } else {
    const parent = index.parentOf.get(node.uid);
    const parentPath = parent ? resolveNodePath(oracle, index, parent, kinds, visiting) : null;
    if (parentPath !== null) {
      const folderMat = oracle.materializeOne(kinds.folderType, node.uid);
      const folder = folderMat ? kinds.projectFolder(folderMat, parentPath) : null;
      path = folder ? folder.path : null;
    }
  }

  visiting.delete(key);
  index.pathOf.set(key, path);
  return path;
}
