/**
 * Per-envelope request-folder post-state projection.
 *
 * Thin adapter over `folder-tree-post-state.ts`.
 */

import type { SyncRequestFolderPostState } from '@openheaders/core/protocol';
import {
  type MutationEnvelope,
  REQUEST_COLLECTION_ENTITY_TYPE,
  REQUEST_FOLDER_AUTHS_PATH,
  REQUEST_FOLDER_CHILDREN_PATH,
  REQUEST_FOLDER_ENTITY_TYPE,
  REQUEST_FOLDER_ITEMS_PATH,
} from '@openheaders/core/sync';
import { projectRequestCollection } from '@openheaders/core/sync-builders/projections/request-collection-projection';
import { projectRequestFolder } from '@openheaders/core/sync-builders/projections/request-folder-projection';
import type { Folder } from '@openheaders/core/types';
import type { EntityOracle } from '../oracle';
import {
  type FolderTreeKinds,
  projectAllFoldersGeneric,
  projectFolderByUidGeneric,
  projectFolderPostStateGeneric,
} from './folder-tree-post-state';

type Reads = Pick<
  EntityOracle,
  'materializeOne' | 'materializeAll' | 'liveSetItems' | 'liveOrderedSetItems' | 'revision'
>;

/** The requests tree — shared by the folder, the four request kinds and the collection projections. */
export const REQUEST_TREE: FolderTreeKinds<typeof REQUEST_COLLECTION_ENTITY_TYPE, typeof REQUEST_FOLDER_ENTITY_TYPE> = {
  collectionType: REQUEST_COLLECTION_ENTITY_TYPE,
  folderType: REQUEST_FOLDER_ENTITY_TYPE,
  childrenPath: REQUEST_FOLDER_CHILDREN_PATH,
  itemsPath: REQUEST_FOLDER_ITEMS_PATH,
  folderSetPaths: [REQUEST_FOLDER_AUTHS_PATH],
  projectCollection: projectRequestCollection,
  projectFolder: projectRequestFolder,
};

export function projectRequestFolderPostState(
  oracle: Reads,
  envelope: MutationEnvelope,
): SyncRequestFolderPostState | null {
  return projectFolderPostStateGeneric(oracle, envelope, REQUEST_TREE);
}

export function projectRequestFolderByUid(oracle: Reads, folderUid: string): SyncRequestFolderPostState | null {
  return projectFolderByUidGeneric(oracle, folderUid, REQUEST_TREE);
}

export function projectAllRequestFolders(oracle: Reads): Folder[] {
  return projectAllFoldersGeneric(oracle, REQUEST_TREE);
}
