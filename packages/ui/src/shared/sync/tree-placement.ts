/**
 * Renderer-side placement for tree write sites.
 *
 * A create takes its parent's slot — `items` for a leaf, `folders`
 * for a folder — in the same batch as the entity; a delete tombstones
 * that slot with the entity. The renderer knows parents by PATH (the
 * sidebar's selected container), so every write client resolves the
 * parent ref the same way: the tree's collection + folder mirrors
 * first, the path's own uid tail as the fallback (the shared
 * resolver's contract), and the parent's MERGED live tail — its
 * folders and items are one order — for the append key, so a new
 * child of either kind lands after the last child of any kind.
 *
 * One `TreeMirrors` per tree; the three factories below bind the
 * per-workspace mirror registries and accept test overrides.
 */

import {
  type ChildPlacement,
  FOLDER_CHILDREN_PATH,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  keyBetween,
  mergedTailKey,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  resolveTreeParent,
  TEMPLATE_FOLDER_CHILDREN_PATH,
  TEMPLATE_FOLDER_ITEMS_PATH,
  TEMPLATE_FOLDER_TREE_KINDS,
  type TreeParentKinds,
  type TreeParentRef,
} from '@openheaders/core/sync';
import { parentPathOf } from '@openheaders/core/utils';
import type { CollectionSyncMirror } from '../../context/mirrors/collection-sync-mirror';
import { getCollectionSyncMirrorForWorkspace } from '../../context/mirrors/collection-sync-mirror';
import type { FolderSyncMirror } from '../../context/mirrors/folder-sync-mirror';
import { getFolderSyncMirrorForWorkspace } from '../../context/mirrors/folder-sync-mirror';
import type { RequestCollectionSyncMirror } from '../../context/mirrors/request-collection-sync-mirror';
import { getRequestCollectionSyncMirrorForWorkspace } from '../../context/mirrors/request-collection-sync-mirror';
import type { RequestFolderSyncMirror } from '../../context/mirrors/request-folder-sync-mirror';
import { getRequestFolderSyncMirrorForWorkspace } from '../../context/mirrors/request-folder-sync-mirror';
import type { TemplateCollectionSyncMirror } from '../../context/mirrors/template-collection-sync-mirror';
import { getTemplateCollectionSyncMirrorForWorkspace } from '../../context/mirrors/template-collection-sync-mirror';
import type { TemplateFolderSyncMirror } from '../../context/mirrors/template-folder-sync-mirror';
import { getTemplateFolderSyncMirrorForWorkspace } from '../../context/mirrors/template-folder-sync-mirror';

/** The slice of a container mirror placement needs. */
export interface ContainerMirror {
  liveOrderedSetItems(uid: string, setPath: string): Array<{ itemId: string; orderKey: string }>;
  hydrated: Promise<void>;
}

/** A tree's two container mirrors and set paths — what an append key needs. */
export interface TreeContainerMirrors<C extends string, F extends string> {
  kinds: TreeParentKinds<C, F>;
  childrenPath: string;
  itemsPath: string;
  collectionMirror: ContainerMirror;
  folderMirror: ContainerMirror;
}

export interface TreeMirrors<C extends string, F extends string> extends TreeContainerMirrors<C, F> {
  listCollections(): ReadonlyArray<{ uid: string; path: string }>;
  listFolders(): ReadonlyArray<{ uid: string; path: string }>;
}

/** Test overrides for the two container mirrors a tree reads. */
export interface TreeMirrorOverrides<CM, FM> {
  collectionMirror?: CM;
  folderMirror?: FM;
}

export type RuleTreeMirrors = TreeMirrors<typeof FOLDER_TREE_KINDS.collectionType, typeof FOLDER_TREE_KINDS.folderType>;

export function ruleTreeMirrors(
  workspaceId: string,
  overrides: TreeMirrorOverrides<CollectionSyncMirror, FolderSyncMirror>,
): RuleTreeMirrors {
  const collectionMirror = overrides.collectionMirror ?? getCollectionSyncMirrorForWorkspace(workspaceId);
  const folderMirror = overrides.folderMirror ?? getFolderSyncMirrorForWorkspace(workspaceId);
  return {
    kinds: FOLDER_TREE_KINDS,
    childrenPath: FOLDER_CHILDREN_PATH,
    itemsPath: FOLDER_ITEMS_PATH,
    collectionMirror,
    folderMirror,
    listCollections: () => collectionMirror.listCollections(),
    listFolders: () => folderMirror.listFolders(),
  };
}

export type RequestTreeMirrors = TreeMirrors<
  typeof REQUEST_FOLDER_TREE_KINDS.collectionType,
  typeof REQUEST_FOLDER_TREE_KINDS.folderType
>;

export function requestTreeMirrors(
  workspaceId: string,
  overrides: TreeMirrorOverrides<RequestCollectionSyncMirror, RequestFolderSyncMirror>,
): RequestTreeMirrors {
  const collectionMirror = overrides.collectionMirror ?? getRequestCollectionSyncMirrorForWorkspace(workspaceId);
  const folderMirror = overrides.folderMirror ?? getRequestFolderSyncMirrorForWorkspace(workspaceId);
  return {
    kinds: REQUEST_FOLDER_TREE_KINDS,
    childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
    itemsPath: REQUEST_FOLDER_ITEMS_PATH,
    collectionMirror,
    folderMirror,
    listCollections: () => collectionMirror.listRequestCollections(),
    listFolders: () => folderMirror.listRequestFolders(),
  };
}

