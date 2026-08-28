/**
 * Renderer-side placement for tree write sites.
 *
 * A leaf create takes its parent's `items` slot in the same batch as
 * the entity; a leaf delete tombstones that slot with the entity. The
 * renderer knows parents by PATH (the sidebar's selected container),
 * so every leaf write client resolves the parent ref the same way: the
 * tree's collection + folder mirrors first, the path's own uid tail as
 * the fallback (the shared resolver's contract), and the parent
 * mirror's live `items` tail for the append key.
 *
 * One `TreeMirrors` per tree; the three factories below bind the
 * per-workspace mirror registries and accept test overrides.
 */

import {
  type ChildPlacement,
  FOLDER_ITEMS_PATH,
  FOLDER_TREE_KINDS,
  keyBetween,
  REQUEST_FOLDER_ITEMS_PATH,
  REQUEST_FOLDER_TREE_KINDS,
  resolveTreeParent,
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

export interface TreeMirrors<C extends string, F extends string> {
  kinds: TreeParentKinds<C, F>;
  itemsPath: string;
  collectionMirror: ContainerMirror;
  folderMirror: ContainerMirror;
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

/** The parent ref of a LEAF at `entityPath` — its containing collection or folder. */
export async function resolveLeafParent<C extends string, F extends string>(
  tree: TreeMirrors<C, F>,
  entityPath: string,
): Promise<TreeParentRef<C, F> | null> {
  const parentPath = parentPathOf(entityPath);
  return parentPath === null ? null : resolveTreeParentRef(tree, parentPath);
}

/**
 * Placement for a new leaf under `parentPath`: the parent ref plus the
 * next append key on that parent's `items` set (strictly after the
 * mirror's live tail). `null` when the parent is unresolvable.
 */
export async function resolveLeafPlacement<C extends string, F extends string>(
  tree: TreeMirrors<C, F>,
  parentPath: string,
): Promise<ChildPlacement<TreeParentRef<C, F>> | null> {
  const parent = await resolveTreeParentRef(tree, parentPath);
  if (!parent) return null;
  const mirror = parent.type === tree.kinds.collectionType ? tree.collectionMirror : tree.folderMirror;
  const live = mirror.liveOrderedSetItems(parent.uid, tree.itemsPath);
  return { parent, orderKey: keyBetween(live.at(-1)?.orderKey ?? null, null) };
}

/** Uniform failure for a create whose parent the renderer cannot place. */
export function unresolvableParent(parentPath: string): { ok: false; reason: 'other'; message: string } {
  return { ok: false, reason: 'other', message: `parent path not resolvable: ${parentPath}` };
}
