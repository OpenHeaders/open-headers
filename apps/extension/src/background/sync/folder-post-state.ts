/**
 * Per-envelope folder post-state projection (Phase B Folder).
 *
 * Folder's `V5.Folder.path` is reconstructed from the parent walk —
 * sibling order + parent linkage live on the parent's `folders` set
 * (§23.5). The projector walks every collection + folder in the oracle
 * to find which parent holds the target folder's slot, then prefixes
 * the parent's resolved path. Returns null when the parent linkage
 * cannot be resolved (e.g. mid-batch boot replay where the parent
 * hasn't seeded yet) — the next folder/parent broadcast republishes
 * the post-state once the chain resolves.
 *
 * Caches don't read each other; this projector reads everything off
 * the shared oracle, which already holds collection + folder state in
 * one document store.
 */

import type { SyncFolderPostState } from '@openheaders/core/protocol';
import {
  COLLECTION_ENTITY_TYPE,
  FOLDER_CHILDREN_PATH,
  FOLDER_ENTITY_TYPE,
  type MaterializedEntity,
  type MutationEnvelope,
} from '@openheaders/core/sync';
import type { V5 } from '@openheaders/core/types';
import { projectCollection } from '@/shared/sync/collection-projection';
import { projectFolder } from '@/shared/sync/folder-projection';
import type { EntityOracle } from './oracle';

type FolderOracleReads = Pick<EntityOracle, 'materializeOne' | 'materializeAll' | 'liveSetItems'>;

/**
 * Build the folder post-state for `envelope` using `oracle`. Only
 * fires for envelopes whose body targets a folder entity directly —
 * envelopes that touch a parent's `folders` set republish the affected
 * folder via the cache's full-refresh path (paths can shift when a
 * parent renames or reparents).
 */
export function projectFolderPostState(
  oracle: FolderOracleReads,
  envelope: MutationEnvelope,
): SyncFolderPostState | null {
  if (envelope.body.type !== FOLDER_ENTITY_TYPE) return null;
  return projectFolderByUid(oracle, envelope.body.id);
}

/**
 * Build the folder post-state for a known uid. Used by the snapshot
 * RPC + the cache's broadcast-driven refresh path. Returns null when
 * the folder's parent linkage cannot be resolved — the cache
 * republishes once the chain becomes resolvable.
 */
export function projectFolderByUid(
  oracle: FolderOracleReads,
  folderUid: string,
): SyncFolderPostState | null {
  const materialized = oracle.materializeOne(FOLDER_ENTITY_TYPE, folderUid);
  if (!materialized) return null;

  const parentPath = resolveParentPath(oracle, folderUid);
  if (parentPath === null) return null;

  const folder = projectFolder(materialized, parentPath);
  if (!folder) return null;

  return { folder };
}

/**
 * Walk the oracle's full materialization to find which collection or
 * folder holds `folderUid` in its `folders` set, then resolve that
 * parent's absolute path. Returns null when the slot has no live
 * parent (mid-batch boot replay; tombstoned parent).
 */
function resolveParentPath(oracle: FolderOracleReads, folderUid: string): string | null {
  const materialized = oracle.materializeAll();
  // Visited guard — folder graphs are trees in well-formed state, but a
  // corrupt persisted snapshot could carry a cycle. Bail safely.
  const visited = new Set<string>();

  let current = findSlotParent(oracle, materialized, folderUid);
  if (!current) return null;

  // Build the path from the root downward — collect ancestors first, then
  // join. Root is always a collection (folders nest under collections only).
  const chain: Array<{ type: typeof COLLECTION_ENTITY_TYPE | typeof FOLDER_ENTITY_TYPE; uid: string }> = [];
  while (current) {
    if (visited.has(`${current.type}:${current.uid}`)) return null;
    visited.add(`${current.type}:${current.uid}`);
    chain.push(current);
    if (current.type === COLLECTION_ENTITY_TYPE) break;
    const next = findSlotParent(oracle, materialized, current.uid);
    if (!next) return null;
    current = next;
  }

  // Innermost ancestor (collection) sits at the end of `chain`. Walk
  // root→leaf to assemble the path.
  let path: string | null = null;
  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const node = chain[i];
    if (node.type === COLLECTION_ENTITY_TYPE) {
      const collMat = oracle.materializeOne(COLLECTION_ENTITY_TYPE, node.uid);
      if (!collMat) return null;
      const coll = projectCollection(collMat);
      if (!coll) return null;
      path = coll.path;
      continue;
    }
    if (path === null) return null;
    const folderMat = oracle.materializeOne(FOLDER_ENTITY_TYPE, node.uid);
    if (!folderMat) return null;
    const folder = projectFolder(folderMat, path);
    if (!folder) return null;
    path = folder.path;
  }
  return path;
}

interface ParentRef {
  type: typeof COLLECTION_ENTITY_TYPE | typeof FOLDER_ENTITY_TYPE;
  uid: string;
}

/**
 * Find the (collection | folder) that holds `childUid` in its
 * `folders` set. Walks the materialized list once — `liveSetItems` is
 * the cheaper cross-reference primitive than scanning the whole
 * snapshot for every parent candidate.
 */
function findSlotParent(
  oracle: FolderOracleReads,
  materialized: MaterializedEntity[],
  childUid: string,
): ParentRef | null {
  for (const m of materialized) {
    if (m.type !== COLLECTION_ENTITY_TYPE && m.type !== FOLDER_ENTITY_TYPE) continue;
    const slots = oracle.liveSetItems(m.type, m.id, FOLDER_CHILDREN_PATH);
    for (const slot of slots) {
      if (slot.itemId === childUid) {
        return { type: m.type as ParentRef['type'], uid: m.id };
      }
    }
  }
  return null;
}

/**
 * Project the full set of folders the oracle holds. Used by the cache
 * to mirror oracle state into `chrome.storage.local`. Skips folders
 * whose parent linkage isn't currently resolvable; those republish
 * once their parent slot lands.
 */
export function projectAllFolders(oracle: FolderOracleReads): V5.Folder[] {
  const materialized = oracle.materializeAll();
  const out: V5.Folder[] = [];
  for (const m of materialized) {
    if (m.type !== FOLDER_ENTITY_TYPE) continue;
    const parentPath = resolveParentPath(oracle, m.id);
    if (parentPath === null) continue;
    const folder = projectFolder(m, parentPath);
    if (folder) out.push(folder);
  }
  out.sort((a, b) => (a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0));
  return out;
}