export type TemplateTreeMirrors = TreeMirrors<
  typeof TEMPLATE_FOLDER_TREE_KINDS.collectionType,
  typeof TEMPLATE_FOLDER_TREE_KINDS.folderType
>;

export function templateTreeMirrors(
  workspaceId: string,
  overrides: TreeMirrorOverrides<TemplateCollectionSyncMirror, TemplateFolderSyncMirror>,
): TemplateTreeMirrors {
  const collectionMirror = overrides.collectionMirror ?? getTemplateCollectionSyncMirrorForWorkspace(workspaceId);
  const folderMirror = overrides.folderMirror ?? getTemplateFolderSyncMirrorForWorkspace(workspaceId);
  return {
    kinds: TEMPLATE_FOLDER_TREE_KINDS,
    childrenPath: TEMPLATE_FOLDER_CHILDREN_PATH,
    itemsPath: TEMPLATE_FOLDER_ITEMS_PATH,
    collectionMirror,
    folderMirror,
    listCollections: () => collectionMirror.listTemplateCollections(),
    listFolders: () => folderMirror.listTemplateFolders(),
  };
}

/**
 * The parent ref for a container path, once both container mirrors
 * have hydrated. `null` when neither the mirrors nor the path's uid
 * tail know the parent.
 */
export async function resolveTreeParentRef<C extends string, F extends string>(
  tree: TreeMirrors<C, F>,
  parentPath: string,
): Promise<TreeParentRef<C, F> | null> {
  await Promise.all([tree.collectionMirror.hydrated, tree.folderMirror.hydrated]);
  return resolveTreeParent(
    parentPath,
    { collections: tree.listCollections(), folders: tree.listFolders() },
    tree.kinds,
  );
}

/**
 * The live parent of a FOLDER — the one container whose `folders` set
 * holds its slot. The container mirrors' slots are fresh on every
 * move; the folder's own mirror `path` is not (a move emits envelopes
 * on the containers, never on the folder), so a delete that needs the
 * parent for the slot tombstone reads it here and falls back to the
 * stale path's parent only for a slot-less folder.
 */
export async function resolveFolderParentBySlot<C extends string, F extends string>(
  tree: TreeMirrors<C, F>,
  folderUid: string,
): Promise<TreeParentRef<C, F> | null> {
  await Promise.all([tree.collectionMirror.hydrated, tree.folderMirror.hydrated]);
  for (const collection of tree.listCollections()) {
    if (
      tree.collectionMirror.liveOrderedSetItems(collection.uid, tree.childrenPath).some((s) => s.itemId === folderUid)
    )
      return { type: tree.kinds.collectionType, uid: collection.uid };
  }
  for (const folder of tree.listFolders()) {
    if (tree.folderMirror.liveOrderedSetItems(folder.uid, tree.childrenPath).some((s) => s.itemId === folderUid))
      return { type: tree.kinds.folderType, uid: folder.uid };
  }
  const own = tree.listFolders().find((folder) => folder.uid === folderUid);
  const parentPath = own ? parentPathOf(own.path) : null;
  return parentPath === null ? null : resolveTreeParentRef(tree, parentPath);
}

/** The parent ref of a LEAF at `entityPath` — its containing collection or folder. */
export async function resolveLeafParent<C extends string, F extends string>(
  tree: TreeMirrors<C, F>,
  entityPath: string,
): Promise<TreeParentRef<C, F> | null> {
  const parentPath = parentPathOf(entityPath);
  return parentPath === null ? null : resolveTreeParentRef(tree, parentPath);
}

/** The next append key under `parent`: strictly after the merged tail of its folders and items. */
export function appendChildKey<C extends string, F extends string>(
  tree: TreeContainerMirrors<C, F>,
  parent: TreeParentRef<C, F>,
): string {
  const mirror = parent.type === tree.kinds.collectionType ? tree.collectionMirror : tree.folderMirror;
  const tail = mergedTailKey([
    mirror.liveOrderedSetItems(parent.uid, tree.childrenPath),
    mirror.liveOrderedSetItems(parent.uid, tree.itemsPath),
  ]);
  return keyBetween(tail, null);
}

/**
 * Placement for a new child under `parentPath`: the parent ref plus
 * the next append key on that parent (strictly after its merged live
 * tail). `null` when the parent is unresolvable.
 */
export async function resolveChildPlacement<C extends string, F extends string>(
  tree: TreeMirrors<C, F>,
  parentPath: string,
): Promise<ChildPlacement<TreeParentRef<C, F>> | null> {
  const parent = await resolveTreeParentRef(tree, parentPath);
  return parent ? { parent, orderKey: appendChildKey(tree, parent) } : null;
}

/** Uniform failure for a create whose parent the renderer cannot place. */
export function unresolvableParent(parentPath: string): { ok: false; reason: 'other'; message: string } {
  return { ok: false, reason: 'other', message: `parent path not resolvable: ${parentPath}` };
}
