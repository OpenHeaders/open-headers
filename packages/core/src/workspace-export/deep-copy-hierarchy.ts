/**
 * Generic deep-copy helper for collection-tree-shaped entities.
 *
 * The runtime keeps three parallel collection trees (rules / requests /
 * templates), each with its own `Collection[]` + `LocalFolder[]` +
 * `Entity[]`. They differ only in the top-level path prefix
 * (`rules/...` / `requests/...` / `templates/...`) and in entity-
 * specific post-remap (Rule rewrites `collectionId` / `folderId`,
 * Request feeds its uid map back to the live-workflow step rebind).
 *
 * `deepCopyHierarchy` factors out everything the three trees share:
 *   - generate new uids for every collection, folder, and entity
 *   - rebuild paths via `toFolderName(name, newUid)` under `treePrefix/`
 *   - walk folders shallowest-first so parents remap before children
 *   - return the path remap (collections + folders) so the outer caller
 *     can rebind pause-marker keys, and the uid remaps so the entity
 *     finalizer can rewrite cross-entity references
 *
 * Sole live caller: the workspace importer's `new-uid` strategy
 * (`update` / `skip` strategies don't call this helper — per-entity
 * branching happens in the importer, before this). `duplicateWorkspace`
 * previously consumed this helper too; post-Phase B it routes through
 * the snapshot pipeline instead, where per-workspace oracles namespace
 * entity uids and a uid-regen pass is unnecessary.
 *
 * Pure function; no storage reads.
 */

import type { Collection, Folder } from '../types/index';
import { generateUid, toFolderName } from '../utils/workspace';

/**
 * Local-folder alias re-exported for the extension-side caller. The
 * persisted shape on disk has no `order` field; `Folder` declares
 * `order` as optional, so the persisted form is structurally
 * compatible — same type.
 */
export type LocalFolder = Folder;

/**
 * The minimum shape a "leaf" entity in a collection tree carries.
 * Rule, Request, Template all satisfy this. Path always present (the
 * runtime entity carries it; the on-disk YAML strips it via the
 * codec's runtime-only-fields rule).
 */
interface TreeLeafEntity {
  uid: string;
  path: string;
  name: string;
}

export interface DeepCopyContext<E extends TreeLeafEntity> {
  /** Old container path → new container path (collections + folders only). */
  pathRemap: Map<string, string>;
  /** Old collection uid → new collection uid. */
  collectionUidRemap: Map<string, string>;
  /** Old folder uid → new folder uid. */
  folderUidRemap: Map<string, string>;
  /** Old entity uid → new entity uid. */
  entityUidRemap: Map<string, string>;
  /** New collections (already in remapped form). */
  newCollections: Collection[];
  /** New folders (already in remapped form). */
  newFolders: LocalFolder[];
  /**
   * The proposed new entity (uid + path already applied) — passed in to
   * the finalizer so it can refine cross-entity references without
   * re-walking the maps. Only meaningful inside `finalizeEntity`.
   */
  proposedEntity?: E;
}

export interface DeepCopyHierarchyParams<E extends TreeLeafEntity> {
  entities: E[];
  collections: Collection[];
  folders: LocalFolder[];
  /** `'rules'` / `'requests'` / `'templates'` — the on-disk top folder. */
  treePrefix: string;
  /**
   * Optional final pass over each entity. Receives the entity with new
   * uid + path already applied and the full context (so the callback
   * can use `collectionUidRemap` / `folderUidRemap` to rewrite back-
   * pointers). Defaults to identity.
   */
  finalizeEntity?: (entity: E, ctx: DeepCopyContext<E>) => E;
}

export interface DeepCopyHierarchyResult<E extends TreeLeafEntity> {
  entities: E[];
  collections: Collection[];
  folders: LocalFolder[];
  /** Old container path → new container path (collections + folders). */
  pathRemap: Map<string, string>;
  /** Old entity uid → new entity uid. */
  entityUidRemap: Map<string, string>;
}

export function deepCopyHierarchy<E extends TreeLeafEntity>(
  params: DeepCopyHierarchyParams<E>,
): DeepCopyHierarchyResult<E> {
  const { entities, collections, folders, treePrefix, finalizeEntity } = params;

  const pathRemap = new Map<string, string>();
  const collectionUidRemap = new Map<string, string>();
  const folderUidRemap = new Map<string, string>();
  const entityUidRemap = new Map<string, string>();

  // ── Collections ─────────────────────────────────────────────────
  const newCollections: Collection[] = collections.map((c) => {
    const uid = generateUid();
    const path = `${treePrefix}/${toFolderName(c.name, uid)}`;
    pathRemap.set(c.path, path);
    collectionUidRemap.set(c.uid, uid);
    return { ...c, uid, path };
  });

  // ── Folders ─────────────────────────────────────────────────────
  // Walk shallowest-first so parents remap before children. Preserve
  // input order in the returned array so the caller's persisted layout
  // stays stable.
  const folderByOldPath = new Map<string, LocalFolder>();
  const sortedFolders = [...folders].sort((a, b) => a.path.split('/').length - b.path.split('/').length);
  for (const f of sortedFolders) {
    const uid = generateUid();
    const parentOldPath = f.path.substring(0, f.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(f.name, uid)}`;
    pathRemap.set(f.path, path);
    folderUidRemap.set(f.uid, uid);
    folderByOldPath.set(f.path, { ...f, uid, path });
  }
  const newFolders: LocalFolder[] = folders.map((f) => folderByOldPath.get(f.path) ?? f);

  // ── Entities ────────────────────────────────────────────────────
  const ctxBase: Omit<DeepCopyContext<E>, 'proposedEntity'> = {
    pathRemap,
    collectionUidRemap,
    folderUidRemap,
    entityUidRemap,
    newCollections,
    newFolders,
  };
  const newEntities: E[] = entities.map((e) => {
    const uid = generateUid();
    const parentOldPath = e.path.substring(0, e.path.lastIndexOf('/'));
    const parentNewPath = pathRemap.get(parentOldPath) ?? parentOldPath;
    const path = `${parentNewPath}/${toFolderName(e.name, uid)}`;
    entityUidRemap.set(e.uid, uid);
    const proposed = { ...e, uid, path } as E;
    if (!finalizeEntity) return proposed;
    return finalizeEntity(proposed, { ...ctxBase, proposedEntity: proposed });
  });

  return {
    entities: newEntities,
    collections: newCollections,
    folders: newFolders,
    pathRemap,
    entityUidRemap,
  };
}
